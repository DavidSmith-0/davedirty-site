#!/bin/bash

# Check what AWS resources exist

echo "Checking AWS Resources..."
echo ""

echo "=== Cognito User Pools ==="
aws cognito-idp list-user-pools --max-results 20 --region us-east-2 --output json
echo ""

echo "=== DynamoDB Tables ==="
aws dynamodb list-tables --region us-east-2
echo ""

echo "=== S3 Buckets ==="
aws s3 ls
echo ""

echo "=== Lambda Functions ==="
aws lambda list-functions --region us-east-2 --query 'Functions[].FunctionName'
echo ""

echo "=== API Gateway APIs ==="
aws apigateway get-rest-apis --region us-east-2 --output json
echo ""

echo "=== IAM Roles ==="
aws iam list-roles --query 'Roles[?contains(RoleName, `Dave`)].RoleName'
echo ""
