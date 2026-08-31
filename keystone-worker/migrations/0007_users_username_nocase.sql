-- Preserve the chosen username text while enforcing ASCII case-insensitive identity.
-- This intentionally fails if production contains case-only duplicates; run the
-- documented read-only collision preflight before applying it remotely.
CREATE UNIQUE INDEX users_username_nocase_unique
ON users(username COLLATE NOCASE);
