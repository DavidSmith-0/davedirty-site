#!/bin/bash

# Simple check and complete setup

echo "Dave Notes - Simple AWS Setup"
echo "=============================="
echo ""

# Check if setup-aws.sh was run and created config
if [ -f "aws-config.txt" ]; then
    echo "✓ Found existing aws-config.txt"
    echo "Loading configuration..."
    source aws-config.txt
    echo ""
    echo "Configuration loaded:"
    echo "  User Pool: $USER_POOL_ID"
    echo "  Client ID: $CLIENT_ID"
    echo "  Bucket: $BUCKET_NAME"
    echo "  API ID: $API_ID"
    echo ""
else
    echo "× No aws-config.txt found"
    echo ""
    echo "Let me check what resources exist..."
    echo ""
    
    # Try to find resources
    USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --region us-east-2 --output json 2>/dev/null | python3 -c "import sys, json; pools = json.load(sys.stdin).get('UserPools', []); print(next((p['Id'] for p in pools if 'davenotes' in p.get('Name', '').lower()), ''))")
    
    if [ -z "$USER_POOL_ID" ]; then
        echo "× User Pool not found"
        echo ""
        echo "It looks like the initial setup didn't complete."
        echo "Please run this command first:"
        echo ""
        echo "  ./setup-aws.sh"
        echo ""
        echo "Or if that file doesn't exist, run:"
        echo ""
        echo "  curl -o setup-aws.sh https://raw.githubusercontent.com/.../setup-aws.sh"
        echo "  chmod +x setup-aws.sh"
        echo "  ./setup-aws.sh"
        echo ""
        exit 1
    fi
    
    echo "✓ Found User Pool: $USER_POOL_ID"
    
    # Get other resources
    CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --region us-east-2 --output json 2>/dev/null | python3 -c "import sys, json; clients = json.load(sys.stdin).get('UserPoolClients', []); print(clients[0]['ClientId'] if clients else '')")
    BUCKET_NAME=$(aws s3 ls 2>/dev/null | grep davenotes | awk '{print $3}' | head -1)
    API_ID=$(aws apigateway get-rest-apis --region us-east-2 --output json 2>/dev/null | python3 -c "import sys, json; apis = json.load(sys.stdin).get('items', []); print(next((a['id'] for a in apis if 'davenotes' in a.get('name', '').lower()), ''))")
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Save config
    cat > aws-config.txt << EOF
USER_POOL_ID=$USER_POOL_ID
CLIENT_ID=$CLIENT_ID
BUCKET_NAME=$BUCKET_NAME
API_ID=$API_ID
API_ENDPOINT=https://${API_ID}.execute-api.us-east-2.amazonaws.com/prod
ACCOUNT_ID=$ACCOUNT_ID
REGION=us-east-2
EOF
    
    echo "✓ Configuration saved to aws-config.txt"
    echo ""
fi

echo "Resources found:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  API Gateway ID: $API_ID"
echo ""

# Now check if Lambda functions exist
echo "Checking Lambda functions..."
LAMBDA_COUNT=$(aws lambda list-functions --region us-east-2 --query 'Functions[?starts_with(FunctionName, `davenotes`)].FunctionName' --output json 2>/dev/null | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")

echo "Found $LAMBDA_COUNT Lambda functions"
echo ""

if [ "$LAMBDA_COUNT" -eq "0" ]; then
    echo "Need to create Lambda functions."
    echo "Run: ./create-lambdas.sh"
else
    echo "✓ Lambda functions exist"
    echo "Run: ./configure-api-gateway.sh"
fi

echo ""
