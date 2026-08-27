import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useProfile } from './useProfile'
import type { Post } from '@/types/post'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const profile = {
  id: 1,
  username: 'taro',
  display_name: '太郎',
  bio: 'よろしく',
  avatar_url: null,
  follower_count: 0,
  following_count: 0,
  followed_by_me: false,
}

function makePost(id: number, overrides: Partial<Post> = {}): Post {
  return {
    id,
    author: { id: 1, username: 'taro', display_name: '太郎', avatar_url: null },
    body: `投稿${id}`,
    images: [],
    image_ids: [],
    post_type: 'illustration',
    title: '',
    tags: [],
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

  it('load: 先に始まった読み込みの応答が後から届いても、新しい利用者の表示を上書きしない', async () => {
    const profile2 = { ...profile, id: 2, username: 'jiro', display_name: '次郎' }
    let resolveFirst!: (v: unknown) => void
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') {
        return new Promise((resolve) => {
          resolveFirst = resolve
        })
      }
      if (url === '/api/users/2') return Promise.resolve({ data: profile2 })
      return Promise.resolve({ data: { results: [], has_more: false } })
    })

    const { load, profile: loadedProfile, loading } = useProfile()
    const first = load(1)
    const second = load(2)
    await second
    // 後発（利用者2）の応答が先に反映される
    expect(loadedProfile.value).toEqual(profile2)

    // 先発（利用者1）の応答が遅れて届いても捨てられる
    resolveFirst({ data: profile })
    await first
    expect(loadedProfile.value).toEqual(profile2)
    expect(loading.value).toBe(false)
  })

  it('load: 前回の削除失敗エラーは新しい読み込みでクリアされる（別の利用者への遷移で古いエラーを残さない）', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') return Promise.resolve({ data: profile })
      return Promise.resolve({ data: { results: [makePost(1)], has_more: false } })
    })
    const { load, posts, deleteError, deletePost } = useProfile()
    await load(1)

    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))
    await deletePost(posts.value[0])
    expect(deleteError.value).not.toBeNull()

    await load(2)

    expect(deleteError.value).toBeNull()
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

  it('toggleFollow: 未フォロー状態からPOSTしてfollowed_by_me/follower_countを反映する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') return Promise.resolve({ data: profile })
      return Promise.resolve({ data: { results: [], has_more: false } })
    })
    const { load, profile: loadedProfile, toggleFollow } = useProfile()
    await load(1)

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { followed_by_me: true, follower_count: 1 },
    })
    await toggleFollow()

    expect(apiClient.post).toHaveBeenCalledWith('/api/users/1/follow')
    expect(loadedProfile.value?.followed_by_me).toBe(true)
    expect(loadedProfile.value?.follower_count).toBe(1)
  })

  it('toggleFollow: フォロー済みからDELETEして解除する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') {
        return Promise.resolve({ data: { ...profile, followed_by_me: true, follower_count: 1 } })
      }
      return Promise.resolve({ data: { results: [], has_more: false } })
    })
    const { load, profile: loadedProfile, toggleFollow } = useProfile()
    await load(1)

    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { followed_by_me: false, follower_count: 0 },
    })
    await toggleFollow()

    expect(apiClient.delete).toHaveBeenCalledWith('/api/users/1/follow')
    expect(loadedProfile.value?.followed_by_me).toBe(false)
    expect(loadedProfile.value?.follower_count).toBe(0)
  })

  it('toggleFollow: 失敗時はfollowErrorを設定する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') return Promise.resolve({ data: profile })
      return Promise.resolve({ data: { results: [], has_more: false } })
    })
    const { load, followError, toggleFollow } = useProfile()
    await load(1)

    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))
    await toggleFollow()

    expect(followError.value).not.toBeNull()
  })
})
