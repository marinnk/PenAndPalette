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

  function mockUserSearch(users: { id: number; display_name: string }[]) {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/') {
        return Promise.resolve({
          data: users.map((u) => ({ username: `u${u.id}`, avatar_url: null, ...u })),
        })
      }
      return Promise.resolve({ data: [] })
    })
  }

  it('検索入力欄で実行すると入力欄の直下に候補が一覧表示され、選ぶとプロフィールへ遷移する', async () => {
    mockUserSearch([{ id: 2, display_name: '次郎' }])
    const { router } = renderAppHeader()
    await router.isReady()

    await fireEvent.update(screen.getByTestId('header-search-input'), '次郎')
    await fireEvent.click(screen.getByTestId('header-search-submit'))

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/users/', { params: { q: '次郎' } })
      expect(screen.getByTestId('header-search-item-2')).toHaveTextContent('次郎')
    })
    // 検索画面へは遷移せず、その場で候補が出る
    expect(router.currentRoute.value.name).toBe('timeline')

    await fireEvent.click(screen.getByTestId('header-search-item-2'))
    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile')
      expect(router.currentRoute.value.params.id).toBe('2')
    })
    // 遷移後は候補を閉じ、入力もリセットする
    expect(screen.queryByTestId('header-search-dropdown')).not.toBeInTheDocument()
    expect(screen.getByTestId('header-search-input')).toHaveValue('')
  })

  it('入力を止めると自動的に検索して候補を出す（デバウンス）', async () => {
    mockUserSearch([{ id: 3, display_name: '三郎' }])
    const { router } = renderAppHeader()
    await router.isReady()

    await fireEvent.update(screen.getByTestId('header-search-input'), '三郎')

    await waitFor(() => {
      expect(screen.getByTestId('header-search-item-3')).toBeInTheDocument()
    })
    expect(apiClient.get).toHaveBeenCalledWith('/api/users/', { params: { q: '三郎' } })
  })

  it('該当する利用者がいないときは候補内にその旨を表示する', async () => {
    mockUserSearch([])
    const { router } = renderAppHeader()
    await router.isReady()

    await fireEvent.update(screen.getByTestId('header-search-input'), 'いない人')
    await fireEvent.click(screen.getByTestId('header-search-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('header-search-empty')).toBeInTheDocument()
    })
  })

  it('検索キーワードが空白のみのときは検索せず候補も出さない', async () => {
    renderAppHeader()

    await fireEvent.update(screen.getByTestId('header-search-input'), '   ')
    await fireEvent.click(screen.getByTestId('header-search-submit'))

    expect(apiClient.get).not.toHaveBeenCalledWith('/api/users/', expect.anything())
    expect(screen.queryByTestId('header-search-dropdown')).not.toBeInTheDocument()
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

  it('届いたリクエストがある場合はアイコンと件数バッジのみ表示する（説明文字は出さない）', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: 1,
          from_user: { id: 2, username: 'jiro', display_name: '次郎', avatar_url: null },
          related_post: null,
          message: 'こんにちは',
          created_at: '2026-08-24T00:00:00Z',
        },
        {
          id: 2,
          from_user: { id: 3, username: 'sabu', display_name: '三郎', avatar_url: null },
          related_post: null,
          message: 'よろしく',
          created_at: '2026-08-24T00:00:00Z',
        },
      ],
    })
    renderAppHeader()

    await waitFor(() => {
      expect(screen.getByTestId('header-request-count')).toHaveTextContent('2')
    })
    const badge = screen.getByTestId('header-request-badge')
    expect(badge).not.toHaveTextContent('届いたリクエスト')
    expect(badge).toHaveAttribute('aria-label', '届いたリクエスト 2件')
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
