# AWS Cloud Integration - Complete Step-by-Step Guide for Dave Notes

## Prerequisites Setup

### Step 1: Install AWS CLI

**On Mac (recommended method):**

```bash
# Download the installer
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"

# Install it
sudo installer -pkg AWSCLIV2.pkg -target /

# Verify installation
aws --version
# Should show: aws-cli/2.x.x ...
```

**Alternative - using Homebrew (if you have it):**
```bash
brew install awscli
```

### Step 2: Configure AWS CLI with Your Credentials

```bash
aws configure
```

You'll be prompted for:
- **AWS Access Key ID**: [Get from AWS Console → IAM → Users → Security credentials]
- **AWS Secret Access Key**: [Same location]
- **Default region name**: `us-east-2`
- **Default output format**: `json`

**To get AWS credentials:**
1. Go to https://console.aws.amazon.com/
2. Sign in to your AWS account
3. Go to IAM → Users → Your user → Security credentials
4. Click "Create access key"
5. Save the Access Key ID and Secret Access Key (you can't see the secret again!)

### Step 3: Verify AWS Access

```bash
# Test your credentials
aws sts get-caller-identity

# Should return your account details
```

---

## Part 1: Amazon Cognito Setup (User Authentication)

### Step 1.1: Create User Pool

```bash
aws cognito-idp create-user-pool \
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
  --region us-east-2
```

**IMPORTANT:** Save the output! You need the `UserPoolId` (looks like: `us-east-2_XXXXXXXXX`)

Let's save it to a variable:
```bash
# Copy the Id from the output and paste it here:
USER_POOL_ID="us-east-2_XXXXXXXXX"  # REPLACE with your actual ID
```

### Step 1.2: Create App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name davenotes-web \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --region us-east-2
```

**IMPORTANT:** Save the `ClientId` from the output

```bash
# Copy the ClientId from the output:
CLIENT_ID="abc123def456..."  # REPLACE with your actual Client ID
```

### Step 1.3: Create Owner User in Cognito

```bash
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username dave@davedirty.com \
  --user-attributes Name=email,Value=dave@davedirty.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --region us-east-2

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username dave@davedirty.com \
  --password "dave3232" \
  --permanent \
  --region us-east-2
```

---

## Part 2: DynamoDB Tables Setup

### Step 2.1: Create Notes Table

```bash
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
  --region us-east-2
```

Wait for table to be created:
```bash
aws dynamodb wait table-exists --table-name DaveNotes --region us-east-2
echo "DaveNotes table is ready!"
```

### Step 2.2: Create Users Table

```bash
aws dynamodb create-table \
  --table-name DaveNotesUsers \
  --attribute-definitions \
    AttributeName=email,AttributeType=S \
  --key-schema \
    AttributeName=email,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2

aws dynamodb wait table-exists --table-name DaveNotesUsers --region us-east-2
echo "DaveNotesUsers table is ready!"
```

### Step 2.3: Create Activity Log Table

```bash
aws dynamodb create-table \
  --table-name DaveNotesActivity \
  --attribute-definitions \
    AttributeName=activityId,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=activityId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2

aws dynamodb wait table-exists --table-name DaveNotesActivity --region us-east-2
echo "DaveNotesActivity table is ready!"
```

### Step 2.4: Verify Tables

```bash
aws dynamodb list-tables --region us-east-2
# Should show all three tables
```

---

## Part 3: S3 Bucket Setup

### Step 3.1: Create Bucket

```bash
# Note: S3 bucket names must be globally unique
# If 'davenotes-attachments' is taken, try: davenotes-attachments-dave or similar

aws s3 mb s3://davenotes-attachments --region us-east-2

# If that fails (name taken), try:
# aws s3 mb s3://davenotes-attachments-$(date +%s) --region us-east-2
# Then update BUCKET_NAME variable below
```

```bash
BUCKET_NAME="davenotes-attachments"  # REPLACE if you used a different name
```

### Step 3.2: Configure CORS

Create a file called `cors.json`:

```bash
cat > cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": [
        "https://davedirty.com",
        "https://www.davedirty.com",
        "http://localhost:8000"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration file://cors.json \
  --region us-east-2
```

### Step 3.3: Make Bucket Public for Read Access

```bash
cat > bucket-policy.json << EOF
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

# Disable block public access
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --region us-east-2

# Apply bucket policy
aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy file://bucket-policy.json \
  --region us-east-2
```

---

## Part 4: Lambda Functions Setup

### Step 4.1: Create IAM Role for Lambda

```bash
cat > lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name DaveNotesLambdaRole \
  --assume-role-policy-document file://lambda-trust-policy.json

# Wait a moment for the role to propagate
sleep 5
```

### Step 4.2: Attach Policies to Role

```bash
# Basic Lambda execution (for CloudWatch Logs)
aws iam attach-role-policy \
  --role-name DaveNotesLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# DynamoDB access
aws iam attach-role-policy \
  --role-name DaveNotesLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# S3 access
aws iam attach-role-policy \
  --role-name DaveNotesLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Wait for policies to attach
sleep 10
```

### Step 4.3: Get Your AWS Account ID

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Your AWS Account ID: $ACCOUNT_ID"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/DaveNotesLambdaRole"
echo "Lambda Role ARN: $ROLE_ARN"
```

### Step 4.4: Create Lambda Functions

I'll provide the Lambda function code files. Create these files:

**File 1: listNotes.mjs**

```bash
cat > listNotes.mjs << 'EOF'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    console.log('Event:', JSON.stringify(event));
    
    // Get userId from Cognito authorizer or from path/query
    const userId = event.requestContext?.authorizer?.claims?.email || 
                   event.queryStringParameters?.userId;
    
    if (!userId) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "userId required" })
        };
    }
    
    try {
        const command = new QueryCommand({
            TableName: "DaveNotes",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId
            },
            ScanIndexForward: false
        });
        
        const response = await docClient.send(command);
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                notes: response.Items || [],
                count: response.Count || 0
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
EOF
```

**File 2: createNote.mjs**

```bash
cat > createNote.mjs << 'EOF'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    console.log('Event:', JSON.stringify(event));
    
    const userId = event.requestContext?.authorizer?.claims?.email || 
                   event.queryStringParameters?.userId;
    
    if (!userId) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "userId required" })
        };
    }
    
    let note;
    try {
        note = JSON.parse(event.body);
    } catch (e) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "Invalid JSON in body" })
        };
    }
    
    try {
        note.userId = userId;
        note.updatedAt = new Date().toISOString();
        
        if (!note.noteId) {
            note.noteId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            note.createdAt = note.updatedAt;
        }
        
        const command = new PutCommand({
            TableName: "DaveNotes",
            Item: note
        });
        
        await docClient.send(command);
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                success: true,
                note: note 
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
EOF
```

**File 3: deleteNote.mjs**

```bash
cat > deleteNote.mjs << 'EOF'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    console.log('Event:', JSON.stringify(event));
    
    const userId = event.requestContext?.authorizer?.claims?.email || 
                   event.queryStringParameters?.userId;
    const noteId = event.pathParameters?.noteId;
    
    if (!userId || !noteId) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "userId and noteId required" })
        };
    }
    
    try {
        const command = new DeleteCommand({
            TableName: "DaveNotes",
            Key: { userId, noteId }
        });
        
        await docClient.send(command);
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
EOF
```

**File 4: uploadFile.mjs**

```bash
cat > uploadFile.mjs << 'EOF'
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: "us-east-2" });
const BUCKET_NAME = process.env.BUCKET_NAME || "davenotes-attachments";

export const handler = async (event) => {
    console.log('Event:', JSON.stringify(event));
    
    const userId = event.requestContext?.authorizer?.claims?.email || 
                   event.queryStringParameters?.userId || 'anonymous';
    
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "Invalid JSON" })
        };
    }
    
    const { fileName, fileType } = body;
    
    if (!fileName || !fileType) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "fileName and fileType required" })
        };
    }
    
    try {
        const key = `${userId}/${Date.now()}-${fileName}`;
        
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: fileType
        });
        
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const fileUrl = `https://${BUCKET_NAME}.s3.us-east-2.amazonaws.com/${key}`;
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                uploadUrl,
                fileUrl,
                key
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
EOF
```

### Step 4.5: Create Deployment Packages

```bash
# For each function, we need to create a zip file

# listNotes
zip listNotes.zip listNotes.mjs

# createNote  
zip createNote.zip createNote.mjs

# deleteNote
zip deleteNote.zip deleteNote.mjs

# uploadFile (needs bucket name env var)
zip uploadFile.zip uploadFile.mjs
```

### Step 4.6: Deploy Lambda Functions

```bash
# Deploy listNotes
aws lambda create-function \
  --function-name davenotes-list-notes \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler listNotes.handler \
  --zip-file fileb://listNotes.zip \
  --timeout 30 \
  --region us-east-2

# Deploy createNote
aws lambda create-function \
  --function-name davenotes-create-note \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler createNote.handler \
  --zip-file fileb://createNote.zip \
  --timeout 30 \
  --region us-east-2

# Deploy deleteNote
aws lambda create-function \
  --function-name davenotes-delete-note \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler deleteNote.handler \
  --zip-file fileb://deleteNote.zip \
  --timeout 30 \
  --region us-east-2

# Deploy uploadFile (with environment variable)
aws lambda create-function \
  --function-name davenotes-upload-file \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler uploadFile.handler \
  --zip-file fileb://uploadFile.zip \
  --timeout 30 \
  --environment "Variables={BUCKET_NAME=$BUCKET_NAME}" \
  --region us-east-2
```

### Step 4.7: Verify Lambda Functions

```bash
aws lambda list-functions --region us-east-2 | grep davenotes
```

---

## Part 5: API Gateway Setup

This is the most complex part. We'll create a REST API and configure it.

### Step 5.1: Create REST API

```bash
API_ID=$(aws apigateway create-rest-api \
  --name davenotes-api \
  --description "Dave Notes API" \
  --region us-east-2 \
  --query 'id' \
  --output text)

echo "API ID: $API_ID"
```

### Step 5.2: Get Root Resource ID

```bash
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region us-east-2 \
  --query 'items[0].id' \
  --output text)

