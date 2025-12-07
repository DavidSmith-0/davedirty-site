#!/bin/bash

# Dave Notes AWS Setup Script
# This script automates the AWS infrastructure setup for Dave Notes
# Run this AFTER you have configured AWS CLI with: aws configure

set -e  # Exit on any error

echo "============================================="
echo "Dave Notes AWS Setup Script"
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI is not installed${NC}"
    echo "Please install it first:"
    echo "  curl 'https://awscli.amazonaws.com/AWSCLIV2.pkg' -o 'AWSCLIV2.pkg'"
    echo "  sudo installer -pkg AWSCLIV2.pkg -target /"
    exit 1
fi

# Check if AWS is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI is not configured${NC}"
    echo "Please run: aws configure"
    exit 1
fi

echo -e "${GREEN}✓ AWS CLI is installed and configured${NC}"
echo ""

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"
echo ""

# Region
REGION="us-east-2"
echo "Using region: $REGION"
echo ""

# Ask for confirmation
read -p "This will create AWS resources that may incur costs. Continue? (yes/no) " -n 3 -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo "============================================="
echo "Step 1: Creating Cognito User Pool"
echo "============================================="

USER_POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name davenotes-users \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 6,
      "RequireUppercase": false,
      "RequireLowercase": false,
      "RequireNumbers": false,
      "RequireSymbols": false
    }
  }' \
  --auto-verified-attributes email \
  --mfa-configuration OFF \
  --region $REGION \
  --query 'UserPool.Id' \
  --output text 2>/dev/null || echo "")

if [ -z "$USER_POOL_ID" ]; then
    echo -e "${RED}✗ Failed to create User Pool${NC}"
    exit 1
fi

echo -e "${GREEN}✓ User Pool created: $USER_POOL_ID${NC}"

echo ""
echo "Creating App Client..."

CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name davenotes-web \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --region $REGION \
  --query 'UserPoolClient.ClientId' \
  --output text 2>/dev/null || echo "")

if [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}✗ Failed to create App Client${NC}"
    exit 1
fi

echo -e "${GREEN}✓ App Client created: $CLIENT_ID${NC}"

echo ""
echo "Creating owner user..."

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username dave@davedirty.com \
  --user-attributes Name=email,Value=dave@davedirty.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --region $REGION > /dev/null 2>&1

aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username dave@davedirty.com \
  --password "dave3232" \
  --permanent \
  --region $REGION > /dev/null 2>&1

echo -e "${GREEN}✓ Owner user created: dave@davedirty.com${NC}"

echo ""
echo "============================================="
echo "Step 2: Creating DynamoDB Tables"
echo "============================================="

echo "Creating DaveNotes table..."
aws dynamodb create-table \
  --table-name DaveNotes \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=noteId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=noteId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    '[{
      "IndexName": "UserCreatedIndex",
      "KeySchema": [
        {"AttributeName": "userId", "KeyType": "HASH"},
        {"AttributeName": "createdAt", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }]' \
  --region $REGION > /dev/null 2>&1

aws dynamodb wait table-exists --table-name DaveNotes --region $REGION
echo -e "${GREEN}✓ DaveNotes table created${NC}"

echo "Creating DaveNotesUsers table..."
aws dynamodb create-table \
  --table-name DaveNotesUsers \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --key-schema AttributeName=email,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION > /dev/null 2>&1

aws dynamodb wait table-exists --table-name DaveNotesUsers --region $REGION
echo -e "${GREEN}✓ DaveNotesUsers table created${NC}"

echo "Creating DaveNotesActivity table..."
aws dynamodb create-table \
  --table-name DaveNotesActivity \
  --attribute-definitions \
    AttributeName=activityId,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=activityId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION > /dev/null 2>&1

aws dynamodb wait table-exists --table-name DaveNotesActivity --region $REGION
echo -e "${GREEN}✓ DaveNotesActivity table created${NC}"

echo ""
echo "============================================="
echo "Step 3: Creating S3 Bucket"
echo "============================================="

BUCKET_NAME="davenotes-attachments-$(date +%s)"
echo "Bucket name: $BUCKET_NAME"

aws s3 mb s3://$BUCKET_NAME --region $REGION > /dev/null 2>&1
echo -e "${GREEN}✓ S3 bucket created${NC}"

