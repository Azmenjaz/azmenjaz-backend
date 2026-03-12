/**
 * Database-backed session store for corporate portal.
 * Sessions are persisted in PostgreSQL so they survive server restarts/deploys.
 */

const pool = require('../config/database');

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Init table ────────────────────────────────────────────────────────────────
async function initSessionsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS company_sessions (
        token TEXT PRIMARY KEY,
        company_id INTEGER NOT NULL,
        company_name TEXT,
        company_email TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Clean up expired sessions on startup
    await pool.query(`DELETE FROM company_sessions WHERE expires_at < NOW()`);
    console.log('✅ Company sessions table ready');
  } catch (err) {
    console.error('❌ Failed to init sessions table:', err.message);
  }
}
initSessionsTable();

// ── Save a session ─────────────────────────────────────────────────────────────
async function saveSession(token, user) {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await pool.query(
    `INSERT INTO company_sessions (token, company_id, company_name, company_email, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [token, user.companyId, user.name, user.email, expiresAt]
  );
}

// ── Get a session ──────────────────────────────────────────────────────────────
async function getSession(token) {
  if (!token) return null;
  const result = await pool.query(
    `SELECT * FROM company_sessions WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    user: {
      companyId: row.company_id,
      name: row.company_name,
      email: row.company_email,
    },
    expiresAt: new Date(row.expires_at).getTime(),
  };
}

// ── Delete a session (logout) ──────────────────────────────────────────────────
async function deleteSession(token) {
  await pool.query(`DELETE FROM company_sessions WHERE token = $1`, [token]);
}

// ── Invalidate all sessions for a company (on delete) ─────────────────────────
async function invalidateCompanyTokens(companyId) {
  const result = await pool.query(
    `DELETE FROM company_sessions WHERE company_id = $1 RETURNING token`,
    [companyId]
  );
  console.log(`🔒 Invalidated ${result.rowCount} session(s) for company ${companyId}`);
  return result.rowCount;
}

module.exports = {
  TOKEN_TTL_MS,
  saveSession,
  getSession,
  deleteSession,
  invalidateCompanyTokens,
};
