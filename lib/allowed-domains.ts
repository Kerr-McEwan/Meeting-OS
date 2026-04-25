// Email allowlist module — currently open (any valid email accepted).
//
// To re-introduce a domain restriction later:
//   1. Set ALLOWED_EMAIL_DOMAINS env var to a comma-separated list (e.g.
//      "msquared.co.uk,ebsconstruction.co.uk").
//   2. Re-introduce the BEFORE INSERT trigger on auth.users (see the
//      original 0002_domain_trigger.sql migration for the SQL).

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getAllowedDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  if (!EMAIL_REGEX.test(email)) return false;
  const allowed = getAllowedDomains();
  // Empty allowlist = open invitations. Any well-formed email is accepted.
  if (allowed.length === 0) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return !!domain && allowed.includes(domain);
}
