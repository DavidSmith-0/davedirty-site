#!/bin/bash

# Dave Notes - Complete Setup (Python-assisted parsing)

echo "╔════════════════════════════════════════════╗"
echo "║   Dave Notes - AWS Setup Final            ║"
echo "╚════════════════════════════════════════════╝"
echo ""

REGION="us-east-2"

# Create Python helper script
cat > parse_aws.py << 'PYEOF'
import json
import sys

def get_user_pool_id(data):
    pools = data.get('UserPools', [])
    for pool in pools:
        if 'davenotes' in pool.get('Name', '').lower():
            return pool.get('Id', '')
    return ''

def get_client_id(data):
    clients = data.get('UserPoolClients', [])
    if clients:
        return clients[0].get('ClientId', '')
    return ''

def get_api_id(data):
    items = data.get('items', [])
    for item in items:
        if 'davenotes' in item.get('name', '').lower():
            return item.get('id', '')
    return ''

if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else ''
    data = json.load(sys.stdin)
    
    if command == 'user_pool':
        print(get_user_pool_id(data))
    elif command == 'client':
        print(get_client_id(data))
    elif command == 'api':
        print(get_api_id(data))
PYEOF

echo "Fetching AWS resources..."
echo ""

# Get User Pool
echo "→ Cognito User Pool..."
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --region $REGION --output json 2>/dev/null | python3 parse_aws.py user_pool)

if [ -z "$USER_POOL_ID" ]; then
    echo "✗ User Pool not found"
    echo ""
    echo "Creating User Pool..."
    USER_POOL_ID=$(aws cognito-idp create-user-pool \
      --pool-name davenotes-users \
      --policies '{"PasswordPolicy":{"MinimumLength":6,"RequireUppercase":false,"RequireLowercase":false,"RequireNumbers":false,"RequireSymbols":false}}' \
      --auto-verified-attributes email \
      --mfa-configuration OFF \
      --region $REGION \
      --output json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['UserPool']['Id'])")
    
    echo "✓ Created User Pool: $USER_POOL_ID"
else
    echo "✓ User Pool: $USER_POOL_ID"
fi

# Get Client ID
echo "→ App Client..."
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --region $REGION --output json 2>/dev/null | python3 parse_aws.py client)

if [ -z "$CLIENT_ID" ]; then
    echo "Creating App Client..."
    CLIENT_ID=$(aws cognito-idp create-user-pool-client \
      --user-pool-id "$USER_POOL_ID" \
      --client-name davenotes-web \
      --no-generate-secret \
      --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
      --region $REGION \
      --output json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['UserPoolClient']['ClientId'])")
    
    echo "✓ Created Client: $CLIENT_ID"
else
    echo "✓ Client ID: $CLIENT_ID"
fi

# Get S3 Bucket
echo "→ S3 Bucket..."
BUCKET_NAME=$(aws s3 ls 2>/dev/null | grep davenotes | awk '{print $3}' | head -1)

if [ -z "$BUCKET_NAME" ]; then
    echo "Creating S3 Bucket..."
    BUCKET_NAME="davenotes-attachments-$(date +%s)"
    aws s3 mb "s3://$BUCKET_NAME" --region $REGION
    echo "✓ Created Bucket: $BUCKET_NAME"
else
    echo "✓ Bucket: $BUCKET_NAME"
fi

# Get API Gateway
echo "→ API Gateway..."
API_ID=$(aws apigateway get-rest-apis --region $REGION --output json 2>/dev/null | python3 parse_aws.py api)

if [ -z "$API_ID" ]; then
    echo "Creating API Gateway..."
    API_ID=$(aws apigateway create-rest-api \
      --name davenotes-api \
      --description "Dave Notes API" \
      --region $REGION \
      --output json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    
    echo "✓ Created API: $API_ID"
else
    echo "✓ API ID: $API_ID"
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
API_ENDPOINT="https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"

echo ""
echo "════════════════════════════════════════════"
echo "Resources Ready"
echo "════════════════════════════════════════════"
echo "User Pool: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
echo "S3 Bucket: $BUCKET_NAME"
echo "API ID: $API_ID"
echo "Account: $ACCOUNT_ID"
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

cat > aws-config.js << EOF
// Add this to dave-notes.js CONFIG object:
AWS: {
    API_ENDPOINT: '${API_ENDPOINT}',
    COGNITO_USER_POOL_ID: '${USER_POOL_ID}',
    COGNITO_CLIENT_ID: '${CLIENT_ID}',
    S3_BUCKET: '${BUCKET_NAME}',
    REGION: '${REGION}'
}
EOF

echo "✓ Configuration saved"
echo ""
echo "Next: Run ./deploy-everything.sh to complete setup"
echo ""

# Cleanup
rm parse_aws.py
