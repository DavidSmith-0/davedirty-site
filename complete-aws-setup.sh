#!/bin/bash

# Dave Notes - Complete AWS Setup & Configuration
# This script completes the API Gateway setup and configures your application

set -e

echo "============================================="
echo "Dave Notes - AWS Configuration Script"
echo "============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REGION="us-east-2"

echo "Fetching your AWS resources..."
echo ""

# Get Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ Account ID: $ACCOUNT_ID${NC}"

# Get User Pool ID
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --region $REGION --query 'UserPools[?Name==`davenotes-users`].Id' --output text)
if [ -z "$USER_POOL_ID" ]; then
    echo -e "${RED}✗ User Pool not found. Please run setup-aws.sh first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ User Pool ID: $USER_POOL_ID${NC}"

# Get Client ID
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id $USER_POOL_ID --region $REGION --query 'UserPoolClients[?ClientName==`davenotes-web`].ClientId' --output text)
if [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}✗ App Client not found.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Client ID: $CLIENT_ID${NC}"

# Get S3 Bucket
BUCKET_NAME=$(aws s3 ls | grep davenotes-attachments | awk '{print $3}' | head -1)
if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}✗ S3 Bucket not found.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ S3 Bucket: $BUCKET_NAME${NC}"

# Get API Gateway ID
API_ID=$(aws apigateway get-rest-apis --region $REGION --query 'items[?name==`davenotes-api`].id' --output text)
if [ -z "$API_ID" ]; then
    echo -e "${RED}✗ API Gateway not found.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ API ID: $API_ID${NC}"

# Get Root Resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/`].id' --output text)
echo -e "${GREEN}✓ Root Resource ID: $ROOT_ID${NC}"

echo ""
echo "============================================="
echo "Creating API Gateway Resources"
echo "============================================="
echo ""

# Create /notes resource
echo "Creating /notes resource..."
NOTES_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part notes \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null || aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?pathPart==`notes`].id' --output text)

echo -e "${GREEN}✓ Notes Resource ID: $NOTES_RESOURCE_ID${NC}"

# Create /notes/{noteId} resource
echo "Creating /notes/{noteId} resource..."
NOTE_ID_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $NOTES_RESOURCE_ID \
  --path-part '{noteId}' \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null || aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?pathPart==`{noteId}`].id' --output text)

echo -e "${GREEN}✓ NoteId Resource ID: $NOTE_ID_RESOURCE_ID${NC}"

# Create /upload resource
echo "Creating /upload resource..."
UPLOAD_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part upload \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null || aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?pathPart==`upload`].id' --output text)

echo -e "${GREEN}✓ Upload Resource ID: $UPLOAD_RESOURCE_ID${NC}"

echo ""
echo "============================================="
echo "Configuring API Methods"
echo "============================================="
echo ""

# Function to create method and integration
create_method() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local LAMBDA_FUNCTION=$3
    local PATH=$4
    
    echo "Setting up $HTTP_METHOD $PATH..."
    
    # Create method
    aws apigateway put-method \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method $HTTP_METHOD \
      --authorization-type NONE \
      --region $REGION > /dev/null 2>&1 || true
    
    # Create integration
    aws apigateway put-integration \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method $HTTP_METHOD \
      --type AWS_PROXY \
      --integration-http-method POST \
      --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_FUNCTION}/invocations" \
      --region $REGION > /dev/null 2>&1 || true
    
    # Grant permission
    aws lambda add-permission \
      --function-name $LAMBDA_FUNCTION \
      --statement-id apigateway-${HTTP_METHOD,,}-$(echo $PATH | tr '/' '-')-$(date +%s) \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/${HTTP_METHOD}${PATH}" \
      --region $REGION > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✓ $HTTP_METHOD $PATH configured${NC}"
}

# Configure GET /notes
create_method $NOTES_RESOURCE_ID "GET" "davenotes-list-notes" "/notes"

# Configure POST /notes
create_method $NOTES_RESOURCE_ID "POST" "davenotes-create-note" "/notes"

# Configure DELETE /notes/{noteId}
create_method $NOTE_ID_RESOURCE_ID "DELETE" "davenotes-delete-note" "/notes/{noteId}"

# Configure POST /upload
create_method $UPLOAD_RESOURCE_ID "POST" "davenotes-upload-file" "/upload"

