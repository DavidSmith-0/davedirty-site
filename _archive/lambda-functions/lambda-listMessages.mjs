import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" });
const TABLE_NAME = "FanMessages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,GET"
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
    // Scan DynamoDB table
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME
      })
    );

    // Transform DynamoDB items to JSON
    // Note: We don't return ip and userAgent to public API for privacy
    const items =
      (result.Items || [])
        .map((av) => ({
          id: av.id?.S,
          name: av.name?.S,
          message: av.message?.S,
          createdAt: av.createdAt?.S
          // ip and userAgent are stored but not returned to frontend
        }))
        .filter(item => item.id && item.name && item.message) // Filter out incomplete items
        .sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );

    console.log(`Retrieved ${items.length} messages`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(items)
    };
  } catch (err) {
    console.error("Error in listMessages:", err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};
