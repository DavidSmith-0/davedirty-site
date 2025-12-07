import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);
export const handler = async (event) => {
    const userId = event.requestContext?.authorizer?.claims?.email || event.queryStringParameters?.userId;
    const noteId = event.pathParameters?.noteId;
    if (!userId || !noteId) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "userId and noteId required" }) };
    try {
        await docClient.send(new DeleteCommand({ TableName: "DaveNotes", Key: { userId, noteId } }));
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: error.message }) };
    }
};
