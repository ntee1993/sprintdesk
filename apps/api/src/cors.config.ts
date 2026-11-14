export function getCorsOrigin(
  value: string | undefined = process.env.CORS_ORIGIN,
): string {
  if (process.env.NODE_ENV === 'production' && !value)
    throw new Error('CORS_ORIGIN is required in production');
  const origin = value === undefined ? 'http://localhost:5173' : value;
  try {
    const url = new URL(origin);
    if (
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') ||
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