echo "Root Resource ID: $ROOT_ID"
```

### Step 5.3: Create Cognito Authorizer

```bash
AUTHORIZER_ID=$(aws apigateway create-authorizer \
  --rest-api-id $API_ID \
  --name davenotes-cognito-auth \
  --type COGNITO_USER_POOLS \
  --provider-arns "arn:aws:cognito-idp:us-east-2:${ACCOUNT_ID}:userpool/${USER_POOL_ID}" \
  --identity-source 'method.request.header.Authorization' \
  --region us-east-2 \
  --query 'id' \
  --output text)

echo "Authorizer ID: $AUTHORIZER_ID"
```

### Step 5.4: Create /notes Resource

```bash
NOTES_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part notes \
  --region us-east-2 \
  --query 'id' \
  --output text)

echo "Notes Resource ID: $NOTES_RESOURCE_ID"
```

### Step 5.5: Create /notes/{noteId} Resource

```bash
NOTE_ID_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $NOTES_RESOURCE_ID \
  --path-part '{noteId}' \
  --region us-east-2 \
  --query 'id' \
  --output text)

echo "NoteId Resource ID: $NOTE_ID_RESOURCE_ID"
```

### Step 5.6: Create /upload Resource

```bash
UPLOAD_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part upload \
  --region us-east-2 \
  --query 'id' \
  --output text)

