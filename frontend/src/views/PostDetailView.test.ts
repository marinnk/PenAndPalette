import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import PostDetailView from './PostDetailView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const TimelineStub = { template: '<div>timeline</div>' }
const ProfileStub = { template: '<div>profile</div>' }

const post = {
  id: 1,
  author: { id: 7, username: 'author', display_name: '投稿者', avatar_url: null },
  body: '投稿本文',
  images: [],
  like_count: 2,
  want_count: 1,
  comment_count: 0,
  liked_by_me: false,
  wanted_by_me: false,
  created_at: '2026-08-23T00:00:00Z',
  updated_at: '2026-08-23T00:00:00Z',
}

function renderPostDetailView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailView, props: true },
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
    ],
  })
  router.push({ name: 'post-detail', params: { id: '1' } })
  const result = render(PostDetailView, { props: { id: '1' }, global: { plugins: [router] } })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
})

describe('PostDetailView', () => {
  it('マウント時に投稿を取得して表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: post })
    renderPostDetailView()

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts/1')
      expect(screen.getByText('投稿本文')).toBeInTheDocument()
    })
  })

  it('いいねボタンクリックで数値が更新される', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: post })
    renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { like_count: 3, liked_by_me: true },
    })
    await fireEvent.click(screen.getByTestId('post-detail-like-button'))

    await waitFor(() => {
      expect(screen.getByTestId('post-detail-like-button')).toHaveTextContent('いいね 3')
    })
  })

  it('見つからない投稿はエラーメッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('not found'))
    renderPostDetailView()

    await waitFor(() => {
      expect(screen.getByTestId('post-detail-error')).toBeInTheDocument()
    })
  })

  it('「タイムラインに戻る」でタイムラインへ遷移する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: post })
    const { router } = renderPostDetailView()
    await waitFor(() => screen.getByText('投稿本文'))

    await fireEvent.click(screen.getByTestId('back-to-timeline'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })
})
