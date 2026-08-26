import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import TimelineView from './TimelineView.vue'
import type { Post, PostListResponse } from '@/types/post'

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
const SearchStub = { template: '<div>search</div>' }

// イラストタブ（既定表示）ではPostGridが画像のみを表示するため、デフォルトで1枚画像を
// 持たせておく（小説タブのテストではPostCard側で本文・削除ボタン等を検証する）
function makePost(id: number, overrides: Partial<Post> = {}): Post {
  return {
    id,
    author: { id: 1, username: 'author', display_name: '投稿者', avatar_url: null },
    body: `投稿${id}`,
    images: ['https://example.com/1.jpg'],
    image_ids: [1],
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

// AppHeader（TimelineViewが子コンポーネントとして描画する）がマウント時にGET
// /api/requests/receivedを呼ぶため、単純な呼び出し順ベースのmockResolvedValueOnceだと
// タイムライン本体のGET /api/postsの応答と混線してしまう。URLで振り分ける
// mockImplementationにし、/api/postsへの複数回の呼び出しには順にqueueの値を返す
function mockGet(postsQueue: PostListResponse[]) {
  let call = 0
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url === '/api/requests/received') return Promise.resolve({ data: [] })
    if (url === '/api/posts') {
      const data = postsQueue[Math.min(call, postsQueue.length - 1)]
      call += 1
      return Promise.resolve({ data })
    }
    return Promise.reject(new Error(`unmocked GET ${url}`))
  })
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
      { path: '/search', name: 'user-search', component: SearchStub },
    ],
  })
  const result = render(TimelineView, { global: { plugins: [pinia, router] } })
  return { ...result, router }
}

// 小説タブ（PostCardのリスト表示）に切り替える。delete-button等、グリッド表示には
// 無い要素を検証するテストで使う
async function switchToNovelTab() {
  await fireEvent.click(screen.getByTestId('tab-novel'))
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts', expect.anything()),
  )
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
  it('マウント時にGET /api/posts?scope=all&post_type=illustrationで一覧取得し、イラストタブはグリッド表示になる', async () => {
    mockGet([{ results: [makePost(1)], has_more: false }])
    const { router } = renderTimelineView()
    await router.isReady()

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts', {
        params: { scope: 'all', post_type: 'illustration', limit: 20 },
      })
      expect(screen.getByTestId('post-grid-tile-1')).toBeInTheDocument()
    })
  })

  it('投稿が無い場合は種別に応じた空状態メッセージを表示する', async () => {
    mockGet([
      { results: [], has_more: false },
      { results: [], has_more: false },
    ])
    const { router } = renderTimelineView()
    await router.isReady()

    await waitFor(() => {
      expect(screen.getByTestId('timeline-empty')).toHaveTextContent(
        'イラストの投稿がまだありません。',
      )
    })

    await fireEvent.click(screen.getByTestId('tab-novel'))

    await waitFor(() => {
      expect(screen.getByTestId('timeline-empty')).toHaveTextContent('小説の投稿がまだありません。')
    })
  })

  it('小説タブに切り替えるとpost_type=novelで再取得し、リスト表示になる（全体／フォロー中とは独立）', async () => {
    mockGet([
      { results: [makePost(1)], has_more: false },
      { results: [makePost(2, { post_type: 'novel', title: '小説タイトル' })], has_more: false },
    ])
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByTestId('post-grid-tile-1')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('tab-novel'))

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts', {
        params: { scope: 'all', post_type: 'novel', limit: 20 },
      })
      expect(screen.getByText('【小説タイトル】')).toBeInTheDocument()
      expect(screen.queryByTestId('post-grid-tile-1')).not.toBeInTheDocument()
    })
  })

  it('フォロー中タブに切り替えるとscope=followingで再取得する（種別タブとは独立）', async () => {
    mockGet([
      { results: [makePost(1)], has_more: false },
      { results: [], has_more: false },
    ])
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByTestId('post-grid-tile-1')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('tab-following'))

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts', {
        params: { scope: 'following', post_type: 'illustration', limit: 20 },
      })
      expect(screen.getByTestId('timeline-empty')).toHaveTextContent(
        'フォロー中の利用者のイラストの投稿がまだありません。',
      )
    })
  })

  it('新着通知バナークリックで一覧の先頭に反映し最上部へスクロールする', async () => {
    vi.useFakeTimers()
    const scrollToSpy = vi.fn()
    vi.stubGlobal('scrollTo', scrollToSpy)

    mockGet([
      { results: [makePost(1)], has_more: false },
      { results: [makePost(2)], has_more: false },
    ])
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByTestId('post-grid-tile-1')).toBeInTheDocument())

    await vi.advanceTimersByTimeAsync(30_000)
    await waitFor(() => expect(screen.getByTestId('new-post-banner')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('new-post-banner'))

    await waitFor(() => {
      expect(screen.getByTestId('post-grid-tile-2')).toBeInTheDocument()
      expect(screen.queryByTestId('new-post-banner')).not.toBeInTheDocument()
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    })

    vi.useRealTimers()
  })

  it('自分の投稿の削除ボタン→確認後に一覧からその場で取り除かれる（小説タブのリスト表示で確認）', async () => {
    mockGet([
      { results: [makePost(1)], has_more: false },
      {
        results: [makePost(1, { post_type: 'novel' }), makePost(2, { post_type: 'novel' })],
        has_more: false,
      },
    ])
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByTestId('post-grid-tile-1')).toBeInTheDocument())
    await switchToNovelTab()
    await waitFor(() => expect(screen.getByText('投稿1')).toBeInTheDocument())

    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    await fireEvent.click(screen.getByTestId('delete-button-1'))

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/1')
      expect(screen.queryByText('投稿1')).not.toBeInTheDocument()
      expect(screen.getByText('投稿2')).toBeInTheDocument()
    })
  })

  it('削除に失敗した場合はエラーメッセージを表示し一覧はそのまま（小説タブのリスト表示で確認）', async () => {
    mockGet([
      { results: [makePost(1)], has_more: false },
      { results: [makePost(1, { post_type: 'novel' })], has_more: false },
    ])
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByTestId('post-grid-tile-1')).toBeInTheDocument())
    await switchToNovelTab()
    await waitFor(() => expect(screen.getByText('投稿1')).toBeInTheDocument())

    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))
    await fireEvent.click(screen.getByTestId('delete-button-1'))

    await waitFor(() => {
      expect(screen.getByTestId('delete-error')).toBeInTheDocument()
      expect(screen.getByText('投稿1')).toBeInTheDocument()
    })
  })

  it('「投稿する」ボタンから投稿作成画面へ遷移する', async () => {
    mockGet([{ results: [], has_more: false }])
    const { router } = renderTimelineView()
    await router.isReady()
    await waitFor(() => expect(screen.getByTestId('timeline-empty')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('compose-button'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('post-create')
    })
  })
})
