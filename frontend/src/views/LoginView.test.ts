import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import LoginView from './LoginView.vue'
import RegisterView from './RegisterView.vue'
import HomeView from './HomeView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

function renderLoginView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/login', name: 'login', component: LoginView },
      { path: '/register', name: 'register', component: RegisterView },
    ],
  })
  const result = render(LoginView, { global: { plugins: [pinia, router] } })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
})

describe('LoginView', () => {
  it('ログイン成功時にホームへ遷移する', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { id: 1, username: 'taro', display_name: '太郎', avatar_url: null },
    })
    const { router } = renderLoginView()
    await router.isReady()

    await fireEvent.update(screen.getByTestId('login-email'), 'taro@example.com')
    await fireEvent.update(screen.getByTestId('login-password'), 'password123')
    await fireEvent.click(screen.getByTestId('login-submit'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('home')
    })
  })

  it('ログイン失敗時にエラーメッセージを表示する', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 401,
        data: { detail: 'メールアドレスまたはパスワードが正しくありません。' },
      },
    })
    renderLoginView()

    await fireEvent.update(screen.getByTestId('login-email'), 'taro@example.com')
    await fireEvent.update(screen.getByTestId('login-password'), 'wrong-password')
    await fireEvent.click(screen.getByTestId('login-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('login-error')).toHaveTextContent(
        'メールアドレスまたはパスワードが正しくありません。',
      )
    })
  })

  it('送信中はsubmitボタンがdisabledになる', async () => {
    let resolvePost: (value: unknown) => void = () => {}
    vi.mocked(apiClient.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve
        }),
    )
    renderLoginView()

    await fireEvent.update(screen.getByTestId('login-email'), 'taro@example.com')
    await fireEvent.update(screen.getByTestId('login-password'), 'password123')
    await fireEvent.click(screen.getByTestId('login-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('login-submit')).toBeDisabled()
    })

    resolvePost({ data: { id: 1, username: 'taro', display_name: '太郎', avatar_url: null } })
  })
})
