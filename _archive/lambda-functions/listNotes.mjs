import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);
export const handler = async (event) => {
    const userId = event.requestContext?.authorizer?.claims?.email || event.queryStringParameters?.userId;
    if (!userId) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "userId required" }) };
    try {
        const response = await docClient.send(new QueryCommand({ TableName: "DaveNotes", KeyConditionExpression: "userId = :userId", ExpressionAttributeValues: { ":userId": userId }, ScanIndexForward: false }));
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ notes: response.Items || [], count: response.Count || 0 }) };
    } catch (error) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: error.message }) };
    }
};
