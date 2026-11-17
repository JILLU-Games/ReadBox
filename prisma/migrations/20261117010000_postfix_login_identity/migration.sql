-- R-02 additive migration: separate least-privilege PostgreSQL LOGIN role.
-- Existing migration history, mail tables and security-invoker views stay unchanged.
-- The password is never stored in Git or migrations; R-02 one-shot setup sets it.
DO $r02$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postfix_lookup') THEN
    RAISE EXCEPTION 'Expected postfix_lookup group role is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'readbox_postfix') THEN
    CREATE ROLE "readbox_postfix" LOGIN INHERIT
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;
  END IF;
END
$r02$;
ALTER ROLE "readbox_postfix" LOGIN INHERIT
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT "postfix_lookup" TO "readbox_postfix";
REVOKE ALL ON SCHEMA "public" FROM "readbox_postfix";
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "readbox_postfix";
