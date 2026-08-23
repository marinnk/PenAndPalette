import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useProfile } from './useProfile'
import type { Post } from '@/types/post'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const profile = { id: 1, username: 'taro', display_name: '太郎', bio: 'よろしく', avatar_url: null }

function makePost(id: number, overrides: Partial<Post> = {}): Post {
  return {
    id,
    author: { id: 1, username: 'taro', display_name: '太郎', avatar_url: null },
    body: `投稿${id}`,
    images: [],
    like_count: 0,
    want_count: 0,
    comment_count: 0,
    liked_by_me: false,
    wanted_by_me: false,
    created_at: '2026-08-23T00:00:00Z',
    updated_at: '2026-08-23T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('useProfile', () => {
  it('load: プロフィールと投稿一覧を並行取得する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') return Promise.resolve({ data: profile })
      return Promise.resolve({ data: { results: [makePost(1)], has_more: false } })
    })

    const { load, profile: loadedProfile, posts, error } = useProfile()
    await load(1)

    expect(apiClient.get).toHaveBeenCalledWith('/api/users/1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/posts', { params: { user_id: 1 } })
    expect(loadedProfile.value).toEqual(profile)
    expect(posts.value.map((p) => p.id)).toEqual([1])
    expect(error.value).toBe(false)
  })

  it('load: いずれかが失敗したらerrorがtrueになる', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'))

    const { load, error, profile: loadedProfile } = useProfile()
    await load(999)

    expect(error.value).toBe(true)
    expect(loadedProfile.value).toBeNull()
  })

  it('toggleWant: 該当投稿のみにかきたいの結果を反映する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') return Promise.resolve({ data: profile })
      return Promise.resolve({
        data: { results: [makePost(1), makePost(2)], has_more: false },
      })
    })
    const { load, posts, toggleWant } = useProfile()
    await load(1)

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { want_count: 1, wanted_by_me: true },
    })
    await toggleWant(posts.value[0])

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts/1/wants')
    expect(posts.value[0].want_count).toBe(1)
    expect(posts.value[1].want_count).toBe(0)
  })
})
