#!/bin/bash

# Dave Notes - Deploy Everything (Lambda + API Gateway)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "╔════════════════════════════════════════════╗"
echo "║   Dave Notes - Complete Deployment        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Load configuration
if [ ! -f "aws-config.txt" ]; then
    echo "Error: aws-config.txt not found"
    echo "Run: ./find-resources.sh first"
    exit 1
fi

source aws-config.txt

echo "Configuration loaded:"
echo "  User Pool: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  API ID: $API_ID"
echo "  Account: $ACCOUNT_ID"
echo ""

# ============================================
# STEP 1: Create Lambda Functions
# ============================================
echo "════════════════════════════════════════════"
echo "Step 1: Creating Lambda Functions"
echo "════════════════════════════════════════════"
echo ""

# Create Lambda function files if they don't exist
if [ ! -f "listNotes.mjs" ]; then
cat > listNotes.mjs << 'EOF'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);
export const handler = async (event) => {
    const userId = event.requestContext?.authorizer?.claims?.email || event.queryStringParameters?.userId;
    if (!userId) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "userId required" }) };
    try {
        const response = await docClient.send(new QueryCommand({ TableName: "DaveNotes", KeyConditionExpression: "userId = :userId", ExpressionAttributeValues: { ":userId": userId }, ScanIndexForward: false }));
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ notes: response.Items || [], count: response.Count || 0 }) };
    } catch (error) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: error.message }) };
    }
};
EOF
fi

if [ ! -f "createNote.mjs" ]; then
cat > createNote.mjs << 'EOF'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);
export const handler = async (event) => {
    const userId = event.requestContext?.authorizer?.claims?.email || event.queryStringParameters?.userId;
    if (!userId) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "userId required" }) };
    let note = JSON.parse(event.body);
    note.userId = userId;
    note.updatedAt = new Date().toISOString();
    if (!note.noteId) { note.noteId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9); note.createdAt = note.updatedAt; }
    try {
        await docClient.send(new PutCommand({ TableName: "DaveNotes", Item: note }));
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ success: true, note }) };
    } catch (error) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: error.message }) };
    }
};
EOF
fi

if [ ! -f "deleteNote.mjs" ]; then
cat > deleteNote.mjs << 'EOF'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);
export const handler = async (event) => {
    const userId = event.requestContext?.authorizer?.claims?.email || event.queryStringParameters?.userId;
    const noteId = event.pathParameters?.noteId;
    if (!userId || !noteId) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "userId and noteId required" }) };
    try {
        await docClient.send(new DeleteCommand({ TableName: "DaveNotes", Key: { userId, noteId } }));
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: error.message }) };
    }
};
EOF
fi

if [ ! -f "uploadFile.mjs" ]; then
cat > uploadFile.mjs << 'EOF'
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const s3Client = new S3Client({ region: "us-east-2" });
export const handler = async (event) => {
    const userId = event.requestContext?.authorizer?.claims?.email || event.queryStringParameters?.userId || 'anonymous';
    const { fileName, fileType } = JSON.parse(event.body);
    if (!fileName || !fileType) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "fileName and fileType required" }) };
    try {
        const key = `${userId}/${Date.now()}-${fileName}`;
        const BUCKET = process.env.BUCKET_NAME;
        const uploadUrl = await getSignedUrl(s3Client, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: fileType }), { expiresIn: 3600 });
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ uploadUrl, fileUrl: `https://${BUCKET}.s3.us-east-2.amazonaws.com/${key}`, key }) };
    } catch (error) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: error.message }) };
    }
};
EOF
fi

# Create ZIP files
zip -q listNotes.zip listNotes.mjs
zip -q createNote.zip createNote.mjs
zip -q deleteNote.zip deleteNote.mjs
zip -q uploadFile.zip uploadFile.mjs

echo "✓ Lambda function files created"

# Deploy Lambda functions
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/DaveNotesLambdaRole"

deploy_lambda() {
    local NAME=$1
    local ZIP=$2
    local ENV=$3
    
    echo "Deploying $NAME..."
    
    if [ -n "$ENV" ]; then
        aws lambda create-function \
          --function-name "$NAME" \
          --runtime nodejs20.x \
          --role "$ROLE_ARN" \
          --handler "${ZIP%.zip}.handler" \
          --zip-file "fileb://$ZIP" \
          --timeout 30 \
          --environment "Variables={BUCKET_NAME=$BUCKET_NAME}" \
          --region $REGION > /dev/null 2>&1 && echo "  ✓ Created" || echo "  ⚠ Already exists, updating..."
    else
        aws lambda create-function \
          --function-name "$NAME" \
          --runtime nodejs20.x \
          --role "$ROLE_ARN" \
          --handler "${ZIP%.zip}.handler" \
          --zip-file "fileb://$ZIP" \
          --timeout 30 \
          --region $REGION > /dev/null 2>&1 && echo "  ✓ Created" || echo "  ⚠ Already exists, updating..."
    fi
    
    # Update if already exists
    aws lambda update-function-code \
      --function-name "$NAME" \
      --zip-file "fileb://$ZIP" \
      --region $REGION > /dev/null 2>&1 || true
}

deploy_lambda "davenotes-list-notes" "listNotes.zip"
deploy_lambda "davenotes-create-note" "createNote.zip"
deploy_lambda "davenotes-delete-note" "deleteNote.zip"
deploy_lambda "davenotes-upload-file" "uploadFile.zip" "env"

