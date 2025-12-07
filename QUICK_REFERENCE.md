# AWS Setup - Quick Reference Card

## Prerequisites (5 minutes)

```bash
# 1. Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# 2. Configure AWS
aws configure
# Enter: Access Key, Secret Key, us-east-2, json

# 3. Verify
aws sts get-caller-identity
```

## Automated Setup (10 minutes)

```bash
cd "/Users/dave/Downloads/cloud guestboard"
chmod +x setup-aws.sh
./setup-aws.sh
```

This creates:
- ✅ Cognito User Pool
- ✅ DynamoDB Tables (3)
- ✅ S3 Bucket
- ✅ IAM Role
- ⚠️ API Gateway (partial - need to complete manually)

## Create Lambda Functions (15 minutes)

```bash
# Copy code from AWS_SETUP_COMPLETE_GUIDE.md Step 4.4

# Create files
nano listNotes.mjs    # Paste code
nano createNote.mjs   # Paste code
nano deleteNote.mjs   # Paste code
nano uploadFile.mjs   # Paste code

# Create zips
zip listNotes.zip listNotes.mjs
zip createNote.zip createNote.mjs
zip deleteNote.zip deleteNote.mjs
zip uploadFile.zip uploadFile.mjs

# Deploy (get ROLE_ARN from aws-config.txt or script output)
ROLE_ARN="arn:aws:iam::YOUR_ACCOUNT:role/DaveNotesLambdaRole"

aws lambda create-function --function-name davenotes-list-notes \
  --runtime nodejs20.x --role $ROLE_ARN --handler listNotes.handler \
  --zip-file fileb://listNotes.zip --timeout 30 --region us-east-2

aws lambda create-function --function-name davenotes-create-note \
  --runtime nodejs20.x --role $ROLE_ARN --handler createNote.handler \
  --zip-file fileb://createNote.zip --timeout 30 --region us-east-2

aws lambda create-function --function-name davenotes-delete-note \
  --runtime nodejs20.x --role $ROLE_ARN --handler deleteNote.handler \
  --zip-file fileb://deleteNote.zip --timeout 30 --region us-east-2

aws lambda create-function --function-name davenotes-upload-file \
  --runtime nodejs20.x --role $ROLE_ARN --handler uploadFile.handler \
  --zip-file fileb://uploadFile.zip --timeout 30 \
  --environment "Variables={BUCKET_NAME=YOUR_BUCKET}" --region us-east-2
```

## Complete API Gateway (20 minutes)

**Option A: AWS Console (Easier)**

1. Go to AWS Console → API Gateway
2. Create REST API → "davenotes-api"
3. Create resources:
   - `/notes` (methods: GET, POST, OPTIONS)
   - `/notes/{noteId}` (methods: DELETE, OPTIONS)
   - `/upload` (methods: POST, OPTIONS)
4. For each method:
   - Integration: Lambda Function
   - Lambda Proxy integration: YES
   - Select your Lambda function
5. Enable CORS on each resource:
   - Actions → Enable CORS
6. Deploy API:
   - Actions → Deploy API
   - Stage: prod

**Option B: AWS CLI (Follow guide Step 5)**

See `AWS_SETUP_COMPLETE_GUIDE.md` Step 5.

## Update dave-notes-fixed.js (5 minutes)

After setup completes, check `aws-config.txt`:

```javascript
const CONFIG = {
    // ... existing config
    AWS: {
        API_ENDPOINT: 'https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/prod',
        COGNITO_USER_POOL_ID: 'us-east-2_XXXXXXXXX',
        COGNITO_CLIENT_ID: 'your-client-id-here',
        S3_BUCKET: 'your-bucket-name',
        REGION: 'us-east-2'
    }
};
```

## Test (5 minutes)

```bash
# Source config
source aws-config.txt

# Test API
curl "$API_ENDPOINT/notes?userId=dave@davedirty.com"
# Expected: {"notes":[],"count":0}

# Test creating note
curl -X POST "$API_ENDPOINT/notes?userId=dave@davedirty.com" \
  -H "Content-Type: application/json" \
  -d '{"type":"text","title":"Test","content":"Hello"}'

# Test listing again
curl "$API_ENDPOINT/notes?userId=dave@davedirty.com"
# Expected: {"notes":[{...}],"count":1}
```

## Deploy to Website (2 minutes)

```bash
# Rename fixed file
mv dave-notes-fixed.js dave-notes.js

# Upload to server (adjust path)
scp dave-notes.html dave-notes.css dave-notes.js user@davedirty.com:/var/www/html/
```

## Troubleshooting

**Error: AWS CLI not found**
→ Install: `curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg" && sudo installer -pkg AWSCLIV2.pkg -target /`

**Error: Credentials not configured**
→ Run: `aws configure`

**Error: Lambda permission denied**
→ Wait 30 seconds for IAM role to propagate, then retry

**Error: CORS errors in browser**
→ Enable CORS on ALL API Gateway resources

**Error: API returns 403**
→ Check Lambda permissions: `aws lambda get-policy --function-name davenotes-list-notes --region us-east-2`

**Lambda function errors**
→ Check logs: `aws logs tail /aws/lambda/davenotes-list-notes --follow --region us-east-2`

## Total Time Estimate

- Prerequisites: 5 min
- Automated setup: 10 min
- Lambda functions: 15 min
- API Gateway: 20 min
- Update code: 5 min
- Test: 5 min
- Deploy: 2 min

**Total: ~1 hour**

## Configuration Files

After setup, you'll have:
- `aws-config.txt` - All your AWS IDs and endpoints
- `listNotes.zip`, `createNote.zip`, etc. - Lambda deployment packages
- `dave-notes.js` - Updated with AWS config

## What You Get

✅ User authentication (Cognito)
✅ Cloud note storage (DynamoDB)
✅ File uploads to cloud (S3)
✅ REST API (API Gateway + Lambda)
✅ Admin dashboard with cloud data
✅ Cross-device sync
✅ Automatic backups

## Costs

Free Tier (first 12 months):
- Up to 50,000 monthly active users
- 25 GB DynamoDB storage
- 5 GB S3 storage
- 1M API requests

Beyond free tier: **~$5-10/month** for 100 active users

## Quick Commands

```bash
# List all resources
aws dynamodb list-tables --region us-east-2
aws s3 ls
aws lambda list-functions --region us-east-2
aws apigateway get-rest-apis --region us-east-2

# Delete everything (cleanup)
# See cleanup commands in full guide
```

## Support

- Full Guide: `AWS_SETUP_COMPLETE_GUIDE.md`
- Summary: `AWS_INTEGRATION_SUMMARY.md`
- Fixes Doc: `FIXES_APPLIED.md`
- Deployment: `DEPLOYMENT_CHECKLIST.md`

---

**Ready to start? Run: `./setup-aws.sh`**
