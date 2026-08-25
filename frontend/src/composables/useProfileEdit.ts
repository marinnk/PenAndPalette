import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import { extractDetail, extractFieldErrors, extractNonFieldError } from '@/lib/apiError'
import { validateAvatarFile } from '@/composables/postImageValidation'
import type { Profile } from '@/types/profile'

// S08 プロフィール編集画面。アイコン画像の登録・削除は保存ボタンを待たず、
// 選択・削除操作の時点でPOST/DELETE /api/users/me/avatarを呼んで即時に確定する
// （姉妹プロジェクトRaiseTechSNSのProfileEditFormと同じ方針）。自己紹介はPUT /api/users/meで
// 保存ボタンを押した時にまとめて確定する
export function useProfileEdit() {
  const auth = useAuthStore()
  const profile = ref<Profile | null>(null)
  const bio = ref('')
  const loading = ref(false)
  const loadError = ref(false)
  const submitting = ref(false)
  const errorMessage = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})
  const avatarError = ref<string | null>(null)
  const avatarUpdating = ref(false)

  // アイコン画像の更新はヘッダー（AppHeader.vue）の表示にもその場で反映させたいため、
  // profile.valueだけでなくauth.currentUser（Piniaのref、ネストしたプロパティの変更も
  // リアクティブに検知される）のavatar_urlも合わせて更新する
  function applyProfile(data: Profile) {
    profile.value = data
    if (auth.currentUser) auth.currentUser.avatar_url = data.avatar_url
  }

  async function load(userId: number) {
    loading.value = true
    loadError.value = false
    try {
      const { data } = await apiClient.get<Profile>(`/api/users/${userId}`)
      applyProfile(data)
      bio.value = data.bio ?? ''
    } catch {
      loadError.value = true
    } finally {
      loading.value = false
    }
  }

  async function save(): Promise<boolean> {
    errorMessage.value = null
    fieldErrors.value = {}
    submitting.value = true
    try {
      const { data } = await apiClient.put<Profile>('/api/users/me', { bio: bio.value })
      applyProfile(data)
      return true
    } catch (err) {
      fieldErrors.value = extractFieldErrors(err)
      if (Object.keys(fieldErrors.value).length === 0) {
        errorMessage.value =
          extractNonFieldError(err) ?? extractDetail(err) ?? '保存に失敗しました。'
      }
      return false
    } finally {
      submitting.value = false
    }
  }

  async function uploadAvatar(file: File) {
    const clientError = validateAvatarFile(file)
    if (clientError) {
      avatarError.value = clientError
      return
    }

    avatarError.value = null
    avatarUpdating.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<Profile>('/api/users/me/avatar', formData)
      applyProfile(data)
    } catch (err) {
      avatarError.value =
        extractFieldErrors(err).file?.[0] ??
        extractDetail(err) ??
        'アイコン画像の更新に失敗しました。'
    } finally {
      avatarUpdating.value = false
    }
  }

  async function removeAvatar() {
    avatarError.value = null
    avatarUpdating.value = true
    try {
      const { data } = await apiClient.delete<Profile>('/api/users/me/avatar')
      applyProfile(data)
    } catch {
      avatarError.value = 'アイコン画像の削除に失敗しました。'
    } finally {
      avatarUpdating.value = false
    }
  }

  return {
    profile,
    bio,
    loading,
    loadError,
    submitting,
    errorMessage,
    fieldErrors,
    avatarError,
    avatarUpdating,
    load,
    save,
    uploadAvatar,
    removeAvatar,
  }
}
