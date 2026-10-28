import { randomUUID } from 'node:crypto';

export function stampResponse(res) {
  const requestId = randomUUID();
  const requestAt = new Date().toISOString();

  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Request-At', requestAt);

  return { requestId, requestAt };
}