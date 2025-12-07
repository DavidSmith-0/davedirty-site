#!/bin/bash

# This script updates dave-notes.js with cloud integration and implements sync functions

echo "============================================="
echo "Dave Notes - Cloud Integration Script"
echo "============================================="
echo ""

# Check if aws-config.txt exists
if [ ! -f "aws-config.txt" ]; then
    echo "Error: aws-config.txt not found."
    echo "Please run complete-aws-setup.sh first."
    exit 1
fi

echo "Reading AWS configuration..."
source aws-config.txt

echo "✓ Configuration loaded"
echo ""

# Backup original file
cp dave-notes.js dave-notes.js.backup
echo "✓ Backup created: dave-notes.js.backup"

# Update AWS configuration in the file
echo "Updating AWS configuration..."

# Use perl for more reliable in-place editing
perl -i -pe "s|API_ENDPOINT: ''|API_ENDPOINT: '$API_ENDPOINT'|g" dave-notes.js
perl -i -pe "s|COGNITO_USER_POOL_ID: ''|COGNITO_USER_POOL_ID: '$USER_POOL_ID'|g" dave-notes.js
perl -i -pe "s|COGNITO_CLIENT_ID: ''|COGNITO_CLIENT_ID: '$CLIENT_ID'|g" dave-notes.js
perl -i -pe "s|S3_BUCKET: ''|S3_BUCKET: '$BUCKET_NAME'|g" dave-notes.js

echo "✓ AWS configuration updated"
echo ""
echo "Configuration applied:"
echo "  API Endpoint: $API_ENDPOINT"
echo "  User Pool: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo "  S3 Bucket: $BUCKET_NAME"
echo ""
echo "============================================="
echo "Testing Configuration"
echo "============================================="
echo ""

# Test API endpoint
echo "Testing API endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_ENDPOINT/notes?userId=test")
if [ "$RESPONSE" = "200" ]; then
    echo "✓ API endpoint is accessible"
else
    echo "⚠ API returned status code: $RESPONSE"
fi

echo ""
echo "============================================="
echo "Setup Complete!"
echo "============================================="
echo ""
echo "Your dave-notes.js is now configured for cloud sync!"
echo ""
echo "Next steps:"
echo "1. Test locally: python3 -m http.server 8000"
echo "2. Open: http://localhost:8000/dave-notes.html"
echo "3. Try creating notes and switch to Cloud mode"
echo "4. Deploy to davedirty.com when ready"
echo ""
