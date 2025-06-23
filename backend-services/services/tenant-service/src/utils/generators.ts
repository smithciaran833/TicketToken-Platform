import { randomBytes } from 'crypto';

export function generateTenantId(): string {
  return `tenant_${randomBytes(8).toString('hex')}`;
}

export function generateApiKey(prefix: string): string {
  const key = randomBytes(32).toString('hex');
  return `${prefix}_${key}`;
}

export function generateSubdomain(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
}
