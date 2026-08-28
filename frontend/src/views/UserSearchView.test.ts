import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import UserSearchView from './UserSearchView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const TimelineStub = { template: '<div>timeline</div>' }
const ProfileStub = { template: '<div>profile</div>' }

function renderUserSearchView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: 1, username: 'viewer', display_name: 'Viewer', avatar_url: null }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
      { path: '/search', name: 'user-search', component: UserSearchView },
    ],
  })
  const result = render(UserSearchView, { global: { plugins: [pinia, router] } })
  return { ...result, router }
}

async function renderUserSearchViewAt(query: Record<string, string>) {
  const rendered = renderUserSearchView()
  await rendered.router.push({ name: 'user-search', query })
  return rendered
}

async function typeKeyword(keyword: string) {
  await fireEvent.update(screen.getByTestId('user-search-keyword'), keyword)
  await fireEvent.click(screen.getByTestId('user-search-submit'))
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  // AppHeaderが自身のonMountedで届いたリクエスト一覧を取得するため、既定で空応答にしておく
  vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
})

describe('UserSearchView', () => {
  it('キーワード未入力の状態では検索APIを呼ばない', async () => {
    renderUserSearchView()

    await fireEvent.click(screen.getByTestId('user-search-submit'))

    expect(apiClient.get).not.toHaveBeenCalledWith('/api/users/', expect.anything())
  })

  it('キーワードが空白のみの場合は検索APIを呼ばない', async () => {
    renderUserSearchView()

    await typeKeyword('   ')

    expect(apiClient.get).not.toHaveBeenCalledWith('/api/users/', expect.anything())
  })

  it('キーワードを入力して検索ボタンを押すとGET /api/users/?qで検索する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/') {
        return Promise.resolve({
          data: [{ id: 2, username: 'jiro', display_name: '次郎', avatar_url: null }],
        })
      }
      return Promise.resolve({ data: [] })
    })
    renderUserSearchView()

    await typeKeyword('次郎')

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/users/', { params: { q: '次郎' } })
      expect(screen.getByTestId('user-search-item-2')).toHaveTextContent('次郎')
    })
  })

  it('検索結果が0件のときは該当なしメッセージを表示する', async () => {
    renderUserSearchView()

    expect(screen.queryByTestId('user-search-empty')).not.toBeInTheDocument()

    await typeKeyword('該当なし')

    await waitFor(() => {
      expect(screen.getByTestId('user-search-empty')).toBeInTheDocument()
    })
  })

  it('検索に失敗した場合はエラーメッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/') return Promise.reject(new Error('failed'))
      return Promise.resolve({ data: [] })
    })
    renderUserSearchView()

    await typeKeyword('太郎')

    await waitFor(() => {
      expect(screen.getByTestId('user-search-error')).toBeInTheDocument()
    })
  })

  it('検索に失敗した後、キーワードを空にして検索し直すとエラーメッセージが消える', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/') return Promise.reject(new Error('failed'))
      return Promise.resolve({ data: [] })
    })
    renderUserSearchView()
    await typeKeyword('太郎')
    await waitFor(() => expect(screen.getByTestId('user-search-error')).toBeInTheDocument())

    await fireEvent.update(screen.getByTestId('user-search-keyword'), '')
    await fireEvent.click(screen.getByTestId('user-search-submit'))

    expect(screen.queryByTestId('user-search-error')).not.toBeInTheDocument()
  })

  it('検索中は検索ボタンが無効化される', async () => {
    let resolveSearch: (value: { data: unknown[] }) => void = () => {}
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/') return new Promise((resolve) => (resolveSearch = resolve))
      return Promise.resolve({ data: [] })
    })
    renderUserSearchView()

    await fireEvent.update(screen.getByTestId('user-search-keyword'), '太郎')
    await fireEvent.click(screen.getByTestId('user-search-submit'))

    await waitFor(() => expect(screen.getByTestId('user-search-submit')).toBeDisabled())

    resolveSearch({ data: [] })
    await waitFor(() => expect(screen.getByTestId('user-search-submit')).not.toBeDisabled())
  })

  it('?q= 付きで開くとそのキーワードで自動的に検索する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/') {
        return Promise.resolve({
          data: [{ id: 2, username: 'jiro', display_name: '次郎', avatar_url: null }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    await renderUserSearchViewAt({ q: '次郎' })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/users/', { params: { q: '次郎' } })
      expect(screen.getByTestId('user-search-item-2')).toHaveTextContent('次郎')
    })
    expect(screen.getByTestId('user-search-keyword')).toHaveValue('次郎')
  })

  it('検索結果をクリックするとプロフィール画面へ遷移する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/') {
        return Promise.resolve({
          data: [{ id: 2, username: 'jiro', display_name: '次郎', avatar_url: null }],
        })
      }
      return Promise.resolve({ data: [] })
    })
    const { router } = renderUserSearchView()

    await typeKeyword('次郎')
    await waitFor(() => expect(screen.getByTestId('user-search-item-2')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('user-search-item-2'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile')
      expect(router.currentRoute.value.params.id).toBe('2')
    })
  })
})
