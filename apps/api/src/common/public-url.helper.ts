export function getPublicBaseUrl(org: { publicBaseUrl?: string | null }): string {
  return (org.publicBaseUrl || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}