echo "Upload Resource ID: $UPLOAD_RESOURCE_ID"
```

### Step 5.7: Configure GET /notes Method

```bash
# Create GET method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $NOTES_RESOURCE_ID \
  --http-method GET \
  --authorization-type NONE \
  --region us-east-2

# Integrate with Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $NOTES_RESOURCE_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:${ACCOUNT_ID}:function:davenotes-list-notes/invocations" \
  --region us-east-2

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
  --function-name davenotes-list-notes \
  --statement-id apigateway-get-notes \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-2:${ACCOUNT_ID}:${API_ID}/*/GET/notes" \
  --region us-east-2
```

### Step 5.8: Configure POST /notes Method

```bash
# Create POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $NOTES_RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE \
  --region us-east-2

# Integrate with Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $NOTES_RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:${ACCOUNT_ID}:function:davenotes-create-note/invocations" \
  --region us-east-2

# Grant permission
aws lambda add-permission \
  --function-name davenotes-create-note \
  --statement-id apigateway-post-notes \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-2:${ACCOUNT_ID}:${API_ID}/*/POST/notes" \
  --region us-east-2
```

### Step 5.9: Configure DELETE /notes/{noteId} Method

```bash
# Create DELETE method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $NOTE_ID_RESOURCE_ID \
  --http-method DELETE \
  --authorization-type NONE \
  --region us-east-2

# Integrate with Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $NOTE_ID_RESOURCE_ID \
  --http-method DELETE \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:${ACCOUNT_ID}:function:davenotes-delete-note/invocations" \
  --region us-east-2

# Grant permission
aws lambda add-permission \
  --function-name davenotes-delete-note \
  --statement-id apigateway-delete-note \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-2:${ACCOUNT_ID}:${API_ID}/*/DELETE/notes/*" \
  --region us-east-2
```

### Step 5.10: Configure POST /upload Method

```bash
# Create POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $UPLOAD_RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE \
  --region us-east-2

# Integrate with Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $UPLOAD_RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:${ACCOUNT_ID}:function:davenotes-upload-file/invocations" \
  --region us-east-2

# Grant permission
aws lambda add-permission \
  --function-name davenotes-upload-file \
  --statement-id apigateway-post-upload \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-2:${ACCOUNT_ID}:${API_ID}/*/POST/upload" \
  --region us-east-2
