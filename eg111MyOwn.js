/**
 * @file
 * Example 111: Use embedded signing
 * @author Roy Lin
 */

 const path = require('path');
 const { sendEnvelopeForEmbeddedSigning, makeRecipientViewRequest } = require('./lib/eSignature/examples/embeddedSigning');
 const validator = require('validator');
 const dsConfig = require('./config/index.js').config;
 
 const eg111EmbeddedSigning = exports;
 const eg = 'eg111'; // This example reference.
 const mustAuthenticate = '/ds/mustAuthenticate';
 const minimumBufferMin = 3;
 const signerClientId = 1000; // The id of the signer within this application.
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
 eg111EmbeddedSigning.createController = async (req, res) => {
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
  eg111EmbeddedSigning.getController = async (req, res) => {
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
		 res.render('pages/examples/final', {
			 eg: eg, csrfToken: req.csrfToken(),
			 title: "My own example",
			 sourceFile: path.basename(__filename),
			 sourceUrl: 'https://github.com/docusign/code-examples-node/blob/master/eg001EmbeddedSigning.js',
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
 