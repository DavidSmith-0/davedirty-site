import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);
export const handler = async (event) => {
    const userId = event.requestContext?.authorizer?.claims?.email || event.queryStringParameters?.userId;
    if (!userId) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "userId required" }) };
    let note = JSON.parse(event.body);
    note.userId = userId;
    note.updatedAt = new Date().toISOString();
    if (!note.noteId) { note.noteId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9); note.createdAt = note.updatedAt; }
    try {
        await docClient.send(new PutCommand({ TableName: "DaveNotes", Item: note }));
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ success: true, note }) };
    } catch (error) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: error.message }) };
    }
};
