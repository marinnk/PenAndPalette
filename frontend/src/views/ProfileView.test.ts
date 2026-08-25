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
const FollowListStub = { template: '<div>follow-list</div>' }
const RequestCreateStub = { template: '<div>request-create</div>' }
const ProfileEditStub = { template: '<div>profile-edit</div>' }

const profile = {
  id: 1,
  username: 'taro',
  display_name: '太郎',
  bio: 'よろしく',
  avatar_url: null,
  follower_count: 8,
  following_count: 12,
  followed_by_me: false,
}

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

// GET /api/users/1・GET /api/posts・GET /api/requests/received の3種類をまとめてモックする。
// received-requestsはisOwnProfileの間だけ呼ばれるが、他人のプロフィールを見るテストでも
// watch(immediate: true)の初回評価は走るため、明示的にモックしておかないと
// 「posts一覧」用のフォールバックが誤って使われてしまう
function mockApiClient({ posts = [] as unknown[], receivedRequests = [] as unknown[] } = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url === '/api/users/1') return Promise.resolve({ data: profile })
    if (url === '/api/requests/received') return Promise.resolve({ data: receivedRequests })
    return Promise.resolve({ data: { results: posts, has_more: false } })
  })
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
      { path: '/profile/:id/edit', name: 'profile-edit', component: ProfileEditStub },
      {
        path: '/profile/:id/requests/new',
        name: 'request-create',
        component: RequestCreateStub,
      },
      { path: '/profile/:id/following', name: 'profile-following', component: FollowListStub },
      { path: '/profile/:id/followers', name: 'profile-followers', component: FollowListStub },
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
  it('アイコン画像が設定されていない場合は画像の代わりにプレースホルダーを表示する（表示位置は空けておく）', async () => {
    mockApiClient()
    renderProfileView(1)

    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('profile-avatar-image')).not.toBeInTheDocument()
    expect(document.querySelector('.profile-header .avatar-placeholder')).toBeInTheDocument()
  })

  it('プロフィール情報と投稿一覧を表示する', async () => {
    mockApiClient()
    renderProfileView(1)

    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toHaveTextContent('太郎')
      expect(screen.getByTestId('profile-bio')).toHaveTextContent('よろしく')
    })
  })

  it('自分のプロフィールでは「投稿する」ボタンが表示される', async () => {
    mockApiClient()
    renderProfileView(1)

    await waitFor(() => {
      expect(screen.getByTestId('profile-compose-button')).toBeInTheDocument()
    })
  })

  it('自分のプロフィールでは「プロフィールを編集」ボタンが表示され、押すとS08へ遷移する', async () => {
    mockApiClient()
    const { router } = renderProfileView(1)
    await waitFor(() => expect(screen.getByTestId('profile-edit-button')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('profile-edit-button'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile-edit')
      expect(router.currentRoute.value.params.id).toBe('1')
    })
  })

  it('他人のプロフィールでは「プロフィールを編集」ボタンは表示されない', async () => {
    mockApiClient()
    renderProfileView(999)

    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('profile-edit-button')).not.toBeInTheDocument()
  })

  it('アイコン画像が設定されている場合は表示名の横に表示する', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/users/1') {
        return Promise.resolve({ data: { ...profile, avatar_url: 'https://example.com/a.jpg' } })
      }
      if (url === '/api/requests/received') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: { results: [], has_more: false } })
    })
    renderProfileView(1)

    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-image')).toHaveAttribute(
        'src',
        'https://example.com/a.jpg',
      )
    })
  })

  it('他人のプロフィールでは「投稿する」ボタンは表示されない', async () => {
    mockApiClient()
    renderProfileView(999)

    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('profile-compose-button')).not.toBeInTheDocument()
  })

  it('自分の投稿の削除ボタン→確認後に一覧からその場で取り除かれる', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApiClient({ posts: [makePost(1)] })
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

  it('フォロー中/フォロワー数を表示する', async () => {
    mockApiClient()
    renderProfileView(999)

    await waitFor(() => {
      expect(screen.getByTestId('profile-following-count')).toHaveTextContent('フォロー中 12')
      expect(screen.getByTestId('profile-follower-count')).toHaveTextContent('フォロワー 8')
    })
  })

  it('自分のプロフィールでは「フォローする」「リクエストする」ボタンは表示されない', async () => {
    mockApiClient()
    renderProfileView(1)

    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('profile-follow-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('profile-request-button')).not.toBeInTheDocument()
  })

  it('他人のプロフィールで「フォローする」ボタンを押すとフォローし、表示が切り替わる', async () => {
    mockApiClient()
    renderProfileView(999)
    await waitFor(() => expect(screen.getByTestId('profile-follow-button')).toBeInTheDocument())

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { followed_by_me: true, follower_count: 9 },
    })
    await fireEvent.click(screen.getByTestId('profile-follow-button'))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/users/1/follow')
      expect(screen.getByTestId('profile-follow-button')).toHaveTextContent('フォロー中')
      expect(screen.getByTestId('profile-follower-count')).toHaveTextContent('フォロワー 9')
    })
  })

  it('他人のプロフィールでは「リクエストする」ボタンが表示され、押すとリクエスト作成画面に遷移する', async () => {
    mockApiClient()
    const { router } = renderProfileView(999)
    await waitFor(() => expect(screen.getByTestId('profile-request-button')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('profile-request-button'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('request-create')
      expect(router.currentRoute.value.params.id).toBe('1')
    })
  })

  it('プロフィール画面には「届いたリクエスト」のUIを持たない（ヘッダーの通知バッジから確認する）', async () => {
    mockApiClient()
    renderProfileView(1)

    await waitFor(() => {
      expect(screen.getByTestId('profile-display-name')).toBeInTheDocument()
    })
    expect(screen.queryByText('届いたリクエスト')).not.toBeInTheDocument()
  })
})
