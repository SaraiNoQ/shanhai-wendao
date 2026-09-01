import { describe, expect, it } from 'vitest'
import worker from './index'

describe('worker api', () => {
  it('reports the deployed service health', async () => {
    const response = worker.fetch(new Request('https://wendao.sarainoq.cn/api/health'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'shanhai-wendao',
      version: 'm5.6',
    })
  })

  it('returns a JSON 404 for unknown API routes', async () => {
    const response = worker.fetch(new Request('https://wendao.sarainoq.cn/api/missing'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'not_found' })
  })
})
