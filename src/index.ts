// src/index.ts
import { generateAzureUploadUrl } from './services/azure'
import { generateR2UploadUrl } from './services/r2'
import { generateGcsUploadUrl } from './services/gcs'
import { Hono } from 'hono'
import { encrypt, decrypt } from './crypto'
import { generateAwsUploadUrl } from './services/aws'

// --- Type Definitions ---
type Bindings = {
  SECRET_STORE: KVNamespace;
  MASTER_ENCRYPTION_KEY: string;
  ASSETS: Fetcher;
}

// Request body types
type ConfigBody = {
  provider: string;
  credentials: any;
}

type GenerateBody = {
  provider: string;
  bucket: string;
  filename: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// --- ENDPOINT 1: POST /api/config ---
app.post('/api/config', async (c) => {
  // In production (behind Cloudflare Access), the authenticated user's email
  // is injected by the proxy as 'Cf-Access-Authenticated-User-Email'.
  // This header is NOT forgeable by clients — it comes from Cloudflare's edge.
  // 'X-User-ID' is only used as a fallback for local development.
  const userId = c.req.header('Cf-Access-Authenticated-User-Email')
               ?? c.req.header('X-User-ID');
  if (!userId) {
    return c.json({ error: 'Unauthorized. Missing authentication.' }, 401);
  }

  const { provider, credentials } = await c.req.json<ConfigBody>();
  if (!provider || !credentials) {
    return c.json({ error: 'Missing "provider" or "credentials".' }, 400);
  }

  const masterKey = c.env.MASTER_ENCRYPTION_KEY;
  if (!masterKey) {
    console.error('FATAL ERROR: MASTER_ENCRYPTION_KEY is not configured.');
    return c.json({ error: 'Internal server error.' }, 500);
  }

  try {
    const plaintextCredentials = JSON.stringify(credentials);
    const encryptedCredentials = await encrypt(masterKey, plaintextCredentials);
    const kvKey = `config:${userId}:${provider}`;
    await c.env.SECRET_STORE.put(kvKey, encryptedCredentials);
    return c.json({ success: true, message: `Credentials for '${provider}' saved successfully.` });
  } catch (error) {
    console.error('Error during encryption or KV storage:', error);
    return c.json({ error: 'Failed to save credentials.' }, 500);
  }
});

// --- ENDPOINT 2: POST /api/generate-url ---
app.post('/api/generate-url', async (c) => {
  const userId = c.req.header('Cf-Access-Authenticated-User-Email')
               ?? c.req.header('X-User-ID');
  if (!userId) {
    return c.json({ error: 'Unauthorized. Missing authentication.' }, 401);
  }

  const { provider, bucket, filename } = await c.req.json<GenerateBody>();

  if (!provider || !bucket || !filename) {
    return c.json({ error: 'Missing "provider", "bucket", or "filename".' }, 400);
  }

  const masterKey = c.env.MASTER_ENCRYPTION_KEY;
  if (!masterKey) {
    console.error('FATAL ERROR: MASTER_ENCRYPTION_KEY is not configured.');
    return c.json({ error: 'Internal server error.' }, 500);
  }

  try {
    const kvKey = `config:${userId}:${provider}`;
    const encryptedCredentials = await c.env.SECRET_STORE.get(kvKey);

    if (!encryptedCredentials) {
      return c.json({
        error: `No credentials found for '${provider}'. Please use /api/config first.`
      }, 404);
    }

    const plaintextCredentials = await decrypt(masterKey, encryptedCredentials);
    const credentials = JSON.parse(plaintextCredentials);

    // --- Provider-specific validation ---
    const providerLower = provider.toLowerCase();
    let signedUrl: string;

    if (providerLower === 'aws') {
      // Validate AWS credentials
      if (!credentials.accessKeyId || !credentials.secretAccessKey) {
        return c.json({
          error: 'Incomplete AWS credentials. Required: "accessKeyId" and "secretAccessKey".'
        }, 400);
      }
      signedUrl = await generateAwsUploadUrl(credentials, { bucket, filename });

    } else if (providerLower === 'r2') {
      // Validate R2 credentials
      if (!credentials.accountId || !credentials.accessKeyId || !credentials.secretAccessKey) {
        return c.json({
          error: 'Incomplete R2 credentials. Required: "accountId", "accessKeyId", and "secretAccessKey".'
        }, 400);
      }
      signedUrl = await generateR2UploadUrl(credentials, { bucket, filename });

    } else if (providerLower === 'azure') {
      // Validate Azure credentials
      if (!credentials.accountName || !credentials.accountKey) {
        return c.json({
          error: 'Incomplete Azure credentials. Required: "accountName" and "accountKey".'
        }, 400);
      }
      signedUrl = await generateAzureUploadUrl(credentials, {
        bucket: bucket,
        filename: filename
      });

    } else if (providerLower === 'gcs') {
      // Validate Google Cloud Storage credentials
      if (!credentials.accessKeyId || !credentials.secretAccessKey) {
        return c.json({
          error: 'Incomplete GCS credentials. Required: "accessKeyId" (HMAC) and "secretAccessKey" (HMAC).'
        }, 400);
      }
      signedUrl = await generateGcsUploadUrl(credentials, { bucket, filename });

    } else {
      return c.json({
        error: `Provider '${provider}' is not supported. Use: aws, r2, azure, or gcs.`
      }, 400);
    }

    return c.json({ success: true, url: signedUrl });

  } catch (error) {
    console.error('Error generating presigned URL:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return c.json({ error: 'Failed to generate URL.' }, 500);
  }
});

export default app