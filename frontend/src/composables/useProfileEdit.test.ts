import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import { useProfileEdit } from './useProfileEdit'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

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

function setUpAuth() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: 1, username: 'taro', display_name: '太郎', avatar_url: null }
  return auth
}

function makeImageFile(name = 'avatar.jpg', type = 'image/jpeg', size = 100) {
  const file = new File([new Uint8Array(size)], name, { type })
  return file
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.put).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('useProfileEdit', () => {
  it('load: プロフィールを取得しbioの初期値にする', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: profile })
    setUpAuth()

    const { load, profile: loadedProfile, bio } = useProfileEdit()
    await load(1)

    expect(apiClient.get).toHaveBeenCalledWith('/api/users/1')
    expect(loadedProfile.value).toEqual(profile)
    expect(bio.value).toBe('よろしく')
  })

  it('load: bioがnullの場合は空文字にする', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...profile, bio: null } })
    setUpAuth()

    const { load, bio } = useProfileEdit()
    await load(1)

    expect(bio.value).toBe('')
  })

  it('save: PUT /api/users/meで自己紹介を保存する', async () => {
    setUpAuth()
    const { bio, save, profile: current } = useProfileEdit()
    bio.value = '更新後の自己紹介'
    const updated = { ...profile, bio: '更新後の自己紹介' }
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: updated })

    const result = await save()

    expect(apiClient.put).toHaveBeenCalledWith('/api/users/me', { bio: '更新後の自己紹介' })
    expect(result).toBe(true)
    expect(current.value).toEqual(updated)
  })

  it('save: 文字数超過等のバリデーションエラーはfieldErrorsに反映する', async () => {
    setUpAuth()
    const { save, fieldErrors } = useProfileEdit()
    vi.mocked(apiClient.put).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { bio: ['160文字以内で入力してください。'] } },
    })

    const result = await save()

    expect(result).toBe(false)
    expect(fieldErrors.value.bio).toEqual(['160文字以内で入力してください。'])
  })

  it('uploadAvatar: POST /api/users/me/avatarでアイコン画像を登録し、authストアにも反映する', async () => {
    const auth = setUpAuth()
    const { uploadAvatar, profile: current } = useProfileEdit()
    const updated = { ...profile, avatar_url: 'https://example.com/avatar.jpg' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: updated })

    await uploadAvatar(makeImageFile())

    expect(apiClient.post).toHaveBeenCalledWith('/api/users/me/avatar', expect.any(FormData))
    expect(current.value?.avatar_url).toBe('https://example.com/avatar.jpg')
    expect(auth.currentUser?.avatar_url).toBe('https://example.com/avatar.jpg')
  })

  it('uploadAvatar: 形式が不正な場合はAPIを呼ばずavatarErrorを設定する', async () => {
    setUpAuth()
    const { uploadAvatar, avatarError } = useProfileEdit()

    await uploadAvatar(makeImageFile('avatar.txt', 'text/plain'))

    expect(apiClient.post).not.toHaveBeenCalled()
    expect(avatarError.value).toBe('画像はjpgまたはpng形式のみ添付できます。')
  })

  it('uploadAvatar: サイズが5MBを超える場合はAPIを呼ばずavatarErrorを設定する', async () => {
    setUpAuth()
    const { uploadAvatar, avatarError } = useProfileEdit()

    await uploadAvatar(makeImageFile('avatar.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1))

    expect(apiClient.post).not.toHaveBeenCalled()
    expect(avatarError.value).toBe('画像は1枚あたり5MBまでです。')
  })

  it('removeAvatar: DELETE /api/users/me/avatarでアイコン画像を削除し、authストアにも反映する', async () => {
    const auth = setUpAuth()
    auth.currentUser!.avatar_url = 'https://example.com/old.jpg'
    const { removeAvatar, profile: current } = useProfileEdit()
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: { ...profile, avatar_url: null } })

    await removeAvatar()

    expect(apiClient.delete).toHaveBeenCalledWith('/api/users/me/avatar')
    expect(current.value?.avatar_url).toBeNull()
    expect(auth.currentUser?.avatar_url).toBeNull()
  })

  it('removeAvatar: 失敗時はavatarErrorを設定する', async () => {
    setUpAuth()
    const { removeAvatar, avatarError } = useProfileEdit()
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))

    await removeAvatar()

    expect(avatarError.value).not.toBeNull()
  })
})
