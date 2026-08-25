import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useUserLookup } from './useUserLookup'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('useUserLookup', () => {
  it('load: 指定した利用者のプロフィールを取得する', async () => {
    const profile = {
      id: 2,
      username: 'jiro',
      display_name: '次郎',
      bio: '',
      avatar_url: null,
      follower_count: 0,
      following_count: 0,
      followed_by_me: false,
    }
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: profile })

    const { load, user, error } = useUserLookup()
    await load(2)

    expect(apiClient.get).toHaveBeenCalledWith('/api/users/2')
    expect(user.value).toEqual(profile)
    expect(error.value).toBe(false)
  })

  it('load: 失敗時はerrorがtrueになりuserはnullのまま', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('not found'))

    const { load, user, error } = useUserLookup()
    await load(999)

    expect(error.value).toBe(true)
    expect(user.value).toBeNull()
  })
})
