import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import RequestCreateView from './RequestCreateView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

const ProfileStub = { template: '<div>profile</div>' }

const destinationProfile = {
  id: 2,
  username: 'jiro',
  display_name: '次郎',
  bio: null,
  avatar_url: null,
  follower_count: 0,
  following_count: 0,
  followed_by_me: false,
}

function makePost(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    author: { id: 2, username: 'jiro', display_name: '次郎', avatar_url: null },
    body: `投稿${id}`,
    images: [],
    image_ids: [],
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

async function renderView(currentUserId = 1) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: currentUserId, username: 'taro', display_name: '太郎', avatar_url: null }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
      {
        path: '/profile/:id/requests/new',
        name: 'request-create',
        component: RequestCreateView,
        props: true,
      },
    ],
  })
  // 初回のnamed route pushを描画前に確定させておく。awaitせずに進むと、cancel/submit時の
  // router.push（'profile'への遷移）と初回pushが競合し、テストのアサーション時点で
  // router.currentRoute.valueが未確定のままになることがある
  await router.push({ name: 'request-create', params: { id: '2' } })
  return {
    ...render(RequestCreateView, { props: { id: '2' }, global: { plugins: [pinia, router] } }),
    router,
  }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
})

describe('RequestCreateView', () => {
  it('宛先利用者の表示名を取得して見出しに表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: destinationProfile })

    await renderView()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '次郎 さんにリクエストする' })).toBeInTheDocument()
    })
    expect(apiClient.get).toHaveBeenCalledWith('/api/users/2')
  })

  it('キャンセルをクリックすると宛先のプロフィール画面に戻る', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: destinationProfile })
    const { router } = await renderView()
    await waitFor(() => expect(screen.getByTestId('request-compose-cancel')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('request-compose-cancel'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile')
      expect(router.currentRoute.value.params.id).toBe('2')
    })
  })

  it('送信に成功すると宛先のプロフィール画面に戻る', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: destinationProfile })
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 1 } })
    const { router } = await renderView()
    await waitFor(() => expect(screen.getByTestId('request-message')).toBeInTheDocument())

    await fireEvent.update(screen.getByTestId('request-message'), 'この投稿の続きが読みたいです')
    await fireEvent.click(screen.getByTestId('request-compose-submit'))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/users/2/requests', {
        message: 'この投稿の続きが読みたいです',
        related_post_id: null,
      })
      expect(router.currentRoute.value.name).toBe('profile')
    })
  })

  it('送信に失敗した場合は画面遷移せずエラーを表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: destinationProfile })
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { message: ['この項目は必須です。'] } },
    })
    const { router } = await renderView()
    await waitFor(() => expect(screen.getByTestId('request-message')).toBeInTheDocument())

    await fireEvent.update(screen.getByTestId('request-message'), 'a')
    await fireEvent.click(screen.getByTestId('request-compose-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('request-message-error')).toHaveTextContent('この項目は必須です。')
      expect(router.currentRoute.value.name).toBe('request-create')
    })
  })

  it('宛先利用者が見つからない場合はエラーメッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('not found'))

    await renderView()

    await waitFor(() => {
      expect(screen.getByTestId('request-create-error')).toBeInTheDocument()
    })
  })

  it('「投稿を選ぶ」→「自分の投稿」タブで自分のuser_idの投稿一覧を取得する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: destinationProfile })
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        results: [
          makePost(10, {
            author: { id: 1, username: 'taro', display_name: '太郎', avatar_url: null },
          }),
        ],
        has_more: false,
      },
    })
    await renderView(1)
    await waitFor(() => expect(screen.getByTestId('request-message')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('request-related-post-picker-toggle'))

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts', { params: { user_id: 1 } })
      expect(screen.getByTestId('request-related-post-option-10')).toBeInTheDocument()
    })
  })

  it('一覧から投稿を選んで送信すると related_post_id が送信される', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: destinationProfile })
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(10)], has_more: false },
    })
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 1 } })
    await renderView(1)
    await waitFor(() => expect(screen.getByTestId('request-message')).toBeInTheDocument())
    await fireEvent.click(screen.getByTestId('request-related-post-picker-toggle'))
    await waitFor(() =>
      expect(screen.getByTestId('request-related-post-option-10')).toBeInTheDocument(),
    )
    await fireEvent.click(screen.getByTestId('request-related-post-option-10'))
    await fireEvent.update(screen.getByTestId('request-message'), 'この投稿の続きが読みたいです')

    await fireEvent.click(screen.getByTestId('request-compose-submit'))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/users/2/requests', {
        message: 'この投稿の続きが読みたいです',
        related_post_id: 10,
      })
    })
  })
})
