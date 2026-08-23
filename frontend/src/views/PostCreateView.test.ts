import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import PostCreateView from './PostCreateView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const TimelineStub = { template: '<div>timeline</div>' }

function renderPostCreateView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/new', name: 'post-create', component: PostCreateView },
    ],
  })
  router.push({ name: 'post-create' })
  const result = render(PostCreateView, { global: { plugins: [router] } })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset()
})

describe('PostCreateView', () => {
  it('文字数カウンターが入力に応じて更新される', async () => {
    renderPostCreateView()

    await fireEvent.update(screen.getByTestId('post-body'), 'こんにちは')

    expect(screen.getByTestId('post-body-counter')).toHaveTextContent('5/280')
  })

  it('投稿成功時にタイムラインへ遷移する', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 1, body: 'テスト' } })
    const { router } = renderPostCreateView()
    await router.isReady()

    await fireEvent.update(screen.getByTestId('post-body'), 'テスト')
    await fireEvent.click(screen.getByTestId('post-create-submit'))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/posts', { body: 'テスト' })
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })

  it('本文が空のときは投稿ボタンがdisabledになる', () => {
    renderPostCreateView()

    expect(screen.getByTestId('post-create-submit')).toBeDisabled()
  })

  it('キャンセルでタイムラインへ戻る', async () => {
    const { router } = renderPostCreateView()
    await router.isReady()

    await fireEvent.click(screen.getByTestId('post-create-cancel'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })
})
