import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import ProfileEditView from './ProfileEditView.vue'
import type { Profile } from '@/types/profile'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const ProfileStub = { template: '<div>profile</div>' }

const profile = {
  id: 1,
  username: 'taro',
  display_name: '太郎',
  bio: 'よろしく',
  avatar_url: null,
  follower_count: 0,
  following_count: 0,
  followed_by_me: false,
}

async function renderProfileEditView(currentUserId = 1) {
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
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
      { path: '/profile/:id/edit', name: 'profile-edit', component: ProfileEditView, props: true },
    ],
  })
  // ProfileEditViewは<router-view>を介さずpropsで直接idを受け取るため、初期表示に
  // router側の現在位置は使わない（未設定のままでよい）。routerはコンポーネントが
  // 内部でrouter.push/replaceする遷移先の解決と、テストからの遷移先アサートにのみ使う
  const result = render(ProfileEditView, {
    props: { id: '1' },
    global: { plugins: [pinia, router] },
  })
  return { ...result, router }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.put).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('ProfileEditView', () => {
  it('自己紹介の現在値をフォームに表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: profile })
    await renderProfileEditView()

    await waitFor(() => {
      expect(screen.getByTestId('profile-edit-bio')).toHaveValue('よろしく')
    })
  })

  it('プロフィールの取得に失敗した場合はエラーメッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network error'))
    await renderProfileEditView()

    await waitFor(() => {
      expect(screen.getByTestId('profile-edit-load-error')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('profile-edit-bio')).not.toBeInTheDocument()
  })

  it('自分以外のidで開いた場合はプロフィール画面へリダイレクトする', async () => {
    const { router } = await renderProfileEditView(999)

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile')
    })
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('保存ボタンで自己紹介を更新しプロフィール画面へ戻る', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: profile })
    const { router } = await renderProfileEditView()
    await waitFor(() => expect(screen.getByTestId('profile-edit-bio')).toBeInTheDocument())

    await fireEvent.update(screen.getByTestId('profile-edit-bio'), '新しい自己紹介')
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { ...profile, bio: '新しい自己紹介' } })
    await fireEvent.click(screen.getByTestId('profile-edit-save'))

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith('/api/users/me', { bio: '新しい自己紹介' })
      expect(router.currentRoute.value.name).toBe('profile')
    })
  })

  it('自己紹介が160文字を超える場合はエラーを表示し画面遷移しない', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: profile })
    await renderProfileEditView()
    await waitFor(() => expect(screen.getByTestId('profile-edit-bio')).toBeInTheDocument())

    vi.mocked(apiClient.put).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { bio: ['160文字以内で入力してください。'] } },
    })
    await fireEvent.click(screen.getByTestId('profile-edit-save'))

    // 400エラー時は画面遷移せず、フォームに留まってエラーを表示する
    // （画面が'profile'へ遷移していればProfileEditView自体がアンマウントされ、
    // このtestidは見つからずwaitForがタイムアウトする）
    await waitFor(() => {
      expect(screen.getByTestId('profile-edit-bio-error')).toHaveTextContent(
        '160文字以内で入力してください。',
      )
    })
  })

  it('キャンセルボタンでプロフィール画面へ戻る', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: profile })
    const { router } = await renderProfileEditView()
    await waitFor(() => expect(screen.getByTestId('profile-edit-cancel')).toBeInTheDocument())

    await fireEvent.click(screen.getByTestId('profile-edit-cancel'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile')
    })
  })

  it('画像を選択すると即座にアップロードされ、プレビューに反映される', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: profile })
    await renderProfileEditView()
    await waitFor(() => expect(screen.getByTestId('profile-edit-avatar-input')).toBeInTheDocument())

    const updated = { ...profile, avatar_url: 'https://example.com/new.jpg' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: updated })
    const file = new File([new Uint8Array(10)], 'avatar.jpg', { type: 'image/jpeg' })
    await fireEvent.change(screen.getByTestId('profile-edit-avatar-input'), {
      target: { files: [file] },
    })

    // 画像アップロードは保存ボタンを待たず即時反映される（画面はProfileEditViewのまま、
    // ProfileEditView自体が引き続き表示されていることは他のtestidの取得で暗に確認できる）
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/users/me/avatar', expect.any(FormData))
      expect(screen.getByTestId('profile-edit-avatar-image')).toHaveAttribute(
        'src',
        'https://example.com/new.jpg',
      )
    })
  })

  it('アップロード中は「画像を選択」もbutton同様に見た目で無効化される（labelは:disabledと一致しないため、専用クラスで表現する）', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: profile })
    await renderProfileEditView()
    await waitFor(() => expect(screen.getByTestId('profile-edit-avatar-input')).toBeInTheDocument())

    let resolveUpload!: (value: { data: Profile }) => void
    vi.mocked(apiClient.post).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve
      }),
    )
    const file = new File([new Uint8Array(10)], 'avatar.jpg', { type: 'image/jpeg' })
    await fireEvent.change(screen.getByTestId('profile-edit-avatar-input'), {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('profile-edit-avatar-picker')).toHaveClass(
        'profile-edit-avatar-picker-disabled',
      )
    })

    resolveUpload({ data: { ...profile, avatar_url: 'https://example.com/new.jpg' } })

    await waitFor(() => {
      expect(screen.getByTestId('profile-edit-avatar-picker')).not.toHaveClass(
        'profile-edit-avatar-picker-disabled',
      )
    })
  })

  it('削除ボタンで即座にアイコン画像を削除する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { ...profile, avatar_url: 'https://example.com/old.jpg' },
    })
    await renderProfileEditView()
    await waitFor(() => expect(screen.getByTestId('profile-edit-avatar-remove')).toBeEnabled())

    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: { ...profile, avatar_url: null } })
    await fireEvent.click(screen.getByTestId('profile-edit-avatar-remove'))

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/api/users/me/avatar')
      expect(screen.queryByTestId('profile-edit-avatar-image')).not.toBeInTheDocument()
    })
  })

  it('アイコン画像が未設定の場合は削除ボタンを無効化する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: profile })
    await renderProfileEditView()

    await waitFor(() => {
      expect(screen.getByTestId('profile-edit-avatar-remove')).toBeDisabled()
    })
  })
})
