import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import TimelineView from './TimelineView.vue'
import type { Post } from '@/types/post'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

// jsdomにはIntersectionObserverが無いため最小限のスタブを用意する
// （無限スクロールの発火自体は使わない現状のテストでは、observeが呼べれば十分）
class IntersectionObserverStub {
  observe() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)

const PostCreateStub = { template: '<div>post-create</div>' }
const PostDetailStub = { template: '<div>post-detail</div>' }
const ProfileStub = { template: '<div>profile</div>' }

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

function renderTimelineView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: 1, username: 'taro', display_name: '太郎', avatar_url: null }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineView },
      { path: '/posts/new', name: 'post-create', component: PostCreateStub },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailStub },
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
    ],
  })
  const result = render(TimelineView, { global: { plugins: [pinia, router] } })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TimelineView', () => {
  it('マウント時にGET /api/posts?scope=allで一覧取得する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const { router } = renderTimelineView()
    await router.isReady()

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts', {
        params: { scope: 'all', limit: 20 },
      })
      expect(screen.getByText('投稿1')).toBeInTheDocument()
    })
  })

  it('投稿が無い場合は空状態メッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { results: [], has_more: false } })
    const { router } = renderTimelineView()
    await router.isReady()

    await waitFor(() => {
      expect(screen.getByTestId('timeline-empty')).toHaveTextContent('投稿がまだありません。')
    })
  })

  it('フォロー中タブに切り替えるとscope=followingで再取得する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByText('投稿1')).toBeInTheDocument())

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { results: [], has_more: false } })
    await fireEvent.click(screen.getByTestId('tab-following'))

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts', {
        params: { scope: 'following', limit: 20 },
      })
      expect(screen.getByTestId('timeline-empty')).toHaveTextContent(
        'フォロー中の利用者の投稿がまだありません。',
      )
    })
  })

  it('新着通知バナークリックで一覧の先頭に反映し最上部へスクロールする', async () => {
    vi.useFakeTimers()
    const scrollToSpy = vi.fn()
    vi.stubGlobal('scrollTo', scrollToSpy)

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByText('投稿1')).toBeInTheDocument())

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(2)], has_more: false },
    })
    await vi.advanceTimersByTimeAsync(30_000)
    await waitFor(() => expect(screen.getByTestId('new-post-banner')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('new-post-banner'))

    await waitFor(() => {
      expect(screen.getByText('投稿2')).toBeInTheDocument()
      expect(screen.queryByTestId('new-post-banner')).not.toBeInTheDocument()
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    })

    vi.useRealTimers()
  })

  it('自分の投稿の削除ボタン→確認後に一覧からその場で取り除かれる', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1), makePost(2)], has_more: false },
    })
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByText('投稿1')).toBeInTheDocument())

    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    await fireEvent.click(screen.getByTestId('delete-button-1'))

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/1')
      expect(screen.queryByText('投稿1')).not.toBeInTheDocument()
      expect(screen.getByText('投稿2')).toBeInTheDocument()
    })
  })

  it('削除に失敗した場合はエラーメッセージを表示し一覧はそのまま', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(1)], has_more: false },
    })
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByText('投稿1')).toBeInTheDocument())

    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))
    await fireEvent.click(screen.getByTestId('delete-button-1'))

    await waitFor(() => {
      expect(screen.getByTestId('delete-error')).toBeInTheDocument()
      expect(screen.getByText('投稿1')).toBeInTheDocument()
    })
  })

  it('「投稿する」ボタンから投稿作成画面へ遷移する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { results: [], has_more: false } })
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByTestId('timeline-empty')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('compose-button'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('post-create')
    })
  })
})
