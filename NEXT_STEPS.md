# Complete AWS Integration - Run These Commands

## You've already run the quick start and it worked! Now let's finish the setup.

## Step 1: Complete API Gateway Setup (5 minutes)

Run this script to configure API Gateway with all your resources:

```bash
cd "/Users/dave/Downloads/cloud guestboard"
chmod +x complete-aws-setup.sh
./complete-aws-setup.sh
```

This will:
- ✅ Find all your AWS resources (Cognito, DynamoDB, S3, API Gateway)
- ✅ Create API Gateway resources (/notes, /notes/{noteId}, /upload)
- ✅ Configure all HTTP methods (GET, POST, DELETE)
- ✅ Connect Lambda functions to API Gateway
- ✅ Enable CORS on all endpoints
- ✅ Deploy API to production
- ✅ Test the API endpoints
- ✅ Save configuration to aws-config.txt

## Step 2: Update dave-notes.js with Cloud Config (1 minute)

After the script completes successfully, update your JavaScript file:

```bash
chmod +x update-dave-notes-with-cloud.sh
./update-dave-notes-with-cloud.sh
```

This will automatically insert your AWS configuration into dave-notes.js.

## Step 3: Test Locally (2 minutes)

```bash
# Start local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/dave-notes.html
```

Then test:
1. Login with dave@davedirty.com / dave3232
2. Go to Settings
3. Switch Storage Mode to "Cloud Sync"
4. Create a test note
5. Check that it appears in DynamoDB:
   ```bash
   aws dynamodb scan --table-name DaveNotes --region us-east-2
   ```

## Step 4: Deploy to davedirty.com (2 minutes)

When everything works locally:

```bash
# Upload files to your server (adjust the path as needed)
scp dave-notes.html dave-notes.css dave-notes.js user@davedirty.com:/path/to/webroot/
```

Or use your FTP client to upload:
- dave-notes.html
- dave-notes.css
- dave-notes.js

## Troubleshooting

### If complete-aws-setup.sh fails:

**"User Pool not found"**
- Run the original setup first: `./setup-aws.sh`

**"Lambda function not found"**
- You need to create and deploy Lambda functions
- See LAMBDA_SETUP.md for instructions

**CORS errors in browser**
- Run the script again, it should fix CORS
- Or manually enable CORS in AWS Console

### If API tests fail:

```bash
# Check Lambda logs
aws logs tail /aws/lambda/davenotes-list-notes --follow --region us-east-2

# Test Lambda directly
aws lambda invoke \
  --function-name davenotes-list-notes \
  --payload '{"queryStringParameters":{"userId":"dave@davedirty.com"}}' \
  --region us-east-2 \
  response.json
cat response.json
```

### If notes don't sync:

1. Check browser console for errors (F12)
2. Verify API endpoint in dave-notes.js
3. Check that storage mode is set to "cloud"
4. Check DynamoDB table: `aws dynamodb scan --table-name DaveNotes --region us-east-2`

## What You Get

After completing these steps:

✅ **Cognito Authentication** - Users can register/login
✅ **DynamoDB Storage** - Notes stored in cloud database
✅ **S3 File Storage** - Images and files uploaded to S3
✅ **API Gateway** - RESTful API for all operations
✅ **Lambda Functions** - Serverless backend logic
✅ **Cross-device Sync** - Access notes from anywhere
✅ **Admin Dashboard** - View all users and activity

## Quick Test Commands

```bash
# Test GET notes
curl "$(cat aws-config.txt | grep API_ENDPOINT | cut -d= -f2)/notes?userId=dave@davedirty.com"

# Test POST note
curl -X POST "$(cat aws-config.txt | grep API_ENDPOINT | cut -d= -f2)/notes?userId=dave@davedirty.com" \
  -H "Content-Type: application/json" \
  -d '{"type":"text","title":"Test","content":"Hello from API"}'

# View notes in DynamoDB
aws dynamodb scan --table-name DaveNotes --region us-east-2

# View users in Cognito
aws cognito-idp list-users --user-pool-id $(cat aws-config.txt | grep USER_POOL_ID | cut -d= -f2) --region us-east-2
```

## Current Status

You've completed:
- ✅ AWS CLI installed and configured
- ✅ Quick start script ran successfully
- ✅ Cognito User Pool created
- ✅ DynamoDB tables created
- ✅ S3 bucket created
- ✅ Lambda IAM role created
- ✅ API Gateway created (basic)

Still need to:
- ⏳ Complete API Gateway configuration (run complete-aws-setup.sh)
- ⏳ Create Lambda functions (if not already done)
- ⏳ Update dave-notes.js with config (run update-dave-notes-with-cloud.sh)
- ⏳ Test locally
- ⏳ Deploy to davedirty.com

## Total Time Remaining: ~30 minutes

Just run the two scripts and you're done!

```bash
cd "/Users/dave/Downloads/cloud guestboard"
./complete-aws-setup.sh
./update-dave-notes-with-cloud.sh
```

Then test locally and deploy.

---

**Need help? Check:**
- `QUICK_REFERENCE.md` for fast lookups
- `AWS_SETUP_COMPLETE_GUIDE.md` for detailed explanations
- `FIXES_APPLIED.md` for what was fixed in the code
