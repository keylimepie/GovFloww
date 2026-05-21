import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const CSRF_COOKIE_NAME = 'govflow_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function createCsrfToken(secret: string) {
  const nonce = randomBytes(32).toString('hex');
  return `${nonce}.${signNonce(nonce, secret)}`;
}

export function verifyCsrfToken(token: string | undefined, secret: string) {
  if (!token) return false;

  const [nonce, signature, extra] = token.split('.');
  if (extra || !nonce || !signature || !/^[a-f0-9]{64}$/.test(nonce)) {
    return false;
  }

  const expected = signNonce(nonce, secret);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(signature, 'hex');

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function signNonce(nonce: string, secret: string) {
  return createHmac('sha256', secret).update(nonce).digest('hex');
}

