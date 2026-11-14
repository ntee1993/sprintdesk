export function getCorsOrigin(
  value: string | undefined = process.env.CORS_ORIGIN,
): string {
  const origin = value === undefined ? 'http://localhost:5173' : value;
  try {
    const url = new URL(origin);
    if (
      origin.includes('*') ||
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.origin !== origin ||
      url.username ||
      url.password
    ) {
      throw new Error();
    }
    return origin;
  } catch {
    throw new Error('CORS_ORIGIN must be a single valid HTTP(S) origin');
  }
}
