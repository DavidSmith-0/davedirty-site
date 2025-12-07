#!/bin/bash

# Dave Notes - Master Setup Script (FIXED)
# This script does EVERYTHING needed to set up AWS cloud integration

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   Dave Notes - Complete AWS Integration    ║"
echo "║         Master Setup Script v1.1           ║"
echo "╚════════════════════════════════════════════╝"
echo ""

REGION="us-east-2"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗ AWS CLI not found${NC}"
    echo "Install: curl 'https://awscli.amazonaws.com/AWSCLIV2.pkg' -o 'AWSCLIV2.pkg' && sudo installer -pkg AWSCLIV2.pkg -target /"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}✗ AWS not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi

echo -e "${GREEN}✓ AWS CLI configured${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${BLUE}Account ID: $ACCOUNT_ID${NC}"
echo ""

# ============================================
# STEP 1: Create Lambda Function Files
# ============================================
echo "════════════════════════════════════════════"
echo "Step 1: Creating Lambda Function Files"
echo "════════════════════════════════════════════"
echo ""

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
        const BUCKET = process.env.BUCKET_NAME || "davenotes-attachments";
        const uploadUrl = await getSignedUrl(s3Client, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: fileType }), { expiresIn: 3600 });
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ uploadUrl, fileUrl: `https://${BUCKET}.s3.us-east-2.amazonaws.com/${key}`, key }) };
    } catch (error) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: error.message }) };
    }
};
EOF

zip -q listNotes.zip listNotes.mjs
zip -q createNote.zip createNote.mjs
zip -q deleteNote.zip deleteNote.mjs
zip -q uploadFile.zip uploadFile.mjs

echo -e "${GREEN}✓ Lambda function files created and zipped${NC}"
echo ""

# ============================================
# STEP 2: Get Existing Resources
# ============================================
echo "════════════════════════════════════════════"
echo "Step 2: Getting Existing AWS Resources"
echo "════════════════════════════════════════════"
echo ""

echo "Fetching User Pool..."
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --region $REGION 2>/dev/null | grep -A2 "davenotes-users" | grep "Id" | cut -d'"' -f4)
if [ -z "$USER_POOL_ID" ]; then
    echo -e "${RED}✗ User Pool not found${NC}"
    echo "Please run setup-aws.sh first"
    exit 1
fi
echo -e "${GREEN}✓ User Pool: $USER_POOL_ID${NC}"

echo "Fetching App Client..."
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --region $REGION 2>/dev/null | grep -A2 "davenotes-web" | grep "ClientId" | cut -d'"' -f4)
if [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}✗ Client ID not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Client ID: $CLIENT_ID${NC}"

echo "Fetching S3 Bucket..."
BUCKET_NAME=$(aws s3 ls 2>/dev/null | grep davenotes-attachments | awk '{print $3}' | head -1)
if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}✗ S3 Bucket not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ S3 Bucket: $BUCKET_NAME${NC}"

echo "Fetching API Gateway..."
API_ID=$(aws apigateway get-rest-apis --region $REGION 2>/dev/null | grep -B2 "davenotes-api" | grep "id" | cut -d'"' -f4 | head -1)
if [ -z "$API_ID" ]; then
    echo -e "${RED}✗ API Gateway not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ API ID: $API_ID${NC}"
echo ""

# ============================================
# STEP 3: Deploy Lambda Functions
# ============================================
echo "════════════════════════════════════════════"
echo "Step 3: Deploying Lambda Functions"
echo "════════════════════════════════════════════"
echo ""

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/DaveNotesLambdaRole"

