/**
 * @file
 * Example 011: Use embedded sending: Remote signer, cc, envelope has three documents
 * @author DocuSign
 */

 const path = require('path')
 , docusign = require('docusign-esign')
 , validator = require('validator')
 , dsConfig = require('./config/index.js').config
 ;

const volunteer_sending = exports
 , eg = 'volunteer_sending' // This example reference.
 , mustAuthenticate = '/ds/mustAuthenticate'
 , minimumBufferMin = 3
 , dsReturnUrl = dsConfig.appUrl + '/ds-return'
 ;

/**
* Create the envelope
* @param {object} req Request obj
* @param {object} res Response obj
*/
volunteer_sending.createController = async (req, res) => {
 // Step 1. Check the token
 // At this point we should have a good token. But we
 // double-check here to enable a better UX to the user.
 let tokenOK = req.dsAuth.checkToken(minimumBufferMin);
 if (! tokenOK) {
	 req.flash('info', 'Sorry, you need to re-authenticate.');
	 // Save the current operation so it will be resumed after authentication
	 req.dsAuth.setEg(req, eg);
	 res.redirect(mustAuthenticate);
 }

 // Step 2. Call the worker method
 let body = req.body
	 // Additional data validation might also be appropriate
   , signerEmail = validator.escape(body.signerEmail)
   , signerName = validator.escape(body.signerName)
   , ccEmail = validator.escape(body.ccEmail)
   , ccName = validator.escape(body.ccName)
   , companyName = validator.escape(body.companyName)
   , volunHours = validator.escape(body.volunHours)
   , startingView = "tagging"
   , envelopeArgs = {
		 signerEmail: signerEmail,
		 signerName: signerName,
		 ccEmail: ccEmail,
		 ccName: ccName,
		 dsReturnUrl: dsReturnUrl,
		 envName: "Volunteer Hours Confirmation for " + req.user.name,
		 volunHours: volunHours,
		 companyName: companyName,
		 studentName: req.user.name
	 }
   , args = {
		 accessToken: req.user.accessToken,
		 basePath: req.session.basePath,
		 accountId: req.session.accountId,
		 startingView: startingView,
		 envelopeArgs: envelopeArgs
	 }
   , results = null
   ;

 try {
	 results = await volunteer_sending.worker (args)
 }
 catch (error) {
	 let errorBody = error && error.response && error.response.body
		 // we can pull the DocuSign error code and message from the response body
	   , errorCode = errorBody && errorBody.errorCode
	   , errorMessage = errorBody && errorBody.message
	   ;
	 // In production, may want to provide customized error messages and
	 // remediation advice to the user.
	 res.render('pages/error', {err: error, errorCode: errorCode, errorMessage: errorMessage});
 }
 if (results) {
	 // Redirect the user to the Sender View
	 // Don't use an iFrame!
	 // State can be stored/recovered using the framework's session or a
	 // query parameter on the returnUrl (see the makeSenderViewRequest method)
	 res.redirect(results.redirectUrl);
 }
}

/**
* This function does the work of creating the envelope in
* draft mode and returning a URL for the sender's view
* @param {object} args object
*/
// ***DS.snippet.0.start
volunteer_sending.worker = async (args) => {
 // Data for this method
 // args.basePath
 // args.accessToken
 // args.accountId
 // args.startingView -- 'recipient' or 'tagging'

 let dsApiClient = new docusign.ApiClient();
 dsApiClient.setBasePath(args.basePath);
 dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + args.accessToken);
 let envelopesApi = new docusign.EnvelopesApi(dsApiClient);

 // Step 1. Make the envelope with "created" (draft) status
 let envelope = makeEnvelope(args.envelopeArgs);
 let results = await envelopesApi.createEnvelope(args.accountId, {
	envelopeDefinition: envelope,
  });

  let envelopeId = results.envelopeId;

 // Step 2. create the sender view
 let viewRequest = makeSenderViewRequest(args.envelopeArgs);
 // Call the CreateSenderView API
 // Exceptions will be caught by the calling function
 results = await envelopesApi.createSenderView(
	 args.accountId, envelopeId,
	 {returnUrlRequest: viewRequest});

 // Switch to Recipient and Documents view if requested by the user
 let url = results.url;
 console.log (`startingView: ${args.startingView}`);
 if (args.startingView === "recipient") {
	 url = url.replace('send=1', 'send=0');
 }

 return ({envelopeId: envelopeId, redirectUrl: url})
}

