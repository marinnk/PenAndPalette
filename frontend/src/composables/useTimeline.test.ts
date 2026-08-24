import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useTimeline } from './useTimeline'
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
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTimeline', () => {
  it('load(): 一覧を取得しhasMore・pollAnchorを反映する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(2), makePost(1)], has_more: true },
    })

    const timeline = useTimeline()
    await timeline.load()

    expect(apiClient.get).toHaveBeenCalledWith('/api/posts', {
      params: { scope: 'all', limit: 20 },
    })
    expect(timeline.posts.value.map((p) => p.id)).toEqual([2, 1])
    expect(timeline.hasMore.value).toBe(true)
    timeline.stopPolling()
  })

  it('loadMore(): 最後の投稿idをbefore_idにして追加取得する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(2), makePost(1)], has_more: true },
    })
    const timeline = useTimeline()
    await timeline.load()

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(0)], has_more: false },
    })
    await timeline.loadMore()

    expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts', {
      params: { scope: 'all', before_id: 1, limit: 20 },
    })
    expect(timeline.posts.value.map((p) => p.id)).toEqual([2, 1, 0])
    expect(timeline.hasMore.value).toBe(false)
    timeline.stopPolling()
  })

  it('scope変更: load()をやり直し、保留中の新着通知はリセットされる', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const timeline = useTimeline()
    await timeline.load('all')

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(9)], has_more: false },
    })
    await timeline.load('following')

    expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts', {
      params: { scope: 'following', limit: 20 },
    })
    expect(timeline.newPostCount.value).toBe(0)
    timeline.stopPolling()
  })

  it('ポーリング: 複数回のtickで新着件数が積み上がる（上書きしない）', async () => {
    vi.useFakeTimers()
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const timeline = useTimeline()
    await timeline.load()

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(2)], has_more: false },
    })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(timeline.newPostCount.value).toBe(1)

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(3)], has_more: false },
    })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(timeline.newPostCount.value).toBe(2)

    timeline.stopPolling()
  })

  it('revealNewPosts(): 新着を新しい順で先頭に反映しカウントをクリアする', async () => {
    vi.useFakeTimers()
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const timeline = useTimeline()
    await timeline.load()

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(2)], has_more: false },
    })
    await vi.advanceTimersByTimeAsync(30_000)

    timeline.revealNewPosts()

    expect(timeline.posts.value.map((p) => p.id)).toEqual([2, 1])
    expect(timeline.newPostCount.value).toBe(0)
    timeline.stopPolling()
  })

  it('stopPolling(): 呼び出し後はタイマーが進んでもリクエストが飛ばない', async () => {
    vi.useFakeTimers()
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const timeline = useTimeline()
    await timeline.load()
    timeline.stopPolling()

    const callCountBefore = vi.mocked(apiClient.get).mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)

    expect(vi.mocked(apiClient.get).mock.calls.length).toBe(callCountBefore)
  })

  it('loadMore(): 応答待ちの間にタブが切り替わった場合、古いscopeの結果は捨てる', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(2), makePost(1)], has_more: true },
    })
    const timeline = useTimeline()
    await timeline.load('all')

    // loadMore()（全体タブ）の応答が返る前にフォロー中タブへ切り替える
    let resolveLoadMore: (value: unknown) => void = () => {}
    vi.mocked(apiClient.get).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLoadMore = resolve
        }),
    )
    const loadMorePromise = timeline.loadMore()

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(9)], has_more: false },
    })
    await timeline.load('following')

    // 遅れて全体タブのloadMore()の応答が返ってきても、フォロー中タブの一覧には混ざらない
    resolveLoadMore({ data: { results: [makePost(0)], has_more: false } })
    await loadMorePromise

    expect(timeline.posts.value.map((p) => p.id)).toEqual([9])
    timeline.stopPolling()
  })

  it('loadMore(): 表示中の投稿を全部削除してもhasMoreがtrueなら追加読み込みできる', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: true },
    })
    const timeline = useTimeline()
    await timeline.load()

    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    await timeline.deletePost(timeline.posts.value[0])
    expect(timeline.posts.value).toHaveLength(0)

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(0)], has_more: false },
    })
    await timeline.loadMore()

    // 削除前に読み込んでいた投稿1のidを基準に、その続きが取得できること
    // （posts.valueが空になっていてもbefore_idの基準を見失わない）
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts', {
      params: { scope: 'all', before_id: 1, limit: 20 },
    })
    expect(timeline.posts.value.map((p) => p.id)).toEqual([0])
    timeline.stopPolling()
  })

  it('load(): 前回の削除失敗エラーは新しい読み込みでクリアされる', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const timeline = useTimeline()
    await timeline.load()

    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))
    await timeline.deletePost(timeline.posts.value[0])
    expect(timeline.deleteError.value).not.toBeNull()

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(2)], has_more: false },
    })
    await timeline.load('following')

    expect(timeline.deleteError.value).toBeNull()
    timeline.stopPolling()
  })

  it('toggleLike(): 失敗時はreactionErrorにメッセージを設定する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const timeline = useTimeline()
    await timeline.load()

    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))
    await timeline.toggleLike(timeline.posts.value[0])

    expect(timeline.reactionError.value).toBe(
      'いいねの更新に失敗しました。もう一度お試しください。',
    )
    timeline.stopPolling()
  })

  it('toggleLike(): APIの結果を該当投稿にのみ反映する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1), makePost(2)], has_more: false },
    })
    const timeline = useTimeline()
    await timeline.load()

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { like_count: 1, liked_by_me: true },
    })
    await timeline.toggleLike(timeline.posts.value[0])

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts/1/likes')
    expect(timeline.posts.value[0].like_count).toBe(1)
    expect(timeline.posts.value[0].liked_by_me).toBe(true)
    expect(timeline.posts.value[1].like_count).toBe(0)
    timeline.stopPolling()
  })
})
