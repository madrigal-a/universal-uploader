// src/crypto.ts

/**
 * --- Encryption Module ---
 *
 * This module handles encryption and decryption of user credentials
 * before storing them in Cloudflare KV.
 *
 * Uses AES-GCM algorithm, which provides both encryption and authentication,
 * preventing data tampering.
 */

/**
 * Converts the master key string (Base64) into a CryptoKey object
 * that the Web Crypto API can use.
 */
async function getCryptoKey(keyString: string): Promise<CryptoKey> {
  // 1. Decode the key from Base64 to binary buffer
  const rawKey = atob(keyString);
  const keyBytes = new Uint8Array(rawKey.length);
  for (let i = 0; i < rawKey.length; i++) {
    keyBytes[i] = rawKey.charCodeAt(i);
  }

  // 2. Import the binary key into CryptoKey format
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false, // not exportable
    ["encrypt", "decrypt"]
  );
}

/**
 * ENCRYPTS a text string (e.g., user's JSON credentials).
 *
 * @param keyString - Your MASTER_ENCRYPTION_KEY (from c.env)
 * @param plaintext - The text to protect (e.g., '{"accessKey":"..."}')
 * @returns - An encrypted Base64 string, ready to store in KV.
 */
export async function encrypt(
  keyString: string,
  plaintext: string
): Promise<string> {
  // 1. Get the CryptoKey
  const key = await getCryptoKey(keyString);

  // 2. Prepare the Initialization Vector (IV)
  // A random value that ensures the same text encrypted twice yields different results
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM

  // 3. Prepare the text to encrypt
  const encodedText = new TextEncoder().encode(plaintext);

  // 4. Encrypt the text
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encodedText
  );

  // 5. Combine IV and ciphertext for storage
  // The IV is essential for decryption
  const ivAndCiphertext = new Uint8Array(iv.length + ciphertext.byteLength);
  ivAndCiphertext.set(iv);
  ivAndCiphertext.set(new Uint8Array(ciphertext), iv.length);

  // 6. Return as a Base64 string for easy storage
  return btoa(String.fromCharCode.apply(null, Array.from(ivAndCiphertext)));
}

/**
 * DECRYPTS a text string (e.g., data retrieved from KV).
 *
 * @param keyString - Your MASTER_ENCRYPTION_KEY (from c.env)
 * @param base64Ciphertext - The encrypted string retrieved from KV.
 * @returns - The original plaintext (e.g., '{"accessKey":"..."}')
 */
export async function decrypt(
  keyString: string,
  base64Ciphertext: string
): Promise<string> {
  // 1. Get the CryptoKey
  const key = await getCryptoKey(keyString);

  // 2. Decode the Base64 string to binary
  const rawData = atob(base64Ciphertext);
  const ivAndCiphertext = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    ivAndCiphertext[i] = rawData.charCodeAt(i);
  }

  // 3. Separate IV from ciphertext (we combined them during encryption)
  const iv = ivAndCiphertext.slice(0, 12); // First 12 bytes are the IV
  const ciphertext = ivAndCiphertext.slice(12); // Rest is the ciphertext

  // 4. Decrypt
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      ciphertext
    );

    // 5. Convert the decrypted buffer back to a string
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data. The key or data may be corrupted.");
  }
}