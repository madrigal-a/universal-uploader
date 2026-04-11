// src/services/azure.ts

/**
 * Native Azure SAS implementation for Cloudflare Workers
 * No dependencies on @azure/storage-blob
 */

interface AzureCredentials {
  accountName: string;
  accountKey: string;
}

interface UrlOptions {
  bucket: string; // Container in Azure terminology
  filename: string;
}

/**
 * Converts a Base64 string to Uint8Array
 * Cleans and validates Base64 before decoding
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Clean Base64: remove spaces, newlines, etc.
  let cleaned = base64.replace(/\s/g, '');

  // Ensure correct padding
  const remainder = cleaned.length % 4;
  if (remainder > 0) {
    cleaned += '='.repeat(4 - remainder);
  }

  try {
    const binaryString = atob(cleaned);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new Error(`Error decoding Azure accountKey. Ensure it is a valid Base64 string. Error: ${error}`);
  }
}

/**
 * Generates HMAC-SHA256 signature using Web Crypto API
 */
async function hmacSha256(key: Uint8Array, message: string): Promise<string> {
  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the message
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(message)
  );

  // Convert to Base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Formats a date in ISO 8601 UTC format (without milliseconds)
 */
function formatDateForSAS(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Generates a presigned URL with SAS for Azure Blob Storage
 * Documentation: https://learn.microsoft.com/en-us/rest/api/storageservices/create-service-sas
 */
export async function generateAzureUploadUrl(
  credentials: AzureCredentials,
  options: UrlOptions
): Promise<string> {

  const { accountName, accountKey } = credentials;
  const { bucket: containerName, filename: blobName } = options;

  // 1. Define SAS token parameters
  const now = new Date();
  // Subtract 5 minutes from start time to compensate for clock skew between servers
  const startsOn = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes before
  const expiresOn = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes after

  const signedVersion = '2021-06-08'; // Azure Storage API version
  const signedPermissions = 'cw'; // create + write (alphabetical order required)
  const signedStart = formatDateForSAS(startsOn);
  const signedExpiry = formatDateForSAS(expiresOn);
  const signedResource = 'b'; // 'b' for blob
  const canonicalizedResource = `/blob/${accountName}/${containerName}/${blobName}`;

  // 2. Build the string to sign (StringToSign)
  // Specific order for version 2020-12-06 and later (includes 2021-06-08):
  // https://learn.microsoft.com/en-us/rest/api/storageservices/create-service-sas#version-2020-12-06-and-later
  const stringToSign = [
    signedPermissions,        // sp
    signedStart,              // st
    signedExpiry,             // se
    canonicalizedResource,    // Canonicalized resource
    '',                       // signedIdentifier (si) - not used
    '',                       // signedIP (sip) - not used
    '',                       // signedProtocol (spr) - not used
    signedVersion,            // sv
    signedResource,           // sr (b = blob)
    '',                       // signedSnapshotTime - not used
    '',                       // signedEncryptionScope (ses) - not used
    '',                       // rscc - Cache-Control
    '',                       // rscd - Content-Disposition
    '',                       // rsce - Content-Encoding
    '',                       // rscl - Content-Language
    ''                        // rsct - Content-Type
  ].join('\n');

  // 3. Decode account key from Base64
  const keyBytes = base64ToUint8Array(accountKey);

  // 4. Sign the string with HMAC-SHA256
  const signature = await hmacSha256(keyBytes, stringToSign);

  // 5. Build query string parameters
  const sasParams = new URLSearchParams({
    sv: signedVersion,
    st: signedStart,
    se: signedExpiry,
    sr: signedResource,
    sp: signedPermissions,
    sig: signature
  });

  // 6. Build and return the complete URL
  const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`;
  return `${blobUrl}?${sasParams.toString()}`;
}