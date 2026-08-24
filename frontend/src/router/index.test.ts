import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import { router } from './index'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(apiClient.get).mockReset()
})

describe('router guard', () => {
  it('未ログイン利用者が/にアクセスすると/loginへリダイレクトされる', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('unauthorized'))

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('ログイン済み利用者は/にアクセスできる', async () => {
    const auth = useAuthStore()
    auth.currentUser = { id: 1, username: 'taro', display_name: '太郎', avatar_url: null }
    auth.isCheckingSession = false

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('timeline')
  })

  it('ログイン済み利用者が/loginへアクセスすると/へリダイレクトされる', async () => {
    const auth = useAuthStore()
    auth.currentUser = { id: 1, username: 'taro', display_name: '太郎', avatar_url: null }
    auth.isCheckingSession = false

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('timeline')
  })
})
