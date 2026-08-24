import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import FollowListView from './FollowListView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

const ProfileStub = { template: '<div>profile</div>' }
// FollowListView自身はrouter-viewの外から直接renderせず、<RouterView/>越しに描画する。
// タブ切り替え（router.push）でprops（id・tab）が再供給されることを確認するため
const RouterViewWrapper = { template: '<RouterView />' }

async function renderFollowListView(tab: 'following' | 'followers') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
      {
        path: '/profile/:id/following',
        name: 'profile-following',
        component: FollowListView,
        props: (route) => ({ id: route.params.id, tab: 'following' }),
      },
      {
        path: '/profile/:id/followers',
        name: 'profile-followers',
        component: FollowListView,
        props: (route) => ({ id: route.params.id, tab: 'followers' }),
      },
    ],
  })
  await router.push({
    name: tab === 'following' ? 'profile-following' : 'profile-followers',
    params: { id: '1' },
  })
  const result = render(RouterViewWrapper, { global: { plugins: [router] } })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('FollowListView', () => {
  it('フォロワー一覧を表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: 2, username: 'jiro', display_name: '次郎', avatar_url: null }],
    })
    await renderFollowListView('followers')

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/users/1/followers')
      expect(screen.getByTestId('follow-list-item-2')).toHaveTextContent('次郎')
    })
  })

  it('フォロー中タブに切り替えるとURLが変わり、フォロー中一覧を取得する', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
    const { router } = await renderFollowListView('followers')
    await waitFor(() => expect(screen.getByTestId('follow-list-tab-following')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('follow-list-tab-following'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile-following')
      expect(apiClient.get).toHaveBeenCalledWith('/api/users/1/following')
    })
  })

  it('一覧が空のときは空状態メッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })
    await renderFollowListView('followers')

    await waitFor(() => {
      expect(screen.getByTestId('follow-list-empty')).toBeInTheDocument()
    })
  })

  it('取得に失敗した場合はエラーメッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('failed'))
    await renderFollowListView('followers')

    await waitFor(() => {
      expect(screen.getByTestId('follow-list-error')).toBeInTheDocument()
    })
  })
})