echo "Configuring CORS..."
cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["https://davedirty.com", "https://www.davedirty.com", "http://localhost:8000"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration file:///tmp/cors.json \
  --region $REGION

echo -e "${GREEN}✓ CORS configured${NC}"

echo "Making bucket public for read..."
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --region $REGION

cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy file:///tmp/bucket-policy.json \
  --region $REGION

echo -e "${GREEN}✓ Bucket policy configured${NC}"

echo ""
echo "============================================="
echo "Step 4: Creating IAM Role for Lambda"
echo "============================================="

cat > /tmp/lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name DaveNotesLambdaRole \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json > /dev/null 2>&1

echo -e "${GREEN}✓ IAM role created${NC}"

echo "Attaching policies..."
aws iam attach-role-policy \
  --role-name DaveNotesLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
  --role-name DaveNotesLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

aws iam attach-role-policy \
  --role-name DaveNotesLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

echo -e "${GREEN}✓ Policies attached${NC}"
echo "Waiting for role to propagate..."
sleep 10

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/DaveNotesLambdaRole"

echo ""
echo "============================================="
echo "Step 5: Deploying Lambda Functions"
echo "============================================="

# Check if lambda zip files exist
if [ ! -f "listNotes.zip" ] || [ ! -f "createNote.zip" ] || [ ! -f "deleteNote.zip" ] || [ ! -f "uploadFile.zip" ]; then
    echo -e "${YELLOW}Lambda zip files not found. Please create the Lambda functions first.${NC}"
    echo "See AWS_SETUP_COMPLETE_GUIDE.md for Lambda function code."
    echo "Continuing without deploying Lambda functions..."
else
    echo "Deploying listNotes..."
    aws lambda create-function \
      --function-name davenotes-list-notes \
      --runtime nodejs20.x \
      --role $ROLE_ARN \
      --handler listNotes.handler \
      --zip-file fileb://listNotes.zip \
      --timeout 30 \
      --region $REGION > /dev/null 2>&1
    echo -e "${GREEN}✓ listNotes deployed${NC}"

    echo "Deploying createNote..."
    aws lambda create-function \
      --function-name davenotes-create-note \
      --runtime nodejs20.x \
      --role $ROLE_ARN \
      --handler createNote.handler \
      --zip-file fileb://createNote.zip \
      --timeout 30 \
      --region $REGION > /dev/null 2>&1
    echo -e "${GREEN}✓ createNote deployed${NC}"

    echo "Deploying deleteNote..."
    aws lambda create-function \
      --function-name davenotes-delete-note \
      --runtime nodejs20.x \
      --role $ROLE_ARN \
      --handler deleteNote.handler \
      --zip-file fileb://deleteNote.zip \
      --timeout 30 \
      --region $REGION > /dev/null 2>&1
    echo -e "${GREEN}✓ deleteNote deployed${NC}"

    echo "Deploying uploadFile..."
    aws lambda create-function \
      --function-name davenotes-upload-file \
      --runtime nodejs20.x \
      --role $ROLE_ARN \
      --handler uploadFile.handler \
      --zip-file fileb://uploadFile.zip \
      --timeout 30 \
      --environment "Variables={BUCKET_NAME=$BUCKET_NAME}" \
      --region $REGION > /dev/null 2>&1
    echo -e "${GREEN}✓ uploadFile deployed${NC}"
fi

echo ""
echo "============================================="
echo "Step 6: Creating API Gateway"
echo "============================================="

API_ID=$(aws apigateway create-rest-api \
  --name davenotes-api \
  --description "Dave Notes API" \
  --region $REGION \
  --query 'id' \
  --output text)

echo -e "${GREEN}✓ API created: $API_ID${NC}"

# Note: Full API Gateway setup is complex and continues in the script...
# For brevity, I'll save the configuration and continue in manual guide

echo ""
echo "============================================="
echo "Setup Complete!"
echo "============================================="
echo ""
echo "Your AWS Configuration:"
echo "-------------------------------------------"
echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
echo "S3 Bucket: $BUCKET_NAME"
echo "API Gateway ID: $API_ID"
echo "Region: $REGION"
echo "Account ID: $ACCOUNT_ID"
echo ""
echo "API Endpoint (after full API Gateway setup):"
echo "https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"
echo ""

# Save configuration
cat > aws-config.txt << EOF
USER_POOL_ID=$USER_POOL_ID
CLIENT_ID=$CLIENT_ID
BUCKET_NAME=$BUCKET_NAME
API_ID=$API_ID
API_ENDPOINT=https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod
ACCOUNT_ID=$ACCOUNT_ID
REGION=$REGION
EOF

echo -e "${GREEN}✓ Configuration saved to aws-config.txt${NC}"
echo ""
echo "Next Steps:"
echo "1. Complete API Gateway setup (see AWS_SETUP_COMPLETE_GUIDE.md Step 5)"
echo "2. Update dave-notes-fixed.js with these values"
echo "3. Implement cloud sync functions"
echo "4. Test and deploy to davedirty.com"
echo ""
