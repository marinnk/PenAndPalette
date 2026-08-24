import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { setLiked, setWanted, useReactablePosts } from './usePostReactions'
import type { Post } from '@/types/post'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

function makePost(id: number, overrides: Partial<Post> = {}): Post {
  return {
    id,
    author: { id: 1, username: 'author', display_name: '投稿者', avatar_url: null },
    body: `投稿${id}`,
    images: [],
    image_ids: [],
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
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('usePostReactions', () => {
  it('setLiked(true): POST /api/posts/{id}/likes を呼ぶ', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { like_count: 1, liked_by_me: true } })

    const result = await setLiked(1, true)

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts/1/likes')
    expect(result).toEqual({ like_count: 1, liked_by_me: true })
  })

  it('setLiked(false): DELETE /api/posts/{id}/likes を呼ぶ', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { like_count: 0, liked_by_me: false },
    })

    const result = await setLiked(1, false)

    expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/1/likes')
    expect(result).toEqual({ like_count: 0, liked_by_me: false })
  })

  it('setWanted(true): POST /api/posts/{id}/wants を呼ぶ', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { want_count: 1, wanted_by_me: true },
    })

    const result = await setWanted(2, true)

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts/2/wants')
    expect(result).toEqual({ want_count: 1, wanted_by_me: true })
  })

  it('setWanted(false): DELETE /api/posts/{id}/wants を呼ぶ', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { want_count: 0, wanted_by_me: false },
    })

    const result = await setWanted(2, false)

    expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/2/wants')
    expect(result).toEqual({ want_count: 0, wanted_by_me: false })
  })

  it('setLiked: リクエストが失敗した場合は例外を投げずnullを返す', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))

    const result = await setLiked(1, true)

    expect(result).toBeNull()
  })

  it('setWanted: リクエストが失敗した場合は例外を投げずnullを返す', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))

    const result = await setWanted(1, true)

    expect(result).toBeNull()
  })
})

describe('useReactablePosts', () => {
  it('toggleLike: 成功時は該当投稿にのみ結果を反映する', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { like_count: 1, liked_by_me: true },
    })
    const posts = ref([makePost(1), makePost(2)])
    const { toggleLike } = useReactablePosts(posts)

    await toggleLike(posts.value[0])

    expect(posts.value[0].like_count).toBe(1)
    expect(posts.value[0].liked_by_me).toBe(true)
    expect(posts.value[1].like_count).toBe(0)
  })

  it('toggleLike: 失敗時はreactionErrorにメッセージを設定し、投稿の状態は変えない', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))
    const posts = ref([makePost(1)])
    const { toggleLike, reactionError } = useReactablePosts(posts)

    await toggleLike(posts.value[0])

    expect(reactionError.value).toBe('いいねの更新に失敗しました。もう一度お試しください。')
    expect(posts.value[0].liked_by_me).toBe(false)
  })

  it('isPending: 処理中の投稿への連打（二重リクエスト）を防ぐ', async () => {
    let resolvePost: (value: unknown) => void = () => {}
    vi.mocked(apiClient.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve
        }),
    )
    const posts = ref([makePost(1)])
    const { toggleLike, isPending } = useReactablePosts(posts)

    const firstCall = toggleLike(posts.value[0])
    expect(isPending(1)).toBe(true)

    // 処理中に同じ投稿へもう一度呼んでも、2回目のリクエストは発行されない
    await toggleLike(posts.value[0])
    expect(apiClient.post).toHaveBeenCalledTimes(1)

    resolvePost({ data: { like_count: 1, liked_by_me: true } })
    await firstCall

    expect(isPending(1)).toBe(false)
  })
})
