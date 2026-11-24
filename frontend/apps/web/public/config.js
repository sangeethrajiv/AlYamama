/*
 * Deploy-time settings, read before the app starts. Edit this file on the server; no rebuild is needed.
 *   apiBase  where the Express API lives. Behind a reverse proxy that forwards /v2 to the backend, use '/v2'.
 *   userIdByRole / companyId / allowedCompanyIds are the stub-auth values sent as X-User-Id / X-Company-Id /
 *   X-Allowed-Company-Ids until real sign-in (JWT) exists. See docs/ACCOUNTING_FLOWS.txt section "Before going live".
 */
window.__ERP_CONFIG__ = {
  apiBase: 'http://localhost:3000/v2',
};
