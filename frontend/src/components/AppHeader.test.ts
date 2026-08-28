import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import AppHeader from './AppHeader.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const TimelineStub = { template: '<div>timeline</div>' }
const ProfileStub = { template: '<div>profile</div>' }
const LoginStub = { template: '<div>login</div>' }
const SearchStub = { template: '<div>search</div>' }

function renderAppHeader(avatarUrl: string | null = null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: 1, username: 'taro', display_name: '太郎', avatar_url: avatarUrl }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
      { path: '/login', name: 'login', component: LoginStub },
      { path: '/search', name: 'user-search', component: SearchStub },
    ],
  })
  const result = render(AppHeader, { global: { plugins: [pinia, router] } })
  return { ...result, router, auth }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
})

describe('AppHeader', () => {
  it('アイコンから自分のプロフィールへリンクする（表示名は出さない）', async () => {
    const { router } = renderAppHeader()
    await router.isReady()

    expect(screen.queryByText('太郎')).not.toBeInTheDocument()

    await fireEvent.click(screen.getByTestId('header-profile-link'))
    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile')
      expect(router.currentRoute.value.params.id).toBe('1')
    })
  })

  it('検索入力欄にキーワードを入力して実行すると検索画面へ ?q= 付きで遷移する', async () => {
    const { router } = renderAppHeader()
    await router.isReady()

    await fireEvent.update(screen.getByTestId('header-search-input'), '次郎')
    await fireEvent.click(screen.getByTestId('header-search-submit'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('user-search')
      expect(router.currentRoute.value.query.q).toBe('次郎')
    })
  })

  it('検索キーワードが空白のみのときは遷移しない', async () => {
    const { router } = renderAppHeader()
    await router.isReady()

    await fireEvent.update(screen.getByTestId('header-search-input'), '   ')
    await fireEvent.click(screen.getByTestId('header-search-submit'))

    expect(router.currentRoute.value.name).toBe('timeline')
  })

  it('アイコン画像が設定されている場合はプロフィールリンクに表示する', async () => {
    const { router } = renderAppHeader('https://example.com/avatar.jpg')
    await router.isReady()

    expect(screen.getByTestId('header-avatar-image')).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg',
    )
  })

  it('アイコン画像が設定されていない場合は画像の代わりにプレースホルダーを表示する（表示位置は空けておく）', async () => {
    const { router } = renderAppHeader()
    await router.isReady()

    expect(screen.queryByTestId('header-avatar-image')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('header-profile-link').querySelector('.avatar-placeholder'),
    ).toBeInTheDocument()
  })

  it('ログアウトボタンでログアウトしログイン画面へ遷移する', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({})
    const { router, auth } = renderAppHeader()
    await router.isReady()

    await fireEvent.click(screen.getByTestId('header-logout-button'))

    await waitFor(() => {
      expect(auth.currentUser).toBeNull()
      expect(router.currentRoute.value.name).toBe('login')
    })
  })

  it('届いたリクエストが無い場合は通知バッジを表示しない', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
    renderAppHeader()

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/requests/received')
    })
    expect(screen.queryByTestId('header-request-badge')).not.toBeInTheDocument()
  })

  it('届いたリクエストがある場合は件数付きの通知バッジを🔔絵文字なしで表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: 1,
          from_user: { id: 2, username: 'jiro', display_name: '次郎', avatar_url: null },
          related_post: null,
          message: 'こんにちは',
          created_at: '2026-08-24T00:00:00Z',
        },
      ],
    })
    renderAppHeader()

    await waitFor(() => {
      const badge = screen.getByTestId('header-request-badge')
      expect(badge).toHaveTextContent('届いたリクエスト 1')
      expect(badge.textContent).not.toContain('🔔')
    })
  })

  it('通知バッジをクリックすると届いたリクエストの一覧がドロップダウンで表示される', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: 1,
          from_user: { id: 2, username: 'jiro', display_name: '次郎', avatar_url: null },
          related_post: null,
          message: 'この場面の続きを書いてほしいです',
          created_at: '2026-08-24T00:00:00Z',
        },
      ],
    })
    renderAppHeader()
    await waitFor(() => expect(screen.getByTestId('header-request-badge')).toBeInTheDocument())
    expect(screen.queryByTestId('header-request-dropdown')).not.toBeInTheDocument()

    await fireEvent.click(screen.getByTestId('header-request-badge'))

    expect(screen.getByTestId('header-received-request-1')).toHaveTextContent(
      '次郎 さんから：「この場面の続きを書いてほしいです」',
    )

    await fireEvent.click(screen.getByTestId('header-request-badge'))

    expect(screen.queryByTestId('header-request-dropdown')).not.toBeInTheDocument()
  })
})
