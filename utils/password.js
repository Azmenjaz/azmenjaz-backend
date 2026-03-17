/**
 * Password hashing and verification.
 * Uses bcrypt for new hashes; supports legacy HMAC-SHA256 for migration on login.
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 12;
const LEGACY_SALT = process.env.PASSWORD_SALT || 'safarsmart_secret_2026';

/** True if stored hash looks like bcrypt ($2a$ or $2b$) */
function isBcryptHash(stored) {
  return typeof stored === 'string' && /^\$2[ab]\$/.test(stored);
}

/** Hash a password with bcrypt (for new users and rehashing). */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against stored hash.
 * @returns {Promise<{ ok: boolean, needsRehash?: boolean }>}
 * - ok: true if password matches
 * - needsRehash: true if password matched but was legacy HMAC (caller should update DB with bcrypt hash)
 */
async function verifyPassword(password, storedHash) {
  if (!storedHash || !password) return { ok: false };

  if (isBcryptHash(storedHash)) {
    const ok = await bcrypt.compare(password, storedHash);
    return { ok };
  }

  // Legacy HMAC-SHA256
  const legacyHash = crypto.createHmac('sha256', LEGACY_SALT).update(password).digest('hex');
  const ok = legacyHash === storedHash;
  return { ok, needsRehash: ok };
}

/**
 * In production, PASSWORD_SALT must be set (used only for legacy verification).
 * Call this at startup or when handling auth.
 */
function requirePasswordSaltInProduction() {
  if (process.env.NODE_ENV === 'production' && !process.env.PASSWORD_SALT) {
    throw new Error('PASSWORD_SALT must be set in production (used for legacy password verification)');
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  isBcryptHash,
  requirePasswordSaltInProduction,
};
