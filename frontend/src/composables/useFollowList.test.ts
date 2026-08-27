import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useFollowList } from './useFollowList'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('useFollowList', () => {
  it('load: 指定したタブに応じたエンドポイントから一覧を取得する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: 2, username: 'jiro', display_name: '次郎', avatar_url: null }],
    })

    const { load, activeTab, users, error } = useFollowList()
    await load(1, 'followers')

    expect(apiClient.get).toHaveBeenCalledWith('/api/users/1/followers')
    expect(activeTab.value).toBe('followers')
    expect(users.value.map((u) => u.id)).toEqual([2])
    expect(error.value).toBe(false)
  })

  it('load: followingタブに切り替えると別のエンドポイントを呼ぶ', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    const { load, activeTab } = useFollowList()
    await load(1, 'following')

    expect(apiClient.get).toHaveBeenCalledWith('/api/users/1/following')
    expect(activeTab.value).toBe('following')
  })

  it('load: 先に始まったタブの応答が後から届いても、新しいタブの一覧を上書きしない', async () => {
    let resolveFollowers!: (v: unknown) => void
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1/followers') {
        return new Promise((resolve) => {
          resolveFollowers = resolve
        })
      }
      return Promise.resolve({ data: [{ id: 9, username: 'ken', display_name: '健', avatar_url: null }] })
    })

    const { load, activeTab, users, loading } = useFollowList()
    const first = load(1, 'followers')
    const second = load(1, 'following')
    await second
    expect(activeTab.value).toBe('following')
    expect(users.value.map((u) => u.id)).toEqual([9])

    resolveFollowers({ data: [{ id: 2, username: 'jiro', display_name: '次郎', avatar_url: null }] })
    await first
    expect(users.value.map((u) => u.id)).toEqual([9])
    expect(loading.value).toBe(false)
  })

  it('load: 失敗時はerrorがtrueになる', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('failed'))

    const { load, error, users } = useFollowList()
    await load(1, 'followers')

    expect(error.value).toBe(true)
    expect(users.value).toEqual([])
  })
})
