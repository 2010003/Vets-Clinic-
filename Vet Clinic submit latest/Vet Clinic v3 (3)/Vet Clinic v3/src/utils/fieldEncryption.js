// Simple field-level encryption for sensitive text (e.g., medical notes)
// Uses Web Crypto AES-GCM with a static key derived from an env var or fallback string.
// Note: This improves data-at-rest protection in Firestore, but true security
// still depends on how you manage the key.

const DEFAULT_KEY = (import.meta.env.VITE_ENCRYPTION_KEY || 'demo_vetclinic_encryption_key_32_chars').padEnd(32).slice(0, 32);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getCryptoKey() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available in this environment');
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(DEFAULT_KEY),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(plainText) {
  if (!plainText) return '';
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainText)
  );
  const cipherBytes = new Uint8Array(ciphertext);
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...cipherBytes));
  return `${ivB64}:${ctB64}`;
}

export async function decryptText(encText) {
  if (!encText) return '';
  const [ivB64, ctB64] = encText.split(':');
  if (!ivB64 || !ctB64) return '';
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
  const key = await getCryptoKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return decoder.decode(decrypted);
}
