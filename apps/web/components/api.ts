export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, cache: 'no-store', headers: { ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const body = await response.json();
  if (!response.ok) { if (response.status === 401 && path !== '/auth/login' && path !== '/me') window.location.assign('/login'); throw new Error(body.error || 'Request failed.'); }
  return body as T;
}
