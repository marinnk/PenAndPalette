import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from './auth'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

const user = { id: 1, username: 'taro', display_name: '太郎', avatar_url: null }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
})

describe('useAuthStore', () => {
  it('fetchMe: 成功したらcurrentUserが更新される', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: user })

    const auth = useAuthStore()
    await auth.fetchMe()

    expect(auth.currentUser).toEqual(user)
    expect(auth.isCheckingSession).toBe(false)
  })

  it('fetchMe: 未ログイン(401)の場合はcurrentUserがnullになり確認完了とする', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { detail: 'unauthorized' } },
    })

    const auth = useAuthStore()
    await auth.fetchMe()

    expect(auth.currentUser).toBeNull()
    expect(auth.isCheckingSession).toBe(false)
  })

  it('fetchMe: レスポンスの無い一時的な失敗はisCheckingSessionをtrueのままにし再試行できるようにする', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network error'))

    const auth = useAuthStore()
    await auth.fetchMe()

    expect(auth.currentUser).toBeNull()
    // ここでfalseにしてしまうと、一時的なネットワーク不調1回だけで
    // アプリ全体が永久にログイン画面へ固定されてしまう
    expect(auth.isCheckingSession).toBe(true)
  })

  it('fetchMe: 同時に呼ばれてもリクエストは1回にまとめられる', async () => {
    let resolveGet: (value: unknown) => void = () => {}
    vi.mocked(apiClient.get).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve
        }),
    )

    const auth = useAuthStore()
    const first = auth.fetchMe()
    const second = auth.fetchMe()
    resolveGet({ data: user })
    await Promise.all([first, second])

    expect(apiClient.get).toHaveBeenCalledTimes(1)
    expect(auth.currentUser).toEqual(user)
  })

  it('login: 成功したらcurrentUserが更新される', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: user })

    const auth = useAuthStore()
    const result = await auth.login({ email: 'taro@example.com', password: 'password123' })

    expect(result).toBe(true)
    expect(auth.currentUser).toEqual(user)
  })

  it('login: 失敗したらerrorMessageにサーバーのdetailが入る', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 401,
        data: { detail: 'メールアドレスまたはパスワードが正しくありません。' },
      },
    })

    const auth = useAuthStore()
    const result = await auth.login({ email: 'taro@example.com', password: 'wrong' })

    expect(result).toBe(false)
    expect(auth.currentUser).toBeNull()
    expect(auth.errorMessage).toBe('メールアドレスまたはパスワードが正しくありません。')
  })

  it('register: 成功したらcurrentUserが更新される', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: user })

    const auth = useAuthStore()
    const result = await auth.register({
      username: 'taro',
      email: 'taro@example.com',
      password: 'password123',
    })

    expect(result).toBe(true)
    expect(auth.currentUser).toEqual(user)
  })

  it('register: バリデーションエラー(400)はfieldErrorsに振り分けられる', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { email: ['このメールアドレスは既に登録されています。'] } },
    })

    const auth = useAuthStore()
    const result = await auth.register({
      username: 'taro',
      email: 'dup@example.com',
      password: 'password123',
    })

    expect(result).toBe(false)
    expect(auth.fieldErrors.email).toEqual(['このメールアドレスは既に登録されています。'])
  })

  it('logout: API呼び出しが失敗しても最終的にcurrentUserはnullになる（楽観的ログアウト）', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))

    const auth = useAuthStore()
    auth.currentUser = user

    await auth.logout()

    expect(auth.currentUser).toBeNull()
  })
})
