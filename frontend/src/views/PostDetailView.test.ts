import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import PostDetailView from './PostDetailView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const TimelineStub = { template: '<div>timeline</div>' }
const ProfileStub = { template: '<div>profile</div>' }
const SearchStub = { template: '<div>search</div>' }

// 各テストがミューテーション（いいねのトグル等）で汚染しないよう、呼び出しごとに
// 新しいオブジェクトを返すファクトリにする（固定のconstだと、あるテストでの
// Object.assignによる更新が他のテストにまで漏れてしまう）
function makePost(overrides: Partial<typeof basePost> = {}) {
  return { ...basePost, ...overrides }
}
const basePost = {
  id: 1,
  author: { id: 7, username: 'author', display_name: '投稿者', avatar_url: null },
  body: '投稿本文',
  images: [] as string[],
  like_count: 2,
  want_count: 1,
  comment_count: 0,
  liked_by_me: false,
  wanted_by_me: false,
  created_at: '2026-08-23T00:00:00Z',
  updated_at: '2026-08-23T00:00:00Z',
}

// AppHeader（PostDetailViewが子コンポーネントとして描画する）がマウント時にGET
// /api/requests/receivedを呼ぶため、単純な呼び出し順ベースのmockResolvedValueOnceだと
// 投稿本体のGET /api/posts/{id}の応答と混線してしまう。URLで振り分けるmockImplementationにする
function mockGet(handlePostsUrl: (url: string) => Promise<unknown>) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url === '/api/requests/received') return Promise.resolve({ data: [] })
    return handlePostsUrl(url)
  })
}

async function renderPostDetailView(id = '1', currentUserId = 1) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: currentUserId, username: 'taro', display_name: '太郎', avatar_url: null }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailView, props: true },
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
      { path: '/search', name: 'user-search', component: SearchStub },
    ],
  })
  await router.push({ name: 'post-detail', params: { id } })
  const result = render(PostDetailView, { props: { id }, global: { plugins: [pinia, router] } })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('PostDetailView', () => {
  it('マウント時に投稿を取得して表示する', async () => {
    mockGet(() => Promise.resolve({ data: makePost() }))
    await renderPostDetailView()

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts/1')
      expect(screen.getByText('投稿本文')).toBeInTheDocument()
    })
  })

  it('共通ヘッダーを表示する（ログアウト・自分のプロフィールへの導線を確保する）', async () => {
    mockGet(() => Promise.resolve({ data: makePost() }))
    await renderPostDetailView()

    await waitFor(() => {
      expect(screen.getByTestId('header-logout-button')).toBeInTheDocument()
      expect(screen.getByTestId('header-profile-link')).toBeInTheDocument()
    })
  })

  it('いいねボタンクリックで数値が更新される', async () => {
    mockGet(() => Promise.resolve({ data: makePost() }))
    await renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { like_count: 3, liked_by_me: true },
    })
    await fireEvent.click(screen.getByTestId('like-button-1'))

    await waitFor(() => {
      expect(screen.getByTestId('like-button-1')).toHaveTextContent('いいね 3')
    })
  })

  it('いいねの更新に失敗した場合はエラーメッセージを表示する', async () => {
    mockGet(() => Promise.resolve({ data: makePost() }))
    await renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))
    await fireEvent.click(screen.getByTestId('like-button-1'))

    await waitFor(() => {
      expect(screen.getByTestId('reaction-error')).toBeInTheDocument()
    })
  })

  it('見つからない投稿はエラーメッセージを表示する', async () => {
    mockGet(() => Promise.reject(new Error('not found')))
    await renderPostDetailView()

    await waitFor(() => {
      expect(screen.getByTestId('post-detail-error')).toBeInTheDocument()
    })
  })

  it('「タイムラインに戻る」でタイムラインへ遷移する', async () => {
    mockGet(() => Promise.resolve({ data: makePost() }))
    const { router } = await renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    await fireEvent.click(screen.getByTestId('back-to-timeline'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })

  it('カード本体をクリックしても遷移しない（詳細画面自身への無駄な遷移を避ける）', async () => {
    mockGet(() => Promise.resolve({ data: makePost() }))
    const { router } = await renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    await fireEvent.click(screen.getByTestId('post-card-1'))

    expect(router.currentRoute.value.name).toBe('post-detail')
  })

  it('自分の投稿の削除ボタン→確認後にタイムラインへ遷移する', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockGet(() => Promise.resolve({ data: makePost() }))
    const { router } = await renderPostDetailView('1', 7) // currentUser.id === post.author.id
    await waitFor(() => screen.getByText('投稿本文'))

    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    await fireEvent.click(screen.getByTestId('delete-button-1'))

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/1')
      expect(router.currentRoute.value.name).toBe('timeline')
    })
    vi.restoreAllMocks()
  })

  it('削除に失敗した場合はエラーメッセージを表示しタイムラインへ遷移しない', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockGet(() => Promise.resolve({ data: makePost() }))
    const { router } = await renderPostDetailView('1', 7)
    await waitFor(() => screen.getByText('投稿本文'))

    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))
    await fireEvent.click(screen.getByTestId('delete-button-1'))

    await waitFor(() => {
      expect(screen.getByTestId('delete-error')).toBeInTheDocument()
    })
    expect(router.currentRoute.value.name).toBe('post-detail')
    vi.restoreAllMocks()
  })

  it('別の投稿idへ遷移すると読み込みし直される', async () => {
    // Vue Routerは同じルートレコード内の遷移（/posts/:id → /posts/:otherId）で
    // コンポーネントインスタンスを使い回すため、実際の挙動に合わせてidのprops変更を
    // rerenderで再現する（router.pushだけでは、単体テストで直接renderした
    // このコンポーネントのpropsは自動更新されない）
    mockGet((url) => {
      if (url === '/api/posts/1') return Promise.resolve({ data: makePost() })
      if (url === '/api/posts/2') {
        return Promise.resolve({ data: makePost({ id: 2, body: '別の投稿本文' }) })
      }
      return Promise.reject(new Error(`unexpected url: ${url}`))
    })
    const { rerender } = await renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    await rerender({ id: '2' })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts/2')
      expect(screen.getByText('別の投稿本文')).toBeInTheDocument()
    })
  })
})
