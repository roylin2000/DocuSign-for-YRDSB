/**
 * @file
 * Example 111: Use embedded signing
 * @author Roy Lin
 */

 const path = require('path');
 const validator = require('validator');
 const dsConfig = require('./config/index.js').config;
 
 const upcoming_submissions = exports;
 const eg = ''; // This example reference.
 const mustAuthenticate = '/ds/mustAuthenticate';
 const minimumBufferMin = 3;
 const signerClientId = 1; // The id of the signer within this application.
 const demoDocsPath = path.resolve(__dirname, 'demo_documents');
 const pdf1File = 'My_Own_Doc.pdf';
 const dsReturnUrl = dsConfig.appUrl + '/ds-return';
 const dsPingUrl = dsConfig.appUrl + '/'; // Url that will be pinged by the DocuSign signing via Ajax

 const docusign = require("docusign-esign");
 /**
  * Create the envelope, the embedded signing, and then redirect to the DocuSign signing
  * @param {object} req Request obj
  * @param {object} res Response obj
  */
 upcoming_submissions.createController = async (req, res) => {
	 // Step 1. Check the token
	 // At this point we should have a good token. But we
	 // double-check here to enable a better UX to the user.
	 const tokenOK = req.dsAuth.checkToken(minimumBufferMin);
	 if (! tokenOK) {
		 req.flash('info', 'Sorry, you need to re-authenticate.');
		 // Save the current operation so it will be resumed after authentication
		 req.dsAuth.setEg(req, eg);
		 res.redirect(mustAuthenticate);
	 }
 
	 // Step 2. Call the worker method
	 const { body } = req;

	//console.log("cool " + body.envID)

	 const envelopeArgs = {
		 signerEmail: validator.escape(body.signerEmail),
		 signerName: validator.escape(body.signerName),
		 signerClientId: signerClientId,
		 dsReturnUrl: dsReturnUrl,
		 dsPingUrl: dsPingUrl,
		//  docFile: path.resolve(demoDocsPath, body.pdfFile)
	 };
	 const args = {
		 accessToken: req.user.accessToken,
		 basePath: req.session.basePath,
		 accountId: req.session.accountId,
		 envelopeArgs: envelopeArgs
	 };

	let dsApiClient = new docusign.ApiClient();
	dsApiClient.setBasePath(args.basePath);
	dsApiClient.addDefaultHeader("Authorization", "Bearer " + args.accessToken);
	let envelopesApi = new docusign.EnvelopesApi(dsApiClient),
		results = null;
 
	 try {
		let viewRequest = makeRecipientViewRequest(envelopeArgs);
		// results = await sendEnvelopeForEmbeddedSigning(args);
		results = await envelopesApi.createRecipientView(args.accountId, body.envID, {
			recipientViewRequest: viewRequest,
		});

		// console.log("The URL is: " + results.url)
	 }
	 catch (error) {
		 const errorBody = error && error.response && error.response.body;
		 // we can pull the DocuSign error code and message from the response body
		 const errorCode = errorBody && errorBody.errorCode;
		 const errorMessage = errorBody && errorBody.message;
		 // In production, may want to provide customized error messages and
		 // remediation advice to the user.
		 res.render('pages/error', {err: error, errorCode, errorMessage});
	 }
	 if (results) {
		 // Redirect the user to the embedded signing
		 // Don't use an iFrame!
		 // State can be stored/recovered using the framework's session or a
		 // query parameter on the returnUrl (see the makeRecipientViewRequest method)
		 res.redirect(results.url);
	 }
 }
 
 /**
  * Form page for this application
  */
  upcoming_submissions.getController = async (req, res) => {
	const args = {
		accessToken: req.user.accessToken,
		basePath: req.session.basePath,
		accountId: req.session.accountId,
	};

	let dsApiClient = new docusign.ApiClient();
	dsApiClient.setBasePath(args.basePath);
	dsApiClient.addDefaultHeader("Authorization", "Bearer " + args.accessToken);
	let envelopesApi = new docusign.EnvelopesApi(dsApiClient)

	//** example list of forms to sign
	var forms = [
		{name: 'Museum Field Trip', status: 'Incomplete', type: "Extracurriculars", deadline: "August 10th (11:59 PM EST)", pdfFile: "World_Wide_Corp_fields.pdf"},
		{name: 'Science Lab', status: 'Incomplete', type: "In-School", deadline: "August 29th (11:59 PM EST)", pdfFile: "World_Wide_Corp_lorem.pdf"},
		{name: 'Healthcare Forms', status: 'Incomplete', type: "Adminitrative", deadline: "August 15th (11:59 PM EST)", pdfFile: "My_Own_Doc.pdf", envID: "b9df39e8-b7f8-495a-9445-48c767877cb6"}
	]

	

	// const envSearchParams = {
	// 	folder_ids: [out_for_signature]
	// }

	var envInfo = await (await envelopesApi.listStatusChanges(args.accountId, {folderIds:["awaiting_my_signature"]})).envelopes

	console.log(envInfo)

	



	 //console.log(req.dsAuth);
	 // Check that the authentication token is ok with a long buffer time.
	 // If needed, now is the best time to ask the user to authenticate
	 // since they have not yet entered any information into the form.
	 const tokenOK = req.dsAuth.checkToken();
	 if (tokenOK) {
		 res.render('pages/examples/upcoming_submissions', {
			 eg: eg, csrfToken: req.csrfToken(),
			 title: "My own example",
			 sourceFile: path.basename(__filename),
			//  sourceUrl: 'https://github.com/docusign/code-examples-node/blob/master/eg001EmbeddedSigning.js',
			 documentation: dsConfig.documentation + eg,
			 showDoc: dsConfig.documentation,
			 forms: envInfo,
		 });
	 } else {
		 // Save the current operation so it will be resumed after authentication
		 req.dsAuth.setEg(req, eg);
		 res.redirect(mustAuthenticate);
	 }
 }

function makeRecipientViewRequest(args) {
	// Data for this method
	// args.dsReturnUrl
	// args.signerEmail
	// args.signerName
	// args.signerClientId
	// args.dsPingUrl
  
	let viewRequest = new docusign.RecipientViewRequest();
  
	// Set the url where you want the recipient to go once they are done signing
	// should typically be a callback route somewhere in your app.
	// The query parameter is included as an example of how
	// to save/recover state information during the redirect to
	// the DocuSign signing. It's usually better to use
	// the session mechanism of your web framework. Query parameters
	// can be changed/spoofed very easily.
	viewRequest.returnUrl = args.dsReturnUrl + "?state=123";
  
	// How has your app authenticated the user? In addition to your app's
	// authentication, you can include authenticate steps from DocuSign.
	// Eg, SMS authentication
	viewRequest.authenticationMethod = "Email";
  
	// Recipient information must match embedded recipient info
	// we used to create the envelope.
	viewRequest.email = args.signerEmail;
	viewRequest.userName = args.signerName;
  //   viewRequest.clientUserId = args.signerClientId;
  
	// DocuSign recommends that you redirect to DocuSign for the
	// embedded signing. There are multiple ways to save state.
	// To maintain your application's session, use the pingUrl
	// parameter. It causes the DocuSign signing web page
	// (not the DocuSign server) to send pings via AJAX to your
	// app,
	viewRequest.pingFrequency = 600; // seconds
	// NOTE: The pings will only be sent if the pingUrl is an https address
	viewRequest.pingUrl = args.dsPingUrl; // optional setting
  
	return viewRequest;
}
 