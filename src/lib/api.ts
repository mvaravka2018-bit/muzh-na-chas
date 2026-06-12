export class ApiError extends Error {
  constructor(public status: number, public body: { error?: string }) {
    super(typeof body.error === 'string' ? body.error : 'request_failed')
  }
}

export async function apiFetch<T>(
  path: string,
  accessToken: string | null,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`)
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const res = await fetch(path, { ...init, headers })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(res.status, data)
  }

  return data as T
}
