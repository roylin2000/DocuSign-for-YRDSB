/**
 * @file
 * Example 001: Use embedded signing
 * @author DocuSign
 */

 const path = require('path');
 //const { sendEnvelopeForEmbeddedSigning } = require('./lib/eSignature/examples/embeddedSigning');
 const validator = require('validator');
 const dsConfig = require('./config/index.js').config;
 const { env } = require('process');
 
 const admin_portal = exports;
 const eg = 'eg001'; // This example reference.
 const mustAuthenticate = '/ds/mustAuthenticate';
 const minimumBufferMin = 3;
 const signerClientId = 1000; // The id of the signer within this application.
 const demoDocsPath = path.resolve(__dirname, 'demo_documents');
 const pdf1File = 'World_Wide_Corp_lorem.pdf';
 const dsReturnUrl = dsConfig.appUrl + '/ds-return';
 const dsPingUrl = dsConfig.appUrl + '/'; // Url that will be pinged by the DocuSign signing via Ajax
 const docusign = require("docusign-esign");

 /**
  * Create the envelope, the embedded signing, and then redirect to the DocuSign signing
  * @param {object} req Request obj
  * @param {object} res Response obj
  */
  admin_portal.createController = async (req, res) => {
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

	 console.log(body.docDeadline)


	 const envelopeArgs = {
		 inputFileNames: body.inputFiles,
		 docFiles: body.fileBase64.substr(body.fileBase64.indexOf(',')+1),
		 envName: body.docName,
		 expireAfter: body.docDeadline,
		 bulkRecipients: body.bulkJSONFile,
	 };
	 const args = {
		 accessToken: req.user.accessToken,
		 basePath: req.session.basePath,
		 accountId: req.session.accountId,
		 envelopeArgs: envelopeArgs
	 };
	 let results = null;
 
	 try {
		 results = await bulkSendEnvelopeForSigning(args);
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
        console.log(results)
        res.render('pages/example_done', {
            title: "Bulk sent",
            h1: "Bulk send envelope was successfully performed!",
            message: `Bulk request queued to ${results.queued} user lists.`
        });
    }
 }
 
 /**
  * Form page for this application
  */
  admin_portal.getController = (req, res) => {
	 console.log(req.dsAuth);
	 // Check that the authentication token is ok with a long buffer time.
	 // If needed, now is the best time to ask the user to authenticate
	 // since they have not yet entered any information into the form.
	 const tokenOK = req.dsAuth.checkToken();
	 if (tokenOK) {
		 res.render('pages/examples/demo_admin_portal', {
			 eg: eg, csrfToken: req.csrfToken(),
			 title: "Use embedded signing",
			 showDoc: dsConfig.documentation
		 });
	 } else {
		 // Save the current operation so it will be resumed after authentication
		 req.dsAuth.setEg(req, eg);
		 res.redirect(mustAuthenticate);
	 }
 }
 

const bulkSendEnvelopeForSigning = async (args) => {
	// Data for this method
	// args.basePath
	// args.accessToken
	// args.accountId
  
	let dsApiClient = new docusign.ApiClient();
	dsApiClient.setBasePath(args.basePath);
	dsApiClient.addDefaultHeader("Authorization", "Bearer " + args.accessToken);
	let envelopesApi = new docusign.EnvelopesApi(dsApiClient),
	  results = null,
	  bulkEnvelopesApi = new docusign.BulkEnvelopesApi(dsApiClient);


	//creating bulkRecipients list from the json of the csv file
	bulkRecipients = [];

	JSON.parse(args.envelopeArgs.bulkRecipients).forEach( recip => {
		bulkRecipients.push({
			recipients: [recip]
		})
	})
	

	let bulkList = await bulkEnvelopesApi.createBulkSendList(args.accountId,
		{
			bulkSendingList: {
				name: "Send to students",
				bulkCopies: bulkRecipients
			}
	})
  
	// Step 1. Make the envelope request body
	let envelope = makeEnvelope(args.envelopeArgs);
  
	// Step 2. call Envelopes::create API method
	// Exceptions will be caught by the calling function
	results = await envelopesApi.createEnvelope(args.accountId, {
	  envelopeDefinition: envelope,
	});
  
	let envelopeId = results.envelopeId;

	await envelopesApi.createRecipient(args.accountId, envelopeId,{
			recipients: {
				signers: [
					{
						name: "Multi Bulk Recipient::signer",
						email: "multiBulkRecipients-signer@docusign.com",
						roleName: "signer",
						routingOrder: "1",
						status: "created",
						deliveryMethod: "email",
						recipientId: "1",
						recipientType: "signer"
					}
				]
			}
	})

	await envelopesApi.createCustomFields(args.accountId, envelopeId,
		{
			customFields: {
				textCustomFields: [
					{
						name: "mailingListId",
						required: "false",
						show: "false",
						value: bulkList.listId
					}
				]
			}
	})

	

	console.log(`Envelope was created. EnvelopeId ${envelopeId}`);


	let bulkResult = await bulkEnvelopesApi.createBulkSendRequest(args.accountId, bulkList.listId,
		{
			bulkSendRequest: {
				envelopeOrTemplateId: envelopeId
			}
	})
  

	const sleep = (milliseconds) => {
		return new Promise(resolve => setTimeout(resolve, milliseconds))
	}

	await sleep(10000)

	results = await bulkEnvelopesApi.getBulkSendBatchStatus(args.accountId, bulkResult.batchId)

	
	// await envelopesApi.updateNotificationSettings(args.accountId, "5ca27287-2723-410e-9221-8cc63f8f349e", {
	// 	expirations: {
	// 		expireAfter: "20",
	// 		expireEnabled: "true",
	// 		expireWarn: "10"
	// 	},
	// 	useAccountDefaults: "false"
	// })
	
  
	return results;
  };
  
  /**
   * Creates envelope
   * @function
   * @param {Object} args parameters for the envelope:
   * @returns {Envelope} An envelope definition
   * @private
   */
  function makeEnvelope(args) {
	// Data for this method
	// args.signerEmail
	// args.signerName
	// args.signerClientId
	// docFile 
  
	// document 1 (pdf) has tag /sn1/
	//
	// The envelope has one recipients.
	// recipient 1 - signer
  
  
  
	// create the envelope definition
	let env = new docusign.EnvelopeDefinition();
	env.envelopeIdStamping = "true"
	env.emailSubject = args.envName;
  

	let doc1 = new docusign.Document();
	doc1.documentBase64 = args.docFiles
	doc1.name = args.inputFileNames;
	doc1.fileExtension = "pdf";
	doc1.documentId = 1;


	// add the documents
  
	// The order in the docs array determines the order in the envelope
	env.documents = [doc1];

  
	// Request that the envelope be sent by setting |status| to "sent".
	// To request that the envelope be created as a draft, set to "created"
	env.status = "created";
	
	//Set Notifications
	let notification = new docusign.Notification();
	notification.useAccountDefaults = 'false';
	let expirations = new docusign.Expirations();
	expirations.expireEnabled = 'true';
	expirations.expireAfter = args.expireAfter;  // envelope will expire after 30 days
	expirations.expireWarn = '5';
	notification.expirations = expirations;
	env.notification = notification;

	return env;
}