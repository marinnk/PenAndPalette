import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { usePostDetail } from './usePostDetail'
import type { Post } from '@/types/post'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const samplePost: Post = {
  id: 1,
  author: { id: 1, username: 'author', display_name: '投稿者', avatar_url: null },
  body: '本文',
  images: [],
  image_ids: [],
  like_count: 0,
  want_count: 0,
  comment_count: 0,
  liked_by_me: false,
  wanted_by_me: false,
  created_at: '2026-08-23T00:00:00Z',
  updated_at: '2026-08-23T00:00:00Z',
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('usePostDetail', () => {
  it('load: 成功したらpostが設定される', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: samplePost })

    const { post, load, error } = usePostDetail()
    await load(1)

    expect(apiClient.get).toHaveBeenCalledWith('/api/posts/1')
    expect(post.value).toEqual(samplePost)
    expect(error.value).toBe(false)
  })

  it('load: 失敗したらerrorがtrueになる', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('not found'))

    const { load, error, post } = usePostDetail()
    await load(999)

    expect(error.value).toBe(true)
    expect(post.value).toBeNull()
  })

  it('load: 前回の削除失敗エラーは新しい読み込みでクリアされる（別の投稿への遷移で古いエラーを残さない）', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: samplePost })
    const { load, deleteError, deletePost } = usePostDetail()
    await load(1)

    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))
    await deletePost()
    expect(deleteError.value).not.toBeNull()

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...samplePost, id: 2 } })
    await load(2)

    expect(deleteError.value).toBeNull()
  })

  it('load: 前の投稿への応答が新しい投稿への応答より後に届いても上書きしない', async () => {
    let resolveFirst: (value: unknown) => void = () => {}
    vi.mocked(apiClient.get).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    const { post, load } = usePostDetail()
    const firstLoad = load(1)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...samplePost, id: 2 } })
    await load(2)
    expect(post.value?.id).toBe(2)

    resolveFirst({ data: samplePost })
    await firstLoad

    expect(post.value?.id).toBe(2)
  })

  it('toggleLike: 現在のpostにいいねの結果を反映する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: samplePost })
    const { post, load, toggleLike } = usePostDetail()
    await load(1)

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { like_count: 1, liked_by_me: true },
    })
    await toggleLike()

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts/1/likes')
    expect(post.value?.like_count).toBe(1)
    expect(post.value?.liked_by_me).toBe(true)
  })
})
