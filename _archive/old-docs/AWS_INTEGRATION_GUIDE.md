# AWS Integration Guide for Dave Notes

## Overview
This guide provides step-by-step instructions for integrating Dave Notes with AWS cloud services.

## Architecture

```
┌─────────────┐
│   Browser   │
│ (dave-notes)│
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  API Gateway    │ (HTTPS REST API)
└──────┬──────────┘
       │
       ├──────────┐
       │          ▼
       │    ┌─────────────┐
       │    │  Cognito    │ (Authentication)
       │    └─────────────┘
       │
       ▼
┌─────────────────┐
│  Lambda Funcs   │
└──────┬──────────┘
       │
       ├──────────┬──────────┐
       ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌────────┐
│ DynamoDB │ │   S3   │ │ CloudW │
│  (Notes) │ │(Files) │ │ (Logs) │
└──────────┘ └────────┘ └────────┘
```

## Step 1: AWS Cognito Setup

### 1.1 Create User Pool

```bash
# Using AWS CLI
aws cognito-idp create-user-pool \
  --pool-name davenotes-users \
  --policies "PasswordPolicy={MinimumLength=6,RequireUppercase=false,RequireLowercase=false,RequireNumbers=false,RequireSymbols=false}" \
  --auto-verified-attributes email \
  --mfa-configuration OFF \
  --region us-east-2
```

### 1.2 Create App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --client-name davenotes-web \
  --no-generate-secret \
  --region us-east-2
```

### 1.3 Update CONFIG in dave-notes.js

```javascript
AWS: {
    COGNITO_USER_POOL_ID: 'us-east-2_XXXXXXXXX',
    COGNITO_CLIENT_ID: 'abc123def456...',
    REGION: 'us-east-2'
}
```

## Step 2: DynamoDB Tables

### 2.1 Notes Table

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
      "IndexName=UserCreatedIndex,KeySchema=[{AttributeName=userId,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
  --region us-east-2
```

**Schema:**
```
{
  userId: String (HASH),
  noteId: String (RANGE),
  type: String,
  title: String,
  content: String,
  tags: List<String>,
  starred: Boolean,
  createdAt: String (ISO),
  updatedAt: String (ISO),
  audioUrl: String (optional),
  imageUrl: String (optional),
  attachments: List<Object>
}
```

### 2.2 Users Table

```bash
aws dynamodb create-table \
  --table-name DaveNotesUsers \
  --attribute-definitions \
      AttributeName=email,AttributeType=S \
  --key-schema \
      AttributeName=email,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2
```

**Schema:**
```
{
  email: String (HASH),
  displayName: String,
  role: String,
  status: String,
  quotaLimitBytes: Number,
  usedBytes: Number,
  createdAt: String,
  lastActiveAt: String
}
```

### 2.3 Activity Log Table

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
```

## Step 3: S3 Bucket

### 3.1 Create Bucket

```bash
aws s3 mb s3://davenotes-attachments --region us-east-2
```

### 3.2 Configure CORS

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["https://davedirty.com", "https://www.davedirty.com"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

Save as `cors.json`, then:
```bash
aws s3api put-bucket-cors --bucket davenotes-attachments --cors-configuration file://cors.json
```

### 3.3 Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::davenotes-attachments/*"
    }
  ]
}
```

## Step 4: Lambda Functions

### 4.1 Create IAM Role

```bash
aws iam create-role \
  --role-name DaveNotesLambdaRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```

### 4.2 Attach Policies

```bash
aws iam attach-role-policy \
  --role-name DaveNotesLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
  --role-name DaveNotesLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

aws iam attach-role-policy \
  --role-name DaveNotesLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

### 4.3 Lambda Function: List Notes

Create `listNotes.mjs`:

```javascript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    const userId = event.requestContext.authorizer.claims.email;
    
    try {
        const command = new QueryCommand({
            TableName: "DaveNotes",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId
            },
            ScanIndexForward: false // newest first
        });
        
        const response = await docClient.send(command);
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify({ notes: response.Items || [] })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
```

Deploy:
```bash
zip listNotes.zip listNotes.mjs
aws lambda create-function \
  --function-name davenotes-list-notes \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT_ID:role/DaveNotesLambdaRole \
  --handler listNotes.handler \
  --zip-file fileb://listNotes.zip \
  --region us-east-2
```

### 4.4 Lambda Function: Create/Update Note

Create `createNote.mjs`:

```javascript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    const userId = event.requestContext.authorizer.claims.email;
    const note = JSON.parse(event.body);
    
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
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify({ note })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
```

### 4.5 Lambda Function: Delete Note

Create `deleteNote.mjs`:

```javascript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    const userId = event.requestContext.authorizer.claims.email;
    const noteId = event.pathParameters.noteId;
    
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
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
```

### 4.6 Lambda Function: Upload to S3

Create `uploadFile.mjs`:

```javascript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: "us-east-2" });