function makeSenderViewRequest(args) {
 let viewRequest = new docusign.ReturnUrlRequest();
 // Data for this method
 // args.dsReturnUrl

 // Set the url where you want the recipient to go once they are done signing
 // should typically be a callback route somewhere in your app.
 viewRequest.returnUrl = args.dsReturnUrl;
 return viewRequest
}
// ***DS.snippet.0.end


/**
* Form page for this application
*/
volunteer_sending.getController = (req, res) => {
 // Check that the authentication token is ok with a long buffer time.
 // If needed, now is the best time to ask the user to authenticate
 // since they have not yet entered any information into the form.
 let tokenOK = req.dsAuth.checkToken();
 if (tokenOK) {
	 res.render('pages/examples/volunteer_sending', {
		 eg: eg, csrfToken: req.csrfToken(),
		 title: "Signing request by email",
		 sourceFile: path.basename(__filename),
		 sourceUrl: dsConfig.githubExampleUrl + 'eSignature/' + path.basename(__filename),
		 showDoc: dsConfig.documentation
	 });
 } else {
	 // Save the current operation so it will be resumed after authentication
	 req.dsAuth.setEg(req, eg);
	 res.redirect(mustAuthenticate);
 }
}

function makeEnvelope(args) {

	companyName = args.companyName;
	volunHours = args.volunHours;
  
	// create the envelope definition
	let env = new docusign.EnvelopeDefinition();
	env.envelopeIdStamping = "true"
	env.emailSubject = args.envName;
  

	let doc1b64 = Buffer.from(volunteer_doc(args)).toString('base64')

	let doc1 = new docusign.Document();
	doc1.documentBase64 = doc1b64;
	doc1.name = "Hours Volunteered";
	doc1.fileExtension = "html";
	doc1.documentId = 1;

	env.documents = [doc1];

	// setting up recipients
	let signer1 = docusign.Signer.constructFromObject({
        email: args.signerEmail,
        name: args.signerName,
        recipientId: '1',
        routingOrder: '1'});

	let cc1 = new docusign.CarbonCopy();
	cc1.email = args.ccEmail;
	cc1.name = args.ccName;
	cc1.routingOrder = '2';
	cc1.recipientId = '2';

	


	let signHere1 = docusign.SignHere.constructFromObject({
        anchorString: '**signature_1**',
        anchorYOffset: '10', anchorUnits: 'pixels',
        anchorXOffset: '20'})
	
	let dateHere1 = docusign.DateSigned.constructFromObject({
		anchorString: '**date_1**',
		anchorYOffset: '-5', anchorUnits: 'pixels',
		anchorXOffset: '20'})

	let signer1Tabs = docusign.Tabs.constructFromObject({
		signHereTabs: [signHere1],
		dateSignedTabs: [dateHere1]
	});

	signer1.tabs = signer1Tabs;

	let recipients = docusign.Recipients.constructFromObject({
		signers: [signer1],
		carbonCopies: [cc1]});
	env.recipients = recipients;
	// To request that the envelope be created as a draft, set to "created"
	env.status = "created";
	
	//Set Notifications
	let notification = new docusign.Notification();
	notification.useAccountDefaults = 'false';
	let expirations = new docusign.Expirations();
	expirations.expireEnabled = 'true';
	expirations.expireAfter = "60";  
	expirations.expireWarn = '10';
	notification.expirations = expirations;
	env.notification = notification;

	return env;
}


const volunteer_doc = args => {
	return `
	<!DOCTYPE html>
    <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family:sans-serif;margin-left:2em;">
        <h1 style="font-family: 'Trebuchet MS', Helvetica, sans-serif;
            color: darkblue;margin-bottom: 0;">Volunteer Hours Confirmation</h1>
        <h4>Hi ${args.signerName},</h4>
        <p style="margin-top:0em; margin-bottom:0em;">Company: ${args.companyName}</p>
        <p style="margin-top:0em; margin-bottom:0em;">Hours volunteered: ${args.volunHours}</p>
        <p style="margin-top:3em;">
			Please confirm that ${args.studentName} volunteered for the amount of hours stated above at ${args.companyName}.
        </p>
        <!-- Note the anchor tag for the signature field is in white. -->
        <h3 style="margin-top:3em;">Sign Here: <span style="color:white;">**signature_1**/</span></h3>
		<h3 style="margin-top:3em;">Date: <span style="color:white;">**date_1**/</span></h3>
        </body>
    </html>
	`
}