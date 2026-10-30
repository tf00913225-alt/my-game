// Credentials are sent only to the exact DEV origin and never across redirects.
export const DEV_ORIGIN = 'https://dev.four-symbols-dev.pages.dev';

export function accessHeaders(input) {
  if (new URL(input).origin !== DEV_ORIGIN) return null;
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (Boolean(id) !== Boolean(secret)) throw new Error('Incomplete DEV Access credentials');
  if (!id && process.env.CF_ACCESS_REQUIRED === '1') throw new Error('DEV Access credentials are required');
  return id ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : null;
}

// Continue only this request with its existing headers and DEV credentials.
// CDP overrides do not apply to subsequent redirect requests.
export function accessContinueParams(request) {
  const credentials = accessHeaders(request.request.url);
  if (!credentials) return {requestId: request.requestId};
  const headers = Object.entries(request.request.headers || {})
    .filter(([name]) => !/^cf-access-client-(id|secret)$/i.test(name))
    .map(([name,value]) => ({name,value: String(value)}));
  for (const [name,value] of Object.entries(credentials)) headers.push({name,value});
  return {requestId: request.requestId, headers};
}

export async function devAccessFetch(input, options = {}) {
  const url = new URL(input);
  const headers = new Headers(options.headers);
  if (url.origin === DEV_ORIGIN) {
    const credentials = accessHeaders(url);
    for (const [name, value] of Object.entries(credentials || {})) headers.set(name,value);
    return fetch(url, { ...options, headers, redirect: 'manual' });
  }
  return fetch(url, options);
}
