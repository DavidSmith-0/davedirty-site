import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";

const client = new DynamoDBClient({ region: "us-east-2" });
const TABLE_NAME = "FanMessages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://davedirty.com",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,POST"
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

    // Validate input
    if (!name || !message) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Name and message are required" })
      };
    }

    // Validate length
    if (name.length > 50 || message.length > 500) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Name or message too long" })
      };
    }

    // Extract metadata from the request
    const ip =
      event.requestContext?.http?.sourceIp ||
      event.requestContext?.identity?.sourceIp ||
      event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      "unknown";

    const ua =
      event.headers?.["user-agent"] ||
      event.headers?.["User-Agent"] ||
      "unknown";

    const now = new Date().toISOString();

    // Create DynamoDB item with metadata
    const item = {
      id: { S: crypto.randomUUID() },
      name: { S: name.trim() },
      message: { S: message.trim() },
      createdAt: { S: now },
      ip: { S: String(ip) },
      userAgent: { S: String(ua) }
    };

    // Store in DynamoDB
    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: item
      })
    );

    console.log(`Message created: ${item.id.S} from ${ip}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true,
        messageId: item.id.S 
      })
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
