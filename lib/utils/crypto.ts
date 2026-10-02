// lib/utils/crypto.ts
// Enkripsi/dekripsi token sesi MagangHub.
// PENTING: fungsi ini hanya boleh dipanggil dari server/Edge Function — tidak pernah dari client.
// Dilarang log/print nilai plaintext token di sini.

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // bytes

function getKeyMaterial(): Promise<CryptoKey> {
  const rawKey = process.env.SESSION_ENCRYPTION_KEY;
  if (!rawKey) throw new Error('SESSION_ENCRYPTION_KEY tidak dikonfigurasi');

  // Pad/trim key ke 32 bytes (256-bit)
  const keyBuffer = new TextEncoder().encode(rawKey.padEnd(32, '0').slice(0, 32));

  return crypto.subtle.importKey('raw', keyBuffer, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Enkripsi nilai token sebelum disimpan ke database.
 * @returns string base64 format: "<iv_hex>.<ciphertext_base64>"
 */
export async function encryptSessionSecret(plaintext: string): Promise<string> {
  const key = await getKeyMaterial();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  const ivHex = Buffer.from(iv).toString('hex');
  const ciphertextB64 = Buffer.from(ciphertext).toString('base64');
  return `${ivHex}.${ciphertextB64}`;
}

/**
 * Dekripsi token sesi untuk dipakai saat fetch ke MagangHub.
 * Panggil hanya di Edge Function / server — hasil TIDAK boleh dikirim ke client.
 */
export async function decryptSessionSecret(encrypted: string): Promise<string> {
  const [ivHex, ciphertextB64] = encrypted.split('.');
  if (!ivHex || !ciphertextB64) throw new Error('Format enkripsi tidak valid');

  const key = await getKeyMaterial();
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
