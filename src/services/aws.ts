// src/services/aws.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

interface UrlOptions {
  bucket: string;
  filename: string;
}

export async function generateAwsUploadUrl(
  credentials: AwsCredentials,
  options: UrlOptions
): Promise<string> {

  // Sanitize credentials
  const accessKeyId = credentials.accessKeyId.trim();
  const secretAccessKey = credentials.secretAccessKey.trim();

  // Initialize official AWS S3 client
  const client = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: options.bucket,
    Key: options.filename,
  });

  // Generate presigned URL (expires in 5 minutes)
  const signedUrl = await getSignedUrl(client, command, { expiresIn: 300 });

  return signedUrl;
}