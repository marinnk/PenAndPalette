import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { apiClient } from './apiClient'

// apiClient.tsのinterceptor（401→refresh→リトライ）自体を検証するため、他のテストのように
// '@/lib/apiClient'をモックで置き換えるのではなく、実物のapiClientを使う。
// ネットワーク層だけをaxiosの`adapter`差し替えでモックする
// （axios-mock-adapter等の追加ライブラリを導入せず、axios標準のadapter機構だけで完結させる）
const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function okAxiosResponse(data: unknown, config: AxiosRequestConfig): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config: config as never }
}

function unauthorizedError(config: AxiosRequestConfig) {
  return Promise.reject({
    isAxiosError: true,
    config,
    response: {
      status: 401,
      data: { detail: 'unauthorized' },
      statusText: 'Unauthorized',
      headers: {},
      config,
    },
  })
}

describe('apiClient interceptor（401→refresh→リトライ）', () => {
  it('401を受けたリクエストはrefresh成功後に1回だけ透過的にリトライされる', async () => {
    let postsCallCount = 0
    apiClient.defaults.adapter = vi.fn(async (config) => {
      if (config.url === '/api/posts') {
        postsCallCount += 1
        if (postsCallCount === 1) return unauthorizedError(config)
        return okAxiosResponse({ ok: true }, config)
      }
      if (config.url === '/api/auth/refresh') {
        return okAxiosResponse({}, config)
      }
      throw new Error(`unexpected url: ${config.url}`)
    })

    const response = await apiClient.get('/api/posts')

    expect(response.data).toEqual({ ok: true })
    expect(postsCallCount).toBe(2) // 1回目(401) + リトライ(成功)
  })

  it('login/register/refresh自身への401はrefreshを呼ばずそのままエラーになる（無限リトライ防止）', async () => {
    const refreshSpy = vi.fn()
    apiClient.defaults.adapter = vi.fn(async (config) => {
      if (config.url === '/api/auth/login') return unauthorizedError(config)
      if (config.url === '/api/auth/refresh') {
        refreshSpy()
        return okAxiosResponse({}, config)
      }
      throw new Error(`unexpected url: ${config.url}`)
    })

    await expect(apiClient.post('/api/auth/login', {})).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(refreshSpy).not.toHaveBeenCalled()
  })

  it('リトライ後も401が続く場合はrefreshを繰り返さず1回で諦める（無限ループ防止）', async () => {
    let postsCallCount = 0
    let refreshCallCount = 0
    apiClient.defaults.adapter = vi.fn(async (config) => {
      if (config.url === '/api/posts') {
        postsCallCount += 1
        return unauthorizedError(config) // 何度呼ばれても401のまま
      }
      if (config.url === '/api/auth/refresh') {
        refreshCallCount += 1
        return okAxiosResponse({}, config)
      }
      throw new Error(`unexpected url: ${config.url}`)
    })

    await expect(apiClient.get('/api/posts')).rejects.toMatchObject({
      response: { status: 401 },
    })

    // 最初の呼び出し + リトライ1回のみ。2回目の401でさらにリトライはしない
    expect(postsCallCount).toBe(2)
    expect(refreshCallCount).toBe(1)
  })

  it('複数リクエストが同時に401でも、refreshの呼び出しは1回にまとめられる', async () => {
    const callCounts: Record<string, number> = {}
    let refreshCallCount = 0
    apiClient.defaults.adapter = vi.fn(async (config) => {
      const url = config.url as string
      if (url === '/api/auth/refresh') {
        refreshCallCount += 1
        await new Promise((resolve) => setTimeout(resolve, 5))
        return okAxiosResponse({}, config)
      }
      callCounts[url] = (callCounts[url] ?? 0) + 1
      if (callCounts[url] === 1) return unauthorizedError(config)
      return okAxiosResponse({ ok: true }, config)
    })

    const [a, b] = await Promise.all([apiClient.get('/api/a'), apiClient.get('/api/b')])

    expect(a.data).toEqual({ ok: true })
    expect(b.data).toEqual({ ok: true })
    expect(refreshCallCount).toBe(1)
  })
})