export const handler = async (event) => {
    const userId = event.requestContext.authorizer.claims.email;
    const { fileName, fileType } = JSON.parse(event.body);
    
    try {
        const key = `${userId}/${Date.now()}-${fileName}`;
        
        const command = new PutObjectCommand({
            Bucket: "davenotes-attachments",
            Key: key,
            ContentType: fileType
        });
        
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify({ 
                uploadUrl,
                fileUrl: `https://davenotes-attachments.s3.us-east-2.amazonaws.com/${key}`
            })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
```

## Step 5: API Gateway

### 5.1 Create REST API

```bash
aws apigateway create-rest-api \
  --name davenotes-api \
  --description "Dave Notes API" \
  --region us-east-2
```

### 5.2 Create Cognito Authorizer

```bash
aws apigateway create-authorizer \
  --rest-api-id <API_ID> \
  --name davenotes-cognito-auth \
  --type COGNITO_USER_POOLS \
  --provider-arns arn:aws:cognito-idp:us-east-2:ACCOUNT_ID:userpool/<USER_POOL_ID> \
  --identity-source method.request.header.Authorization \
  --region us-east-2
```

### 5.3 Create Resources and Methods

```bash
# /notes resource
aws apigateway create-resource \
  --rest-api-id <API_ID> \
  --parent-id <ROOT_RESOURCE_ID> \
  --path-part notes

# GET /notes
aws apigateway put-method \
  --rest-api-id <API_ID> \
  --resource-id <NOTES_RESOURCE_ID> \
  --http-method GET \
  --authorization-type COGNITO_USER_POOLS \
  --authorizer-id <AUTHORIZER_ID>

# POST /notes
# DELETE /notes/{noteId}
# etc.
```

### 5.4 Enable CORS

```bash
aws apigateway put-method \
  --rest-api-id <API_ID> \
  --resource-id <RESOURCE_ID> \
  --http-method OPTIONS \
  --authorization-type NONE

aws apigateway put-integration \
  --rest-api-id <API_ID> \
  --resource-id <RESOURCE_ID> \
  --http-method OPTIONS \
  --type MOCK
```

### 5.5 Deploy API

```bash
aws apigateway create-deployment \
  --rest-api-id <API_ID> \
  --stage-name prod \
  --region us-east-2
```

Your API endpoint will be:
```
https://<API_ID>.execute-api.us-east-2.amazonaws.com/prod
```

## Step 6: Update Dave Notes Configuration

In `dave-notes.js`, update CONFIG:

```javascript
const CONFIG = {
    // ... existing config
    AWS: {
        API_ENDPOINT: 'https://<API_ID>.execute-api.us-east-2.amazonaws.com/prod',
        COGNITO_USER_POOL_ID: 'us-east-2_XXXXXXXXX',
        COGNITO_CLIENT_ID: 'abc123def456...',
        S3_BUCKET: 'davenotes-attachments',
        REGION: 'us-east-2'
    }
};
```

## Step 7: Implement Cloud Sync Functions

The scaffold functions are already in place. Complete them:

```javascript
async function initCloudServices() {
    if (!CONFIG.AWS.API_ENDPOINT) return false;
    
    // Initialize Amplify or AWS SDK
    // Configure Cognito authentication
    
    return true;
}

async function syncNotesToCloud() {
    if (state.storageMode !== 'cloud') return;
    
    const response = await fetch(`${CONFIG.AWS.API_ENDPOINT}/notes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getIdToken()}`
        },
        body: JSON.stringify({ notes: state.notes })
    });
    
    if (!response.ok) throw new Error('Sync failed');
}

async function uploadToS3(file) {
    // Get presigned URL
    const response = await fetch(`${CONFIG.AWS.API_ENDPOINT}/upload`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getIdToken()}`
        },
        body: JSON.stringify({
            fileName: file.name,
            fileType: file.type
        })
    });
    
    const { uploadUrl, fileUrl } = await response.json();
    
    // Upload file
    await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
    });
    
    return fileUrl;
}
```

## Deployment Checklist

- [ ] Cognito User Pool created
- [ ] Cognito App Client created
- [ ] DynamoDB tables created
- [ ] S3 bucket created with CORS
- [ ] IAM role for Lambda created
- [ ] Lambda functions deployed
- [ ] API Gateway configured
- [ ] CORS enabled on API
- [ ] API deployed to prod stage
- [ ] CONFIG updated in dave-notes.js
- [ ] Cloud sync functions implemented
- [ ] Application tested locally
- [ ] Application deployed to davedirty.com
- [ ] End-to-end testing completed

## Estimated AWS Costs

**Free Tier Eligible:**
- Cognito: 50,000 MAUs free
- DynamoDB: 25 GB storage, 25 RCU/WCU
- S3: 5 GB storage, 20,000 GET, 2,000 PUT
- Lambda: 1M requests, 400,000 GB-seconds
- API Gateway: 1M requests

**Beyond Free Tier (estimated for 100 active users):**
- ~$5-10/month total

## Support

For AWS deployment assistance:
- AWS Documentation: https://docs.aws.amazon.com
- Dave Notes Issues: Check FIXES_APPLIED.md

---

**This guide provides everything needed to integrate Dave Notes with AWS cloud services!**