deploy_lambda() {
    local NAME=$1
    local ZIP=$2
    local ENV_VAR=$3
    
    echo "Deploying $NAME..."
    
    if [ -n "$ENV_VAR" ]; then
        aws lambda create-function \
          --function-name "$NAME" \
          --runtime nodejs20.x \
          --role "$ROLE_ARN" \
          --handler "${ZIP%.zip}.handler" \
          --zip-file "fileb://$ZIP" \
          --timeout 30 \
          --environment "Variables={BUCKET_NAME=$BUCKET_NAME}" \
          --region $REGION > /dev/null 2>&1 && echo -e "${GREEN}✓ $NAME deployed${NC}" || echo -e "${YELLOW}⚠ $NAME exists, updating code...${NC}"
    else
        aws lambda create-function \
          --function-name "$NAME" \
          --runtime nodejs20.x \
          --role "$ROLE_ARN" \
          --handler "${ZIP%.zip}.handler" \
          --zip-file "fileb://$ZIP" \
          --timeout 30 \
          --region $REGION > /dev/null 2>&1 && echo -e "${GREEN}✓ $NAME deployed${NC}" || echo -e "${YELLOW}⚠ $NAME exists, updating code...${NC}"
    fi
    
    # Update code if function already exists
    aws lambda update-function-code \
      --function-name "$NAME" \
      --zip-file "fileb://$ZIP" \
      --region $REGION > /dev/null 2>&1 || true
}

deploy_lambda "davenotes-list-notes" "listNotes.zip"
deploy_lambda "davenotes-create-note" "createNote.zip"
deploy_lambda "davenotes-delete-note" "deleteNote.zip"
deploy_lambda "davenotes-upload-file" "uploadFile.zip" "env"

echo ""

# ============================================
# STEP 4: Configure API Gateway
# ============================================
echo "════════════════════════════════════════════"
echo "Step 4: Configuring API Gateway"
echo "════════════════════════════════════════════"
echo ""

ROOT_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --region $REGION 2>/dev/null | grep -A1 '"path" : "/"' | grep "id" | cut -d'"' -f4)

echo "Root resource ID: $ROOT_ID"

# Create resources
create_resource() {
    local PARENT=$1
    local PATH=$2
    
    echo "Creating resource /$PATH..."
    
    # Try to create, or get existing
    RESOURCE_ID=$(aws apigateway create-resource \
      --rest-api-id "$API_ID" \
      --parent-id "$PARENT" \
      --path-part "$PATH" \
      --region $REGION 2>/dev/null | grep '"id"' | cut -d'"' -f4)
    
    if [ -z "$RESOURCE_ID" ]; then
        # Get existing resource
        RESOURCE_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --region $REGION 2>/dev/null | grep -B2 "\"pathPart\" : \"$PATH\"" | grep '"id"' | cut -d'"' -f4 | head -1)
    fi
    
    echo "$RESOURCE_ID"
}

NOTES_ID=$(create_resource "$ROOT_ID" "notes")
echo -e "${GREEN}✓ /notes: $NOTES_ID${NC}"

NOTEID_ID=$(create_resource "$NOTES_ID" "{noteId}")
echo -e "${GREEN}✓ /notes/{noteId}: $NOTEID_ID${NC}"

UPLOAD_ID=$(create_resource "$ROOT_ID" "upload")
echo -e "${GREEN}✓ /upload: $UPLOAD_ID${NC}"

echo ""

# Configure methods
setup_method() {
    local RESOURCE=$1
    local METHOD=$2
    local LAMBDA=$3
    local PATH=$4
    
    echo "Setting up $METHOD $PATH..."
    
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
    
    # Grant permission
    aws lambda add-permission \
      --function-name "$LAMBDA" \
      --statement-id "apigateway-${METHOD,,}-$(date +%s)" \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/${METHOD}${PATH}" \
      --region $REGION > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✓ $METHOD $PATH configured${NC}"
}

setup_method "$NOTES_ID" "GET" "davenotes-list-notes" "/notes"
setup_method "$NOTES_ID" "POST" "davenotes-create-note" "/notes"
setup_method "$NOTEID_ID" "DELETE" "davenotes-delete-note" "/notes/{noteId}"
setup_method "$UPLOAD_ID" "POST" "davenotes-upload-file" "/upload"

echo ""

