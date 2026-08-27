import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useRequestRelatedPostPicker } from './useRequestRelatedPostPicker'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

function makePost(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    author: { id: 2, username: 'jiro', display_name: '次郎', avatar_url: null },
    body: `投稿${id}`,
    images: [],
    image_ids: [],
    post_type: 'illustration' as const,
    title: '',
    tags: [],
    like_count: 0,
    want_count: 0,
    comment_count: 0,
    liked_by_me: false,
    wanted_by_me: false,
    created_at: '2026-08-24T00:00:00Z',
    updated_at: '2026-08-24T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('useRequestRelatedPostPicker', () => {
  it('openPicker: pickerOpenをtrueにし、デフォルトタブ（own）の投稿一覧を取得する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(10)], has_more: false },
    })
    const { openPicker, pickerOpen, postsByTab, pickerLoading } = useRequestRelatedPostPicker(1, 2)

    openPicker()
    expect(pickerOpen.value).toBe(true)
    expect(pickerLoading.value).toBe(true)
    await Promise.resolve()
    await Promise.resolve()

    expect(apiClient.get).toHaveBeenCalledWith('/api/posts', { params: { user_id: 1 } })
    expect(postsByTab.value.own).toEqual([makePost(10)])
  })

  it('switchTab: targetタブに切り替えると宛先の投稿一覧を取得する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(20)], has_more: false },
    })
    const { switchTab, postsByTab, pickerTab } = useRequestRelatedPostPicker(1, 2)

    await switchTab('target')

    expect(pickerTab.value).toBe('target')
    expect(apiClient.get).toHaveBeenCalledWith('/api/posts', { params: { user_id: 2 } })
    expect(postsByTab.value.target).toEqual([makePost(20)])
  })

  it('同じタブを再度開いても取得済みならAPIを呼び直さない', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(10)], has_more: false },
    })
    const { openPicker, closePicker, pickerOpen } = useRequestRelatedPostPicker(1, 2)

    openPicker()
    await Promise.resolve()
    await Promise.resolve()
    closePicker()
    expect(pickerOpen.value).toBe(false)

    openPicker()
    await Promise.resolve()

    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('取得に失敗した場合はpickerErrorが設定される', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('failed'))
    const { openPicker, pickerError, pickerLoading } = useRequestRelatedPostPicker(1, 2)

    openPicker()
    await Promise.resolve()
    await Promise.resolve()

    expect(pickerError.value).toBe('投稿一覧の取得に失敗しました。')
    expect(pickerLoading.value).toBe(false)
  })

  it('selectPost: 選択した投稿をselectedPostにセットしpickerOpenをfalseにする', () => {
    const { selectPost, selectedPost, pickerOpen } = useRequestRelatedPostPicker(1, 2)
    const post = makePost(10)

    selectPost(post)

    expect(selectedPost.value).toEqual(post)
    expect(pickerOpen.value).toBe(false)
  })

  it('clearSelection: selectedPostをnullに戻す', () => {
    const { selectPost, clearSelection, selectedPost } = useRequestRelatedPostPicker(1, 2)
    selectPost(makePost(10))

    clearSelection()

    expect(selectedPost.value).toBeNull()
  })

  it('自分の利用者idが無い場合（未ログイン相当）はownタブを開いても取得しない', async () => {
    const { openPicker, postsByTab } = useRequestRelatedPostPicker(undefined, 2)

    openPicker()
    await Promise.resolve()

    expect(apiClient.get).not.toHaveBeenCalled()
    expect(postsByTab.value.own).toBeNull()
  })
})
