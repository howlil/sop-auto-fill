/**
 * Ekstrak pesan invariant dari error Prisma adapter (MySQL SIGNAL SQLSTATE 45000).
 * Dipakai agar trigger DB tidak jatuh sebagai 500 Internal Server Error.
 */
export function extractDbInvariantMessage(err: unknown): string | null {
  if (err === null || err === undefined || typeof err !== 'object') {
    return null;
  }
  const visited = new Set<object>();
  const queue: unknown[] = [err];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const record = current as Record<string, unknown>;
    const message = record.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      const trimmed = message.trim();
      if (
        record.state === '45000' ||
        record.code === 1644 ||
        record.originalCode === '1644' ||
        trimmed.includes('SOP terkait') ||
        trimmed.includes('Relasi SOP')
      ) {
        return trimmed;
      }
    }
    const originalMessage = record.originalMessage;
    if (typeof originalMessage === 'string' && originalMessage.trim().length > 0) {
      return originalMessage.trim();
    }
    if (record.cause !== undefined) {
      queue.push(record.cause);
    }
    if (record.error !== undefined) {
      queue.push(record.error);
    }
  }
  return null;
}
