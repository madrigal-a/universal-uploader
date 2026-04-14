# Universal Uploader - Serverless Multi-Cloud API

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript&logoColor=white)
![AWS S3](https://img.shields.io/badge/AWS-S3-FF9900?style=flat&logo=amazons3&logoColor=white)
![Azure Blob](https://img.shields.io/badge/Azure-Blob_Storage-0078D4?style=flat&logo=microsoftazure&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google-Cloud_Storage-4285F4?style=flat&logo=googlecloud&logoColor=white)
![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2-F38020?style=flat&logo=cloudflare&logoColor=white)

---

## 📋 Table of Contents

- [Introduction](#-introduction)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Cloud Provider Setup](#-cloud-provider-setup-guide)
- [Testing Utility](#-testing-utility)
- [API Reference](#-api-reference)
- [Frontend Integration](#-frontend-integration-examples)
- [Security](#-security)
- [License](#-license)

---

## 🎯 Introduction

### The Problem

**Managing cloud credentials on the frontend is fundamentally insecure.** Exposing AWS Secret Keys, Azure Account Keys, or GCS credentials in client-side code creates critical security vulnerabilities.

Additionally, **setting up SDKs for multiple cloud providers is painful**. Each provider has different authentication mechanisms, URL signing algorithms, and SDK requirements—multiplying development time and maintenance burden.

### The Solution

**Universal Uploader** is a unified, serverless middleware deployed on **your own Cloudflare Workers account**. It generates secure **Presigned URLs** on demand, allowing clients to upload files directly to any supported cloud storage provider without ever touching your credentials.

**Key Benefits:**

- ✅ **Zero credential exposure** — Keys never leave your server
- ✅ **One API, four providers** — AWS S3, Azure Blob, Google Cloud, Cloudflare R2
- ✅ **Serverless & scalable** — Runs on Cloudflare's global edge network
- ✅ **Cost-effective** — Cloudflare Workers free tier includes 100K requests/day
- ✅ **Framework agnostic** — Works with any frontend (React, Vue, mobile, etc.)

---

## 🏗 Architecture

```mermaid
sequenceDiagram
    participant Client as Frontend Client
    participant Worker as Universal Uploader<br/>(Cloudflare Worker)
    participant KV as Cloudflare KV<br/>(Encrypted Credentials)
    participant Cloud as Cloud Provider<br/>(S3/R2/Azure/GCS)

    Client->>Worker: POST /api/generate-url<br/>{provider, bucket, filename}
    Worker->>KV: Retrieve encrypted credentials
    KV-->>Worker: Decrypted credentials
    Worker->>Worker: Generate Presigned URL
    Worker-->>Client: {url: "https://...signed..."}
    Client->>Cloud: PUT file directly<br/>(using presigned URL)
    Cloud-->>Client: 200 OK / 201 Created
```

**Flow Summary:**
1. Client requests a presigned URL from the Worker
2. Worker retrieves and decrypts stored credentials from KV
3. Worker generates a time-limited signed URL
4. Client uploads directly to cloud storage (Worker is not in the data path)

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version | Notes |
|------------|---------|-------|
| Node.js | 18+ | LTS recommended |
| npm | 9+ | Comes with Node.js |
| Cloudflare Account | Free Tier | Works perfectly on free tier |
| Wrangler CLI | 4+ | Installed via npm |

### Installation

```bash
# Clone or download the project
cd universal-uploader

# Install dependencies
npm install

# Copy environment template
cp .dev.vars.example .dev.vars

# Generate a master encryption key
openssl rand -base64 32
# Paste the output into .dev.vars as MASTER_ENCRYPTION_KEY
```

---

## 💻 Local Development & Testing

Before deploying to production, you should **always test locally first**. This project includes a powerful testing utility that simulates a real client uploading files to your cloud providers.

### Step 1: Start the Local Server

Open a terminal and run:

```bash
npm run dev
```

Your local Worker is now running at `http://localhost:8787`. **Keep this terminal open.**

### Step 2: Set Up the Test Utility

The included `test-endpoints.sh` script is your best friend. It will:

- Save your credentials to the Worker (just like a real client would)
- Request a presigned URL for each provider
- Actually upload a test file to verify everything works

**Configure your credentials:**

```bash
# Copy the template
cp test-config.example.json test-config.json

# Edit with your real credentials
nano test-config.json   # or use any editor
```

**Crucial:** Make sure `apiBaseUrl` points to your local server:

```json
{
  "apiBaseUrl": "http://localhost:8787",
  "testUserId": "test-user-local",
  "aws": {
    "accessKeyId": "YOUR_KEY",
    "secretAccessKey": "YOUR_SECRET",
    "bucket": "your-bucket",
    "testFilename": "test.txt"
  }
  // ... other providers
}
```

### Step 3: Run the Tests

Open a **second terminal** (keep the server running in the first one):

```bash
# Make executable (first time only)
chmod +x test-endpoints.sh

# Test one provider
./test-endpoints.sh --aws

# Or test ALL configured providers at once
./test-endpoints.sh --all
```

**If all tests pass, you're ready to deploy!** If something fails, fix it now — debugging locally is much easier than debugging in production.

---

## ☁️ Deployment Guide

Once your local tests pass, follow these steps to go live.

### Step 1: Create a Cloudflare Account (If Needed)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Sign up for a free account
3. Verify your email

> The free tier includes **100,000 requests/day** — more than enough for most use cases.

### Step 2: Log In to Wrangler

Your terminal must be linked to Cloudflare before you can deploy:

```bash
npx wrangler login
```

A browser window will open. Log in and click **Allow** to authorize. You'll see:

```
Successfully logged in.
```

### Step 3: Deploy

```bash
npm run deploy
```

After a few seconds, you'll see your production URL:

```
Published api-uploader (1.5 sec)
  https://api-uploader.YOUR-SUBDOMAIN.workers.dev
```

**Save this URL!** This is where your clients will send requests.

### Step 4: Set Production Secrets

> ⚠️ **Your `.dev.vars` file is LOCAL ONLY.** Secrets do not upload automatically!

Set your encryption key in production:

```bash
npx wrangler secret put MASTER_ENCRYPTION_KEY
```

Paste the same key you used locally and press Enter.

### Step 5: Verify Production (The Master Trick)

Here's the beauty of this setup: **you can reuse the exact same test script to verify production.**

1. **Edit `test-config.json`** — change just ONE line:

   ```json
   {
     "apiBaseUrl": "https://api-uploader.YOUR-SUBDOMAIN.workers.dev",
     ...
   }
   ```

2. **Run the tests again:**

   ```bash
   ./test-endpoints.sh --all
   ```

3. **All tests pass?** Your production API is working correctly! 🎉

### Quick Reference

| Phase | What to do |
|-------|------------|
| **Local** | `npm run dev` → test-config.json uses `localhost:8787` → `./test-endpoints.sh --all` |
| **Deploy** | `npx wrangler login` → `npm run deploy` → `npx wrangler secret put MASTER_ENCRYPTION_KEY` |
| **Verify** | Change `apiBaseUrl` to production URL → `./test-endpoints.sh --all` |

---

## ⚡ Cloud Provider Setup Guide

This section provides step-by-step instructions for obtaining credentials from each supported cloud provider.

---

### AWS S3

#### Step 1: Create an IAM User

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Navigate to **Users** → **Create User**
3. Enter a username (e.g., `universal-uploader-service`)
4. Click **Next**

#### Step 2: Attach Permissions

1. Select **Attach policies directly**
2. Search for and select `AmazonS3FullAccess`
3. Click **Next** → **Create User**

#### Step 3: Generate Access Keys

1. Click on the newly created user
2. Go to **Security credentials** tab
3. Click **Create access key**
4. Select **Application running outside AWS**
5. **Save your Access Key ID and Secret Access Key** securely

> ⚠️ **Important**: This API is configured for the `us-east-1` (N. Virginia) region. Ensure your S3 bucket is created in this region, or modify `aws.ts` if using a different region.

#### Required Credentials

```json
{
  "accessKeyId": "YOUR_AWS_ACCESS_KEY_ID",
  "secretAccessKey": "YOUR_AWS_SECRET_ACCESS_KEY"
}
```

---

### Cloudflare R2

#### Step 1: Create a Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2 Object Storage** → **Create bucket**
3. Enter a bucket name and create it

#### Step 2: Generate API Token

1. In R2 section, click **Manage R2 API Tokens**
2. Click **Create API token**
3. Configure the token:
   - **Permissions**: Object Read & Write
   - **Specify bucket(s)**: Select your bucket or "Apply to all buckets"
4. Click **Create API Token**
5. **Save the Access Key ID and Secret Access Key**

#### Step 3: Get Your Account ID

1. Your Account ID is visible in the Cloudflare dashboard URL or in **Account Home**
2. It's a 32-character hexadecimal string

#### Required Credentials

```json
{
  "accountId": "YOUR_R2_ACCOUNT_ID",
  "accessKeyId": "YOUR_R2_ACCESS_KEY_ID",
  "secretAccessKey": "YOUR_R2_SECRET_ACCESS_KEY"
}
```

---

### Google Cloud Storage

#### The Interoperability Trick

GCS offers an **S3-compatible API** using HMAC keys. This allows Universal Uploader to use the same signing mechanism as AWS.

> ⚠️ **Important**: These are **NOT** the same as Service Account JSON keys. You need HMAC keys specifically.

#### Step 1: Enable Interoperability

1. Go to [Cloud Storage Settings](https://console.cloud.google.com/storage/settings)
2. Click the **Interoperability** tab
3. If prompted, click **Enable interoperability access**

#### Step 2: Create HMAC Key

1. Under "Access keys for service accounts" or "User account HMAC", click **Create a key**
2. If using a service account, select the appropriate account
3. **Save the Access Key and Secret** — the secret is only shown once!

#### Required Credentials

```json
{
  "accessKeyId": "YOUR_GCS_HMAC_ACCESS_KEY",
  "secretAccessKey": "YOUR_GCS_HMAC_SECRET_KEY"
}
```

---

### Azure Blob Storage

#### Step 1: Create a Storage Account

1. Go to [Azure Portal](https://portal.azure.com/)
2. Search for **Storage accounts** → **Create**
3. Fill in the basics:
   - **Subscription**: Your subscription
   - **Resource group**: Create new or select existing
   - **Storage account name**: Unique lowercase name
   - **Region**: Choose preferred region
4. Review and create

#### Step 2: Create a Container

1. Open your storage account
2. Go to **Containers** under "Data storage"
3. Click **+ Container**
4. Enter a name (e.g., `uploads`)
5. Set **Public access level** to **Private**
6. Create the container

#### Step 3: Get Access Keys

1. In your storage account, go to **Access keys**
2. Click **Show** next to key1
3. Copy the **Key** (this is your `accountKey`, Base64 encoded)

#### Required Credentials

```json
{
  "accountName": "yourstorageaccount",
  "accountKey": "YOUR_AZURE_ACCOUNT_KEY_BASE64"
}
```

> ⚠️ **CRITICAL**: When uploading to Azure, your client **MUST** include this header:
> ```
> x-ms-blob-type: BlockBlob
> ```
> Without this header, Azure returns a 400 error.

---

## 🧪 Testing Utility

This project includes a comprehensive bash script for testing all providers.

### Setup

```bash
# 1. Copy the example config
cp test-config.example.json test-config.json

# 2. Edit test-config.json with your real credentials
nano test-config.json

# 3. Make the script executable
chmod +x test-endpoints.sh
```

### Running Tests

```bash
# Test a single provider
./test-endpoints.sh --aws
./test-endpoints.sh --azure

# Test multiple providers
./test-endpoints.sh --aws --gcs

# Test all configured providers
./test-endpoints.sh --all

# Show help
./test-endpoints.sh --help
```

### Expected Output

```
╔══════════════════════════════════════════╗
║     Universal Uploader - Test Suite      ║
╚══════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Testing: AWS S3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/3] Saving credentials...
✓ Credentials saved
[2/3] Generating presigned URL...
✓ URL generated
[3/3] Uploading test file...
✓ File uploaded successfully (HTTP 200)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ AWS S3: OK

All tests passed ✓
```

---

## 📚 API Reference

### Base URL

- **Development**: `http://localhost:8787`
- **Production**: `https://your-worker.your-subdomain.workers.dev`

---

### POST `/api/config`

Stores encrypted credentials for a provider.

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-User-ID` | Yes | Unique user identifier |

#### Request Bodies by Provider

**AWS S3**
```json
{
  "provider": "aws",
  "credentials": {
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
  }
}
```

**Cloudflare R2**
```json
{
  "provider": "r2",
  "credentials": {
    "accountId": "your-account-id",
    "accessKeyId": "your-r2-access-key",
    "secretAccessKey": "your-r2-secret-key"
  }
}
```

**Google Cloud Storage**
```json
{
  "provider": "gcs",
  "credentials": {
    "accessKeyId": "GOOGXXXXXXXX",
    "secretAccessKey": "your-hmac-secret"
  }
}
```

**Azure Blob Storage**
```json
{
  "provider": "azure",
  "credentials": {
    "accountName": "yourstorageaccount",
    "accountKey": "base64-encoded-key=="
  }
}
```

#### Response

```json
{
  "success": true,
  "message": "Credentials for 'aws' saved successfully."
}
```

---

### POST `/api/generate-url`

Generates a presigned upload URL.

#### Request

```json
{
  "provider": "aws",
  "bucket": "my-bucket",
  "filename": "uploads/image.png"
}
```

#### Response

```json
{
  "success": true,
  "url": "https://my-bucket.s3.us-east-1.amazonaws.com/uploads/image.png?X-Amz-Algorithm=..."
}
```

---

## 💻 Frontend Integration Examples

### JavaScript / Fetch API

```javascript
// Step 1: Request presigned URL from your worker
async function getUploadUrl(filename) {
  const response = await fetch('https://your-worker.workers.dev/api/generate-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': 'user-123'
    },
    body: JSON.stringify({
      provider: 'aws',
      bucket: 'my-bucket',
      filename: filename
    })
  });
  
  const data = await response.json();
  return data.url;
}

// Step 2: Upload file directly to cloud storage
async function uploadFile(file) {
  const presignedUrl = await getUploadUrl(file.name);
  
  const uploadResponse = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      // IMPORTANT: Add this header for Azure only!
      // 'x-ms-blob-type': 'BlockBlob'
    },
    body: file
  });
  
  if (uploadResponse.ok) {
    console.log('Upload successful!');
  }
}

// Usage with file input
document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  uploadFile(file);
});
```

### React Example

```jsx
import { useState } from 'react';

function FileUploader({ provider, bucket }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    setUploading(true);

    try {
      // Get presigned URL
      const urlResponse = await fetch('/api/generate-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user-id'
        },
        body: JSON.stringify({ provider, bucket, filename: file.name })
      });

      const { url } = await urlResponse.json();

      // Upload file
      const headers = { 'Content-Type': file.type };
      if (provider === 'azure') {
        headers['x-ms-blob-type'] = 'BlockBlob';
      }

      await fetch(url, {
        method: 'PUT',
        headers,
        body: file
      });

      alert('Upload complete!');
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <input type="file" onChange={handleUpload} disabled={uploading} />
  );
}
```

---

## 🔒 Security

> ⚠️ **REQUIRED: Protect your Worker with Cloudflare Access before going to production.**
>
> This Worker has no built-in authentication layer. Without Cloudflare Access (or an equivalent reverse proxy), anyone who knows your Worker URL can store credentials and generate presigned URLs without restriction.

### Step 1: Set Up Cloudflare Access (Required for Production)

Cloudflare Access acts as a Zero Trust gateway in front of your Worker. Only authenticated users can reach the API — no code changes needed.

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Access** → **Applications**
2. Click **Add an Application** → **Self-hosted**
3. Set the **Application domain** to your Worker URL (e.g., `api-uploader.YOUR-SUBDOMAIN.workers.dev`)
4. Configure an **Identity Provider** (Google, GitHub, Okta, Azure AD, etc.)
5. Define an **Access Policy** (e.g., allow only users with `@yourcompany.com` email)

Once enabled, Cloudflare Access automatically injects the authenticated user's email as the `Cf-Access-Authenticated-User-Email` header on every request. **This header is set by Cloudflare's edge — clients cannot forge it.** The Worker uses it as the unique user identifier, ensuring each user can only access their own stored credentials.

> For programmatic access (mobile apps, backends, scripts), use [Cloudflare Access Service Tokens](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/) instead of browser-based login.

### Credential Storage

- All provider credentials are **encrypted using AES-256-GCM** before storage
- Encrypted credentials are stored in **Cloudflare KV** (key-value store)
- The **master encryption key** is stored as a Cloudflare Worker secret, never in code
- Credentials are decrypted only at request time and never logged

### Presigned URL Security

- URLs expire after **5 minutes** by default
- Each URL is valid for a **single specific file path**
- URLs are cryptographically signed and cannot be tampered with

### Best Practices

1. **Always deploy behind Cloudflare Access** — never expose the Worker URL publicly without it
2. **Rotate your master encryption key** periodically
3. **Use separate credentials** with minimal permissions for each provider
4. **Monitor your cloud storage** access logs for anomalies
5. **Implement rate limiting** on your Worker if needed

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

This is an **open source project**. We encourage you to use the documentation and the included testing utility.

| Support Type | Availability |
|--------------|--------------|
| **Documentation** | ✅ Provided in this README |
| **Bugs** | ✅ Please open an Issue on GitHub |
| **Cloud Account Setup** | ❌ We cannot provide consulting on personal AWS/Azure/GCS account configuration |

### Before Requesting Support

1. ✅ Read the complete [Cloud Provider Setup Guide](#-cloud-provider-setup-guide)
2. ✅ Run the [Testing Utility](#-testing-utility) to diagnose issues
3. ✅ Check that your credentials are correct and have proper permissions
4. ✅ Verify your bucket/container exists and is in the correct region

---


