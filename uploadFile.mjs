import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const s3Client = new S3Client({ region: "us-east-2" });
export const handler = async (event) => {
    const userId = event.requestContext?.authorizer?.claims?.email || event.queryStringParameters?.userId || 'anonymous';
    const { fileName, fileType } = JSON.parse(event.body);
    if (!fileName || !fileType) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "fileName and fileType required" }) };
    try {
        const key = `${userId}/${Date.now()}-${fileName}`;
        const BUCKET = process.env.BUCKET_NAME || "davenotes-attachments";
        const uploadUrl = await getSignedUrl(s3Client, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: fileType }), { expiresIn: 3600 });
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ uploadUrl, fileUrl: `https://${BUCKET}.s3.us-east-2.amazonaws.com/${key}`, key }) };
    } catch (error) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: error.message }) };
    }
};
