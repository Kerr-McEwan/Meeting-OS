const DEFAULT_DOMAINS = ['msquared.co.uk', 'ebsconstruction.co.uk'];

export function getAllowedDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS;
  if (!raw) return DEFAULT_DOMAINS;
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return getAllowedDomains().includes(domain);
}
