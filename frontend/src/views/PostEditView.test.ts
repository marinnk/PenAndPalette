import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import PostEditView from './PostEditView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

// jsdomはURL.createObjectURL/revokeObjectURLを実装していないため最小限のスタブを用意する
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()

const PostDetailStub = { template: '<div>post-detail</div>' }

const existingPost = {
  id: 1,
  author: { id: 1, username: 'author', display_name: '投稿者', avatar_url: null },
  body: '編集前の本文',
  images: ['https://example.com/1.jpg'],
  image_ids: [10],
  like_count: 0,
  want_count: 0,
  comment_count: 0,
  liked_by_me: false,
  wanted_by_me: false,
  created_at: '2026-08-23T00:00:00Z',
  updated_at: '2026-08-23T00:00:00Z',
}

function renderPostEditView(id = '1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/posts/:id/edit', name: 'post-edit', component: PostEditView, props: true },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailStub, props: true },
    ],
  })
  router.push({ name: 'post-edit', params: { id } })
  const result = render(PostEditView, { props: { id }, global: { plugins: [router] } })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

describe('PostEditView', () => {
  it('マウント時に既存の投稿を読み込み、本文・画像が入力済みの状態で表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: existingPost })
    const { router } = renderPostEditView()
    await router.isReady()

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts/1')
      expect(screen.getByTestId('post-body')).toHaveValue('編集前の本文')
      expect(screen.getByTestId('post-image-remove-0')).toBeInTheDocument()
    })
  })

  it('見出し・送信ボタンが編集モードの文言になる（画面設計書169行目）', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: existingPost })
    const { router } = renderPostEditView()
    await router.isReady()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '投稿を編集' })).toBeInTheDocument()
      expect(screen.getByTestId('post-compose-submit')).toHaveTextContent('保存する')
    })
  })

  it('保存成功時に投稿詳細画面へ遷移する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: existingPost })
    const { router } = renderPostEditView()
    await router.isReady()
    await waitFor(() => screen.getByTestId('post-compose-submit'))

    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { ...existingPost, body: '更新後' } })
    await fireEvent.update(screen.getByTestId('post-body'), '更新後')
    await fireEvent.click(screen.getByTestId('post-compose-submit'))

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith('/api/posts/1', expect.any(FormData))
      expect(router.currentRoute.value.name).toBe('post-detail')
      expect(router.currentRoute.value.params.id).toBe('1')
    })
  })

  it('キャンセルで投稿詳細画面へ戻る', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: existingPost })
    const { router } = renderPostEditView()
    await router.isReady()
    await waitFor(() => screen.getByTestId('post-compose-cancel'))

    await fireEvent.click(screen.getByTestId('post-compose-cancel'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('post-detail')
    })
  })

  it('既存画像の削除ボタンでkeep_image_idsから除外される', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: existingPost })
    const { router } = renderPostEditView()
    await router.isReady()
    await waitFor(() => screen.getByTestId('post-image-remove-0'))

    await fireEvent.click(screen.getByTestId('post-image-remove-0'))
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: existingPost })
    await fireEvent.click(screen.getByTestId('post-compose-submit'))

    await waitFor(() => {
      const formData = vi.mocked(apiClient.put).mock.calls[0][1] as FormData
      expect(formData.get('keep_image_ids')).toBe('')
    })
  })
})
