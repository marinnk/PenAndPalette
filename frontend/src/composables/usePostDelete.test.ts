import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { deletePostById, useDeletablePosts } from './usePostDelete'
import type { Post } from '@/types/post'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
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
  vi.mocked(apiClient.delete).mockReset()
})

describe('deletePostById', () => {
  it('成功したらtrueを返す', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({})

    const result = await deletePostById(1)

    expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/1')
    expect(result).toBe(true)
  })

  it('失敗したらfalseを返す', async () => {
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))

    const result = await deletePostById(1)

    expect(result).toBe(false)
  })
})

describe('useDeletablePosts', () => {
  it('deletePost: 成功したら一覧からその場で取り除く', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    const posts = ref([makePost(1), makePost(2)])
    const { deletePost } = useDeletablePosts(posts)

    await deletePost(makePost(1))

    expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/1')
    expect(posts.value.map((p) => p.id)).toEqual([2])
  })

  it('deletePost: 失敗したらdeleteErrorを設定し一覧はそのまま', async () => {
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))
    const posts = ref([makePost(1)])
    const { deletePost, deleteError } = useDeletablePosts(posts)

    await deletePost(makePost(1))

    expect(deleteError.value).toBe('削除に失敗しました。もう一度お試しください。')
    expect(posts.value.map((p) => p.id)).toEqual([1])
  })

  it('isDeleting: 処理中は連打しても2回目のリクエストは送らない', async () => {
    let resolveDelete: (value: unknown) => void = () => {}
    vi.mocked(apiClient.delete).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve
        }),
    )
    const posts = ref([makePost(1)])
    const { deletePost, isDeleting } = useDeletablePosts(posts)

    const firstCall = deletePost(makePost(1))
    expect(isDeleting(1)).toBe(true)
    await deletePost(makePost(1))

    expect(apiClient.delete).toHaveBeenCalledTimes(1)
    resolveDelete({})
    await firstCall
    expect(isDeleting(1)).toBe(false)
  })
})