echo -e "${GREEN}✓ All Lambda functions deployed${NC}"
echo ""

# ============================================
# STEP 2: Configure API Gateway
# ============================================
echo "════════════════════════════════════════════"
echo "Step 2: Configuring API Gateway"
echo "════════════════════════════════════════════"
echo ""

# Get root resource
ROOT_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --region $REGION --output json | python3 -c "import sys,json; print(next((r['id'] for r in json.load(sys.stdin)['items'] if r.get('path') == '/'), ''))")

echo "Root resource: $ROOT_ID"

# Create resources
create_resource() {
    local PARENT=$1
    local PATH=$2
    
    # Check if exists
    RESOURCE_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --region $REGION --output json 2>/dev/null | python3 -c "import sys,json; print(next((r['id'] for r in json.load(sys.stdin).get('items', []) if r.get('pathPart') == '$PATH'), ''))")
    
    if [ -z "$RESOURCE_ID" ]; then
        RESOURCE_ID=$(aws apigateway create-resource \
          --rest-api-id "$API_ID" \
          --parent-id "$PARENT" \
          --path-part "$PATH" \
          --region $REGION \
          --output json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('id', ''))")
        echo "  Created /$PATH: $RESOURCE_ID"
    else
        echo "  Found /$PATH: $RESOURCE_ID"
    fi
    
    echo "$RESOURCE_ID"
}

NOTES_ID=$(create_resource "$ROOT_ID" "notes")
NOTEID_ID=$(create_resource "$NOTES_ID" "{noteId}")
UPLOAD_ID=$(create_resource "$ROOT_ID" "upload")

echo ""

# Setup methods
setup_method() {
    local RESOURCE=$1
    local METHOD=$2
    local LAMBDA=$3
    local PATH=$4
    
    echo "→ $METHOD $PATH"
    
    # Create method
    aws apigateway put-method \
      --rest-api-id "$API_ID" \
      --resource-id "$RESOURCE" \
      --http-method "$METHOD" \
      --authorization-type NONE \
      --region $REGION > /dev/null 2>&1
    
    # Create integration
    aws apigateway put-integration \
      --rest-api-id "$API_ID" \
      --resource-id "$RESOURCE" \
      --http-method "$METHOD" \
      --type AWS_PROXY \
      --integration-http-method POST \
      --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA}/invocations" \
      --region $REGION > /dev/null 2>&1
    
    # Add permission
    aws lambda add-permission \
      --function-name "$LAMBDA" \
      --statement-id "api-$(date +%s)-$RANDOM" \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/${METHOD}${PATH}" \
      --region $REGION > /dev/null 2>&1 || true
}

setup_method "$NOTES_ID" "GET" "davenotes-list-notes" "/notes"
setup_method "$NOTES_ID" "POST" "davenotes-create-note" "/notes"
setup_method "$NOTEID_ID" "DELETE" "davenotes-delete-note" "/notes/{noteId}"
setup_method "$UPLOAD_ID" "POST" "davenotes-upload-file" "/upload"

echo -e "${GREEN}✓ API methods configured${NC}"
echo ""

# Enable CORS
echo "Enabling CORS..."
enable_cors() {
    local RESOURCE=$1
    
    aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$RESOURCE" --http-method OPTIONS --authorization-type NONE --region $REGION > /dev/null 2>&1
    aws apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$RESOURCE" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' --region $REGION > /dev/null 2>&1
    aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$RESOURCE" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\": 200}"}' --region $REGION > /dev/null 2>&1
    aws apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$RESOURCE" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' --region $REGION > /dev/null 2>&1
}

enable_cors "$NOTES_ID"
enable_cors "$NOTEID_ID"
enable_cors "$UPLOAD_ID"

echo -e "${GREEN}✓ CORS enabled${NC}"
echo ""

# Deploy API
echo "Deploying API to production..."
aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --stage-name prod \
  --description "Deployment $(date '+%Y-%m-%d %H:%M:%S')" \
  --region $REGION > /dev/null 2>&1

echo -e "${GREEN}✓ API deployed${NC}"
echo ""

# ============================================
# STEP 3: Test API
# ============================================
echo "════════════════════════════════════════════"
echo "Step 3: Testing API"
echo "════════════════════════════════════════════"
echo ""

echo "Testing GET /notes..."
RESPONSE=$(curl -s "$API_ENDPOINT/notes?userId=test")
echo "$RESPONSE" | head -c 100
echo ""

if echo "$RESPONSE" | grep -q "notes"; then
    echo -e "${GREEN}✓ API is working!${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response (check logs)${NC}"
fi

echo ""

# ============================================
# COMPLETE
# ============================================
echo "╔════════════════════════════════════════════╗"
echo "║          Deployment Complete! 🎉           ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}Your API Endpoint:${NC}"
echo "  $API_ENDPOINT"
echo ""
echo -e "${BLUE}Configuration (aws-config.js):${NC}"
cat aws-config.js
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Copy the AWS config above into dave-notes.js"
echo "2. Test locally: python3 -m http.server 8000"
echo "3. Open: http://localhost:8000/dave-notes.html"
echo "4. Login and switch to Cloud mode"
echo "5. Create a test note"
echo "6. Verify in DynamoDB:"
echo "   aws dynamodb scan --table-name DaveNotes --region us-east-2"
echo ""
echo -e "${GREEN}All services deployed and ready!${NC}"
echo ""
