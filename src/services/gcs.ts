// src/services/gcs.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Google Cloud Storage - Implementation using S3-compatible API
 *
 * GCS offers an S3 interoperability layer that allows using
 * the AWS SDK pointing to the GCS endpoint.
 *
 * Requirements:
 * 1. Create HMAC keys in GCS (these are NOT the same as service account keys)
 *    - Go to: Cloud Storage > Settings > Interoperability
 *    - Create an "Access key for service account"
 * 2. The bucket must exist in GCS
 */

interface GcsCredentials {
    accessKeyId: string;      // HMAC Access Key (format: GOOG1E...)
    secretAccessKey: string;  // HMAC Secret Key
    projectId?: string;       // Optional, for reference
}

interface UrlOptions {
    bucket: string;
    filename: string;
}

export async function generateGcsUploadUrl(
    credentials: GcsCredentials,
    options: UrlOptions
): Promise<string> {

    // Sanitize credentials
    const accessKeyId = credentials.accessKeyId.trim();
    const secretAccessKey = credentials.secretAccessKey.trim();

    // GCS S3-compatible endpoint
    // Documentation: https://cloud.google.com/storage/docs/interoperability
    const gcsEndpoint = 'https://storage.googleapis.com';

    // Create S3 client pointing to GCS
    const client = new S3Client({
        region: 'auto', // GCS doesn't use AWS-style regions, 'auto' works
        endpoint: gcsEndpoint,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        },
        // Important: GCS requires path-style for S3-compatible API
        forcePathStyle: true,
    });

    const command = new PutObjectCommand({
        Bucket: options.bucket,
        Key: options.filename,
    });

    // Generate presigned URL (expires in 5 minutes)
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 300 });

    return signedUrl;
}