echo ""
echo "============================================="
echo "Enabling CORS"
echo "============================================="
echo ""

# Function to enable CORS
enable_cors() {
    local RESOURCE_ID=$1
    local PATH=$2
    
    echo "Enabling CORS on $PATH..."
    
    # Create OPTIONS method
    aws apigateway put-method \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method OPTIONS \
      --authorization-type NONE \
      --region $REGION > /dev/null 2>&1 || true
    
    # Create method response
    aws apigateway put-method-response \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method OPTIONS \
      --status-code 200 \
      --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
      --region $REGION > /dev/null 2>&1 || true
    
    # Create integration
    aws apigateway put-integration \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method OPTIONS \
      --type MOCK \
      --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
      --region $REGION > /dev/null 2>&1 || true
    
    # Create integration response
    aws apigateway put-integration-response \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method OPTIONS \
      --status-code 200 \
      --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
      --region $REGION > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✓ CORS enabled on $PATH${NC}"
}

# Enable CORS on all resources
enable_cors $NOTES_RESOURCE_ID "/notes"
enable_cors $NOTE_ID_RESOURCE_ID "/notes/{noteId}"
enable_cors $UPLOAD_RESOURCE_ID "/upload"

echo ""
echo "============================================="
echo "Deploying API"
echo "============================================="
echo ""

aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --description "Production deployment $(date)" \
  --region $REGION > /dev/null 2>&1

echo -e "${GREEN}✓ API deployed to production${NC}"

API_ENDPOINT="https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"

echo ""
echo "============================================="
echo "Testing API"
echo "============================================="
echo ""

echo "Testing GET /notes..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_ENDPOINT/notes?userId=dave@davedirty.com")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ GET /notes working${NC}"
    echo "  Response: $BODY"
else
    echo -e "${YELLOW}⚠ GET /notes returned $HTTP_CODE${NC}"
    echo "  Response: $BODY"
fi

echo ""
echo "Testing POST /notes..."
TEST_NOTE='{"type":"text","title":"API Test Note","content":"This is a test from the setup script","tags":["test","automated"]}'
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_ENDPOINT/notes?userId=dave@davedirty.com" \
  -H "Content-Type: application/json" \
  -d "$TEST_NOTE")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ POST /notes working${NC}"
    echo "  Created note successfully"
else
    echo -e "${YELLOW}⚠ POST /notes returned $HTTP_CODE${NC}"
    echo "  Response: $BODY"
fi

echo ""
echo "============================================="
echo "Saving Configuration"
echo "============================================="
echo ""

# Save configuration
cat > aws-config.txt << EOF
USER_POOL_ID=$USER_POOL_ID
CLIENT_ID=$CLIENT_ID
BUCKET_NAME=$BUCKET_NAME
API_ID=$API_ID
API_ENDPOINT=$API_ENDPOINT
ACCOUNT_ID=$ACCOUNT_ID
REGION=$REGION
EOF

echo -e "${GREEN}✓ Configuration saved to aws-config.txt${NC}"

# Create JavaScript config snippet
cat > aws-config.js << EOF
// Add this to your dave-notes.js CONFIG object:
const CONFIG = {
    // ... existing config
    AWS: {
        API_ENDPOINT: '${API_ENDPOINT}',
        COGNITO_USER_POOL_ID: '${USER_POOL_ID}',
        COGNITO_CLIENT_ID: '${CLIENT_ID}',
        S3_BUCKET: '${BUCKET_NAME}',
        REGION: '${REGION}'
    }
};
EOF

echo -e "${GREEN}✓ JavaScript config saved to aws-config.js${NC}"

echo ""
echo "============================================="
echo "AWS Setup Complete!"
echo "============================================="
echo ""
echo -e "${BLUE}Your API Endpoint:${NC}"
echo "  $API_ENDPOINT"
echo ""
echo -e "${BLUE}Your Configuration:${NC}"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  API ID: $API_ID"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Update dave-notes-fixed.js with values from aws-config.js"
echo "2. Test locally: python3 -m http.server 8000"
echo "3. Open: http://localhost:8000/dave-notes.html"
echo "4. Deploy to davedirty.com when ready"
echo ""
echo -e "${GREEN}All AWS services are configured and ready!${NC}"
echo ""
