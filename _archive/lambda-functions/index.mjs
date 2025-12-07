import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";

const client = new DynamoDBClient({ region: "us-east-2" });
const TABLE_NAME = "FanMessages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
};

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ""
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { name, message } = body;

    if (!name || !message) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Name and message are required" })
      };
    }

    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    const item = {
      id: { S: messageId },
      name: { S: name },
      message: { S: message },
      createdAt: { S: now }
    };

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: item
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, messageId })
    };
  } catch (err) {
    console.error("Error in createMessage:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};
