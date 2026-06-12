Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const internalSecret = Deno.env.get('INTERNAL_API_SECRET')
  if (!internalSecret || req.headers.get('x-internal-secret') !== internalSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const appUrl = Deno.env.get('APP_URL')
  if (!appUrl) {
    return new Response(JSON.stringify({ error: 'app_url_not_configured' }), { status: 500 })
  }

  const body = await req.text()

  const res = await fetch(`${appUrl}/api/internal/notify`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': internalSecret,
    },
    body,
  })

  const data = await res.text()
  return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } })
})
