#!/bin/bash

# Dave Notes - Complete Setup (AWS CLI JSON output only)

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "╔════════════════════════════════════════════╗"
echo "║   Dave Notes - Final Setup                ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Load configuration
source aws-config.txt

echo "Using configuration:"
echo "  API ID: $API_ID"
echo "  Account: $ACCOUNT_ID"
echo ""

# Get resource IDs using AWS CLI query parameter
echo "Getting API resources..."
ROOT_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --region $REGION --query 'items[?path==`/`].id' --output text)
echo "Root: $ROOT_ID"

# Create /notes resource
echo "Creating /notes..."
NOTES_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --parent-id "$ROOT_ID" --path-part "notes" --region $REGION --query 'id' --output text 2>/dev/null || aws apigateway get-resources --rest-api-id "$API_ID" --region $REGION --query 'items[?pathPart==`notes`].id' --output text)
echo "Notes: $NOTES_ID"

# Create /notes/{noteId} resource
echo "Creating /notes/{noteId}..."
NOTEID_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --parent-id "$NOTES_ID" --path-part "{noteId}" --region $REGION --query 'id' --output text 2>/dev/null || aws apigateway get-resources --rest-api-id "$API_ID" --region $REGION --query 'items[?pathPart==`{noteId}`].id' --output text)
echo "NoteId: $NOTEID_ID"

# Create /upload resource
echo "Creating /upload..."
UPLOAD_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --parent-id "$ROOT_ID" --path-part "upload" --region $REGION --query 'id' --output text 2>/dev/null || aws apigateway get-resources --rest-api-id "$API_ID" --region $REGION --query 'items[?pathPart==`upload`].id' --output text)
echo "Upload: $UPLOAD_ID"

echo ""
echo "Configuring methods..."

# GET /notes
echo "→ GET /notes"
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$NOTES_ID" --http-method GET --authorization-type NONE --region $REGION > /dev/null 2>&1
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$NOTES_ID" --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:davenotes-list-notes/invocations" --region $REGION > /dev/null 2>&1
aws lambda add-permission --function-name davenotes-list-notes --statement-id apigateway-get-$(date +%s) --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/GET/notes" --region $REGION > /dev/null 2>&1 || true

# POST /notes
echo "→ POST /notes"
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$NOTES_ID" --http-method POST --authorization-type NONE --region $REGION > /dev/null 2>&1
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$NOTES_ID" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:davenotes-create-note/invocations" --region $REGION > /dev/null 2>&1
aws lambda add-permission --function-name davenotes-create-note --statement-id apigateway-post-$(date +%s) --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/POST/notes" --region $REGION > /dev/null 2>&1 || true

# DELETE /notes/{noteId}
echo "→ DELETE /notes/{noteId}"
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$NOTEID_ID" --http-method DELETE --authorization-type NONE --region $REGION > /dev/null 2>&1
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$NOTEID_ID" --http-method DELETE --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:davenotes-delete-note/invocations" --region $REGION > /dev/null 2>&1
aws lambda add-permission --function-name davenotes-delete-note --statement-id apigateway-delete-$(date +%s) --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/DELETE/notes/*" --region $REGION > /dev/null 2>&1 || true

# POST /upload
echo "→ POST /upload"
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$UPLOAD_ID" --http-method POST --authorization-type NONE --region $REGION > /dev/null 2>&1
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$UPLOAD_ID" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:davenotes-upload-file/invocations" --region $REGION > /dev/null 2>&1
aws lambda add-permission --function-name davenotes-upload-file --statement-id apigateway-upload-$(date +%s) --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/POST/upload" --region $REGION > /dev/null 2>&1 || true

echo ""
echo "Enabling CORS..."

# CORS for /notes
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$NOTES_ID" --http-method OPTIONS --authorization-type NONE --region $REGION > /dev/null 2>&1
aws apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$NOTES_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' --region $REGION > /dev/null 2>&1
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$NOTES_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\": 200}"}' --region $REGION > /dev/null 2>&1
aws apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$NOTES_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' --region $REGION > /dev/null 2>&1

# CORS for /notes/{noteId}
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$NOTEID_ID" --http-method OPTIONS --authorization-type NONE --region $REGION > /dev/null 2>&1
aws apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$NOTEID_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' --region $REGION > /dev/null 2>&1
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$NOTEID_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\": 200}"}' --region $REGION > /dev/null 2>&1
aws apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$NOTEID_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' --region $REGION > /dev/null 2>&1

# CORS for /upload
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$UPLOAD_ID" --http-method OPTIONS --authorization-type NONE --region $REGION > /dev/null 2>&1
aws apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$UPLOAD_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' --region $REGION > /dev/null 2>&1
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$UPLOAD_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\": 200}"}' --region $REGION > /dev/null 2>&1
aws apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$UPLOAD_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' --region $REGION > /dev/null 2>&1

echo ""
echo "Deploying API..."
aws apigateway create-deployment --rest-api-id "$API_ID" --stage-name prod --description "Production" --region $REGION > /dev/null 2>&1

echo ""
echo "Testing API..."
curl -s "$API_ENDPOINT/notes?userId=test" 

echo ""
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║          Setup Complete! 🎉                ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}Your API Endpoint:${NC}"
echo "  $API_ENDPOINT"
echo ""
echo -e "${BLUE}Copy this into dave-notes.js:${NC}"
echo ""
cat aws-config.js
echo ""
echo ""
echo -e "${BLUE}NEXT STEPS:${NC}"
echo ""
echo "1. Open dave-notes.js"
echo "2. Find the CONFIG.AWS section"
echo "3. Replace it with the config above"
echo "4. Save and test!"
echo ""
