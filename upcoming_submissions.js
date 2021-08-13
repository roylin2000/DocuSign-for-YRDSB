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

	 const envelopeArgs = {
		 signerEmail: validator.escape(body.signerEmail),
		 signerName: validator.escape(body.signerName),
		 signerClientId: signerClientId,
		 dsReturnUrl: dsReturnUrl,
		 dsPingUrl: dsPingUrl,
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
		results = await envelopesApi.createRecipientView(args.accountId, body.envID, {
			recipientViewRequest: viewRequest,
		});

	 }
	 catch (error) {
		 const errorBody = error && error.response && error.response.body;

		 const errorCode = errorBody && errorBody.errorCode;
		 const errorMessage = errorBody && errorBody.message;

		 res.render('pages/error', {err: error, errorCode, errorMessage});
	 }
	 if (results) {

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


	var envInfo = await (await envelopesApi.listStatusChanges(args.accountId, {folderIds:["awaiting_my_signature"]})).envelopes

	console.log(envInfo)

	
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
 