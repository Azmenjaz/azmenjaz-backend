/**
 * Shared in-memory auth token store for corporate portal sessions.
 * Exported as a singleton so both corporateRoutes and adminRoutes
 * can access and invalidate tokens.
 */

const authTokens = new Map();

// Token TTL: 7 days
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Remove all tokens belonging to a specific company.
 * Called when a company is deleted from the admin panel.
 */
function invalidateCompanyTokens(companyId) {
  let removed = 0;
  for (const [token, session] of authTokens.entries()) {
    if (session.user && session.user.companyId === parseInt(companyId)) {
      authTokens.delete(token);
      removed++;
    }
  }
  console.log(`🔒 Invalidated ${removed} session(s) for company ${companyId}`);
  return removed;
}

module.exports = { authTokens, TOKEN_TTL_MS, invalidateCompanyTokens };
