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

function renderAppHeader() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: 1, username: 'taro', display_name: '太郎', avatar_url: null }

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
  vi.mocked(apiClient.post).mockReset()
})

describe('AppHeader', () => {
  it('ログイン中利用者の表示名から自分のプロフィールへリンクする', async () => {
    const { router } = renderAppHeader()
    await router.isReady()

    const link = screen.getByTestId('header-profile-link')
    expect(link).toHaveTextContent('太郎')

    await fireEvent.click(link)
    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile')
      expect(router.currentRoute.value.params.id).toBe('1')
    })
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
})
