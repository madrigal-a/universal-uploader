// src/services/r2.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 credentials interface
interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicDomain?: string; // Optional public domain (e.g., "pub-xxxxx.r2.dev" or "cdn.example.com")
}

// URL options interface
interface UrlOptions {
  bucket: string;
  filename: string;
}

/**
 * Generates a presigned URL for Cloudflare R2.
 */
export async function generateR2UploadUrl(
  credentials: R2Credentials,
  options: UrlOptions
): Promise<string> {

  // Build the R2 API endpoint URL
  const endpoint = `https://${credentials.accountId}.r2.cloudflarestorage.com`;

  // 1. Create S3 client pointing to R2
  const s3Client = new S3Client({
    region: 'auto', // R2 uses 'auto'
    endpoint: endpoint,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    }
  });

  // 2. Create the PutObject command
  const command = new PutObjectCommand({
    Bucket: options.bucket,
    Key: options.filename,
  });

  // 3. Generate presigned URL (expires in 5 minutes)
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  // 4. If a public domain is configured, replace the endpoint in the URL
  // NOTE: The public domain already includes the bucket, we only need the filename
  if (credentials.publicDomain) {
    // Extract only the signature parameters from the generated URL
    const url = new URL(signedUrl);
    const queryParams = url.search; // Contains all ?X-Amz-... parameters

    // Build the public URL correctly (without bucket name in path)
    return `https://${credentials.publicDomain}/${options.filename}${queryParams}`;
  }

  return signedUrl;
}