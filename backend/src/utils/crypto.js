const crypto = require('crypto');
const ENCKEY = process.env.LOG_ENCRYPTION_KEY || 'default_32_byte_key_123456789012';
const ALGO = 'aes-256-gcm';

// Ensure key is 32 bytes:
function keyFromEnv() {
  let k = Buffer.from(ENCKEY, 'utf8');
  if (k.length < 32) {
    const pad = Buffer.alloc(32 - k.length, 0);
    k = Buffer.concat([k, pad]);
  } else if (k.length > 32) {
    k = k.slice(0, 32);
  }
  return k;
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const key = keyFromEnv();
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(data) {
  const raw = Buffer.from(data, 'base64');
  const iv = raw.slice(0, 12);
  const tag = raw.slice(12, 28);
  const enc = raw.slice(28);
  const key = keyFromEnv();
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return plain.toString('utf8');
}

module.exports = { encrypt, decrypt };
