import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import ProfileView from './ProfileView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const TimelineStub = { template: '<div>timeline</div>' }
const PostCreateStub = { template: '<div>post-create</div>' }
const PostDetailStub = { template: '<div>post-detail</div>' }

const profile = { id: 1, username: 'taro', display_name: '太郎', bio: 'よろしく', avatar_url: null }

function makePost(id: number) {
  return {
    id,
    author: { id: 1, username: 'taro', display_name: '太郎', avatar_url: null },
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
  }
}

function renderProfileView(currentUserId: number) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = {
    id: currentUserId,
    username: 'viewer',
    display_name: '閲覧者',
    avatar_url: null,
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/new', name: 'post-create', component: PostCreateStub },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailStub },
      { path: '/profile/:id', name: 'profile', component: ProfileView, props: true },
    ],
  })
  router.push({ name: 'profile', params: { id: '1' } })
  const result = render(ProfileView, { props: { id: '1' }, global: { plugins: [pinia, router] } })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('ProfileView', () => {
  it('プロフィール情報と投稿一覧を表示する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') return Promise.resolve({ data: profile })
      return Promise.resolve({ data: { results: [], has_more: false } })
    })
    renderProfileView(1)

    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toHaveTextContent('太郎')
      expect(screen.getByTestId('profile-bio')).toHaveTextContent('よろしく')
    })
  })

  it('自分のプロフィールでは「投稿する」ボタンが表示される', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') return Promise.resolve({ data: profile })
      return Promise.resolve({ data: { results: [], has_more: false } })
    })
    renderProfileView(1)

    await waitFor(() => {
      expect(screen.getByTestId('profile-compose-button')).toBeInTheDocument()
    })
  })

  it('他人のプロフィールでは「投稿する」ボタンは表示されない', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') return Promise.resolve({ data: profile })
      return Promise.resolve({ data: { results: [], has_more: false } })
    })
    renderProfileView(999)

    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('profile-compose-button')).not.toBeInTheDocument()
  })

  it('自分の投稿の削除ボタン→確認後に一覧からその場で取り除かれる', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') return Promise.resolve({ data: profile })
      return Promise.resolve({ data: { results: [makePost(1)], has_more: false } })
    })
    renderProfileView(1)
    await waitFor(() => expect(screen.getByText('投稿1')).toBeInTheDocument())

    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    await fireEvent.click(screen.getByTestId('delete-button-1'))

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/1')
      expect(screen.queryByText('投稿1')).not.toBeInTheDocument()
    })
    vi.restoreAllMocks()
  })

  it('見つからない利用者はエラーメッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'))
    renderProfileView(1)

    await waitFor(() => {
      expect(screen.getByTestId('profile-error')).toBeInTheDocument()
    })
  })
})
