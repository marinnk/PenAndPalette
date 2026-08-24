import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import PostDetailView from './PostDetailView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const TimelineStub = { template: '<div>timeline</div>' }
const ProfileStub = { template: '<div>profile</div>' }

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

async function renderPostDetailView(id = '1') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: 1, username: 'taro', display_name: '太郎', avatar_url: null }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailView, props: true },
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
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
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    await renderPostDetailView()

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts/1')
      expect(screen.getByText('投稿本文')).toBeInTheDocument()
    })
  })

  it('共通ヘッダーを表示する（ログアウト・自分のプロフィールへの導線を確保する）', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    await renderPostDetailView()

    await waitFor(() => {
      expect(screen.getByTestId('header-logout-button')).toBeInTheDocument()
      expect(screen.getByTestId('header-profile-link')).toBeInTheDocument()
    })
  })

  it('いいねボタンクリックで数値が更新される', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
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
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    await renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))
    await fireEvent.click(screen.getByTestId('like-button-1'))

    await waitFor(() => {
      expect(screen.getByTestId('reaction-error')).toBeInTheDocument()
    })
  })

  it('見つからない投稿はエラーメッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('not found'))
    await renderPostDetailView()

    await waitFor(() => {
      expect(screen.getByTestId('post-detail-error')).toBeInTheDocument()
    })
  })

  it('「タイムラインに戻る」でタイムラインへ遷移する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    const { router } = await renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    await fireEvent.click(screen.getByTestId('back-to-timeline'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })

  it('カード本体をクリックしても遷移しない（詳細画面自身への無駄な遷移を避ける）', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    const { router } = await renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    await fireEvent.click(screen.getByTestId('post-card-1'))

    expect(router.currentRoute.value.name).toBe('post-detail')
  })

  it('別の投稿idへ遷移すると読み込みし直される', async () => {
    // Vue Routerは同じルートレコード内の遷移（/posts/:id → /posts/:otherId）で
    // コンポーネントインスタンスを使い回すため、実際の挙動に合わせてidのprops変更を
    // rerenderで再現する（router.pushだけでは、単体テストで直接renderした
    // このコンポーネントのpropsは自動更新されない）
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    const { rerender } = await renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: makePost({ id: 2, body: '別の投稿本文' }),
    })
    await rerender({ id: '2' })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts/2')
      expect(screen.getByText('別の投稿本文')).toBeInTheDocument()
    })
  })
})
