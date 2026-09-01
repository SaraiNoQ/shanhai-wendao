const worker = {
  fetch(request: Request): Response {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        service: 'shanhai-wendao',
        version: 'm5.6',
      })
    }

    return Response.json({ error: 'not_found' }, { status: 404 })
  },
}

export default worker
