import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import RegisterView from './RegisterView.vue'
import LoginView from './LoginView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

// タイムライン画面自体の描画は他テストの責務のため、遷移先確認用の最小限のダミーで済ませる
const TimelineStub = { template: '<div>timeline</div>' }

function renderRegisterView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/login', name: 'login', component: LoginView },
      { path: '/register', name: 'register', component: RegisterView },
    ],
  })
  const result = render(RegisterView, { global: { plugins: [pinia, router] } })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
})

describe('RegisterView', () => {
  it('登録成功時にホームへ遷移する', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { id: 1, username: 'taro', display_name: 'taro', avatar_url: null },
    })
    const { router } = renderRegisterView()
    await router.isReady()

    await fireEvent.update(screen.getByTestId('register-username'), 'taro')
    await fireEvent.update(screen.getByTestId('register-email'), 'taro@example.com')
    await fireEvent.update(screen.getByTestId('register-password'), 'a-strong-password-1')
    await fireEvent.click(screen.getByTestId('register-submit'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })

  it('メールアドレス重複時にフィールド単位のエラーを表示する', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { email: ['このメールアドレスは既に登録されています。'] } },
    })
    renderRegisterView()

    await fireEvent.update(screen.getByTestId('register-username'), 'taro')
    await fireEvent.update(screen.getByTestId('register-email'), 'dup@example.com')
    await fireEvent.update(screen.getByTestId('register-password'), 'a-strong-password-1')
    await fireEvent.click(screen.getByTestId('register-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('register-email-error')).toHaveTextContent(
        'このメールアドレスは既に登録されています。',
      )
    })
  })
})
