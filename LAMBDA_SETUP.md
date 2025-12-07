# Lambda Functions Setup Guide

## Quick Lambda Deployment (10 minutes)

If you haven't deployed Lambda functions yet, follow these steps:

### Step 1: Create Lambda Function Files

Run this command to create all Lambda function files:

```bash
cd "/Users/dave/Downloads/cloud guestboard"

# Create listNotes.mjs
cat > listNotes.mjs << 'EOF'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

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

# Create createNote.mjs
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

# Create deleteNote.mjs
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

# Create uploadFile.mjs
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

echo "✓ Lambda function files created"
```

### Step 2: Create ZIP Files

```bash
zip listNotes.zip listNotes.mjs
zip createNote.zip createNote.mjs
zip deleteNote.zip deleteNote.mjs
zip uploadFile.zip uploadFile.mjs

echo "✓ ZIP files created"
```

### Step 3: Deploy Lambda Functions

```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/DaveNotesLambdaRole"
REGION="us-east-2"

# Get bucket name
BUCKET_NAME=$(aws s3 ls | grep davenotes-attachments | awk '{print $3}' | head -1)

echo "Deploying Lambda functions..."

# Deploy listNotes
aws lambda create-function \
  --function-name davenotes-list-notes \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler listNotes.handler \
  --zip-file fileb://listNotes.zip \
  --timeout 30 \
  --region $REGION || echo "⚠ listNotes already exists"

# Deploy createNote
aws lambda create-function \
  --function-name davenotes-create-note \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler createNote.handler \
  --zip-file fileb://createNote.zip \
  --timeout 30 \
  --region $REGION || echo "⚠ createNote already exists"

# Deploy deleteNote
aws lambda create-function \
  --function-name davenotes-delete-note \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler deleteNote.handler \
  --zip-file fileb://deleteNote.zip \
  --timeout 30 \
  --region $REGION || echo "⚠ deleteNote already exists"

# Deploy uploadFile
aws lambda create-function \
  --function-name davenotes-upload-file \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler uploadFile.handler \
  --zip-file fileb://uploadFile.zip \
  --timeout 30 \
  --environment "Variables={BUCKET_NAME=$BUCKET_NAME}" \
  --region $REGION || echo "⚠ uploadFile already exists"

echo "✓ Lambda functions deployed"
```

### Step 4: Verify Deployment

```bash
# List all functions
aws lambda list-functions --region us-east-2 --query 'Functions[?starts_with(FunctionName, `davenotes`)].FunctionName'

# Should show:
# - davenotes-list-notes
# - davenotes-create-note
# - davenotes-delete-note
# - davenotes-upload-file
```

### Step 5: Test Lambda Functions

```bash
# Test listNotes
aws lambda invoke \
  --function-name davenotes-list-notes \
  --payload '{"queryStringParameters":{"userId":"dave@davedirty.com"}}' \
  --region us-east-2 \
  response.json

cat response.json
# Should show: {"statusCode":200,"headers":{...},"body":"{\"notes\":[],\"count\":0}"}

# Test createNote
aws lambda invoke \
  --function-name davenotes-create-note \
  --payload '{"queryStringParameters":{"userId":"dave@davedirty.com"},"body":"{\"type\":\"text\",\"title\":\"Test\",\"content\":\"Hello\"}"}' \
  --region us-east-2 \
  response.json

cat response.json
# Should show success
```

## If Lambda Functions Already Exist

If you get errors saying the functions already exist, you can update them instead:

```bash
# Update function code
aws lambda update-function-code \
  --function-name davenotes-list-notes \
  --zip-file fileb://listNotes.zip \
  --region us-east-2

# Repeat for other functions
```

## Common Issues

**Error: "The role defined for the function cannot be assumed by Lambda"**
- Wait 30 seconds for IAM role to propagate
- Then retry

**Error: "Function already exists"**
- Use update-function-code instead (see above)
- Or delete and recreate: `aws lambda delete-function --function-name NAME --region us-east-2`

**Error: "AccessDeniedException"**
- Check IAM permissions
- Make sure you ran setup-aws.sh first

## After Deployment

Once Lambda functions are deployed, run:
```bash
./complete-aws-setup.sh
```

This will connect them to API Gateway.

---

**Quick one-liner to deploy all Lambda functions:**

```bash
cd "/Users/dave/Downloads/cloud guestboard" && \
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text) && \
BUCKET_NAME=$(aws s3 ls | grep davenotes-attachments | awk '{print $3}' | head -1) && \
aws lambda create-function --function-name davenotes-list-notes --runtime nodejs20.x --role arn:aws:iam::${ACCOUNT_ID}:role/DaveNotesLambdaRole --handler listNotes.handler --zip-file fileb://listNotes.zip --timeout 30 --region us-east-2 && \
aws lambda create-function --function-name davenotes-create-note --runtime nodejs20.x --role arn:aws:iam::${ACCOUNT_ID}:role/DaveNotesLambdaRole --handler createNote.handler --zip-file fileb://createNote.zip --timeout 30 --region us-east-2 && \
aws lambda create-function --function-name davenotes-delete-note --runtime nodejs20.x --role arn:aws:iam::${ACCOUNT_ID}:role/DaveNotesLambdaRole --handler deleteNote.handler --zip-file fileb://deleteNote.zip --timeout 30 --region us-east-2 && \
aws lambda create-function --function-name davenotes-upload-file --runtime nodejs20.x --role arn:aws:iam::${ACCOUNT_ID}:role/DaveNotesLambdaRole --handler uploadFile.handler --zip-file fileb://uploadFile.zip --timeout 30 --environment "Variables={BUCKET_NAME=$BUCKET_NAME}" --region us-east-2
```
