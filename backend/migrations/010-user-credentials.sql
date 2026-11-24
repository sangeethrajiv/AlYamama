-- 010: credentials for res_users.
-- The Odoo hashes are never copied (docs/migration_analysis/02_*); a password is set from the app and stored here as
-- a salted scrypt hash ("scrypt$<salt hex>$<hash hex>", see src/core/user/password.ts). NULL = this user cannot sign in.
ALTER TABLE res_users
  ADD COLUMN password_hash varchar,
  ADD COLUMN login_date    timestamp;