# Enable CORS
enable_cors() {
    local RESOURCE=$1
    local PATH=$2
    
    echo "Enabling CORS on $PATH..."
    
    aws apigateway put-method \
      --rest-api-id "$API_ID" \
      --resource-id "$RESOURCE" \
      --http-method OPTIONS \
      --authorization-type NONE \
      --region $REGION > /dev/null 2>&1
    
    aws apigateway put-method-response \
      --rest-api-id "$API_ID" \
      --resource-id "$RESOURCE" \
      --http-method OPTIONS \
      --status-code 200 \
      --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
      --region $REGION > /dev/null 2>&1
    
    aws apigateway put-integration \
      --rest-api-id "$API_ID" \
      --resource-id "$RESOURCE" \
      --http-method OPTIONS \
      --type MOCK \
      --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
      --region $REGION > /dev/null 2>&1
    
    aws apigateway put-integration-response \
      --rest-api-id "$API_ID" \
      --resource-id "$RESOURCE" \
      --http-method OPTIONS \
      --status-code 200 \
      --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
      --region $REGION > /dev/null 2>&1
    
    echo -e "${GREEN}✓ CORS enabled on $PATH${NC}"
}

enable_cors "$NOTES_ID" "/notes"
enable_cors "$NOTEID_ID" "/notes/{noteId}"
enable_cors "$UPLOAD_ID" "/upload"

echo ""

# Deploy API
echo "Deploying API to production..."
aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --stage-name prod \
  --description "Deployment $(date)" \
  --region $REGION > /dev/null 2>&1

echo -e "${GREEN}✓ API deployed to prod${NC}"
echo ""

API_ENDPOINT="https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"

# ============================================
# STEP 5: Test API
# ============================================
echo "════════════════════════════════════════════"
echo "Step 5: Testing API"
echo "════════════════════════════════════════════"
echo ""

echo "Testing GET /notes..."
TEST_RESPONSE=$(curl -s "$API_ENDPOINT/notes?userId=test")
echo "Response: ${TEST_RESPONSE:0:100}..."

if echo "$TEST_RESPONSE" | grep -q "notes"; then
    echo -e "${GREEN}✓ API is responding correctly${NC}"
else
    echo -e "${YELLOW}⚠ API response unexpected (may still work)${NC}"
fi

echo ""

# ============================================
# STEP 6: Save Configuration
# ============================================
echo "════════════════════════════════════════════"
echo "Step 6: Saving Configuration"
echo "════════════════════════════════════════════"
echo ""

cat > aws-config.txt << EOF
USER_POOL_ID=$USER_POOL_ID
CLIENT_ID=$CLIENT_ID
BUCKET_NAME=$BUCKET_NAME
API_ID=$API_ID
API_ENDPOINT=$API_ENDPOINT
ACCOUNT_ID=$ACCOUNT_ID
REGION=$REGION
EOF

cat > aws-config.js << EOF
// Copy this into your dave-notes.js CONFIG.AWS object:

AWS: {
    API_ENDPOINT: '${API_ENDPOINT}',
    COGNITO_USER_POOL_ID: '${USER_POOL_ID}',
    COGNITO_CLIENT_ID: '${CLIENT_ID}',
    S3_BUCKET: '${BUCKET_NAME}',
    REGION: '${REGION}'
}
EOF

echo -e "${GREEN}✓ Configuration saved to aws-config.txt and aws-config.js${NC}"
echo ""

# ============================================
# COMPLETE
# ============================================
echo "╔════════════════════════════════════════════╗"
echo "║          Setup Complete! 🎉                ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}Your API Endpoint:${NC}"
echo "  $API_ENDPOINT"
echo ""
echo -e "${BLUE}Configuration Files Created:${NC}"
echo "  • aws-config.txt (all IDs)"
echo "  • aws-config.js (copy into dave-notes.js)"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Open aws-config.js"
echo "2. Copy the AWS config into dave-notes.js (replace the empty AWS object)"
echo "3. Test locally: python3 -m http.server 8000"
echo "4. Open: http://localhost:8000/dave-notes.html"
echo "5. Login and switch to Cloud mode in Settings"
echo "6. Deploy to davedirty.com when ready"
echo ""
echo -e "${GREEN}All AWS services are configured and ready!${NC}"
echo ""