```

### Step 5.11: Enable CORS (Important!)

For EACH resource, we need to add OPTIONS method:

```bash
# Function to enable CORS on a resource
enable_cors() {
  local RESOURCE_ID=$1
  
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region us-east-2
  
  aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
    --region us-east-2
  
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
    --region us-east-2
  
  aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    --region us-east-2
}

# Enable CORS on all resources
enable_cors $NOTES_RESOURCE_ID
enable_cors $NOTE_ID_RESOURCE_ID
enable_cors $UPLOAD_RESOURCE_ID
```

### Step 5.12: Deploy API

```bash
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --description "Production deployment" \
  --region us-east-2

echo ""
echo "============================================="
echo "API GATEWAY DEPLOYED!"
echo "============================================="
echo ""
echo "Your API Endpoint:"
echo "https://${API_ID}.execute-api.us-east-2.amazonaws.com/prod"
echo ""
```

---

## Part 6: Update Dave Notes Application

### Step 6.1: Save All Your Configuration

```bash
cat > aws-config.txt << EOF
USER_POOL_ID=$USER_POOL_ID
CLIENT_ID=$CLIENT_ID
BUCKET_NAME=$BUCKET_NAME
API_ENDPOINT=https://${API_ID}.execute-api.us-east-2.amazonaws.com/prod
ACCOUNT_ID=$ACCOUNT_ID
REGION=us-east-2
EOF

echo "Configuration saved to aws-config.txt"
cat aws-config.txt
```

### Step 6.2: Update dave-notes-fixed.js

Open `dave-notes-fixed.js` and update the CONFIG section:

```javascript
const CONFIG = {
    VERSION: '2.0.0',
    STORAGE_PREFIX: 'davenotes_',
    OWNER_EMAIL: 'dave@davedirty.com',
    OWNER_PASSWORD: 'dave3232',
    DEFAULT_QUOTA_GB: 5,
    MAX_UPLOAD_MB: 20,
    ROLES: { OWNER: 'owner', ADMIN: 'admin', USER: 'user' },
    STORAGE_MODES: { LOCAL: 'local', CLOUD: 'cloud' },
    AWS: {
        API_ENDPOINT: 'https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/prod',
        COGNITO_USER_POOL_ID: 'us-east-2_XXXXXXXXX',
        COGNITO_CLIENT_ID: 'your-client-id',
        S3_BUCKET: 'davenotes-attachments',
        REGION: 'us-east-2'
    }
};
```

Replace the values with your actual values from `aws-config.txt`.

---

## Part 7: Test Your Setup

### Step 7.1: Test DynamoDB

```bash
# List notes for dave@davedirty.com (should be empty)
aws dynamodb query \
  --table-name DaveNotes \
  --key-condition-expression "userId = :userId" \
  --expression-attribute-values '{":userId":{"S":"dave@davedirty.com"}}' \
  --region us-east-2
```

### Step 7.2: Test API Endpoint

```bash
# Test GET /notes
curl "https://${API_ID}.execute-api.us-east-2.amazonaws.com/prod/notes?userId=dave@davedirty.com"

# Should return: {"notes":[],"count":0}
```

### Step 7.3: Test Creating a Note

```bash
curl -X POST \
  "https://${API_ID}.execute-api.us-east-2.amazonaws.com/prod/notes?userId=dave@davedirty.com" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "title": "Test Note",
    "content": "This is a test note from the API",
    "tags": ["test"]
  }'
```

---

## Summary

After completing all these steps, you will have:

✅ **Cognito User Pool** - for authentication  
✅ **DynamoDB Tables** - for storing notes, users, and activity  
✅ **S3 Bucket** - for storing file attachments  
✅ **Lambda Functions** - for API logic  
✅ **API Gateway** - for HTTPS endpoints  

Your API endpoint will be:
```
https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/prod
```

## Next Steps

1. Update `dave-notes-fixed.js` with your AWS configuration
2. Implement the cloud sync functions in the JavaScript
3. Test locally first
4. Deploy to davedirty.com
5. Test cloud features

## Troubleshooting

If something doesn't work:

1. **Check CloudWatch Logs:**
   ```bash
   aws logs tail /aws/lambda/davenotes-list-notes --follow --region us-east-2
   ```

2. **Test Lambda directly:**
   ```bash
   aws lambda invoke \
     --function-name davenotes-list-notes \
     --payload '{"queryStringParameters":{"userId":"dave@davedirty.com"}}' \
     --region us-east-2 \
     output.json
   cat output.json
   ```

3. **Check API Gateway:**
   - Go to AWS Console → API Gateway
   - Check method integrations
   - Check CORS configuration
   - Check logs

---

**You're ready to set up AWS! Follow these steps in order, and you'll have a fully cloud-enabled Dave Notes application!**
