import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiClient } from '@/lib/apiClient'
import { extractDetail, extractFieldErrors } from '@/lib/apiError'
import type { AuthUser, LoginPayload, RegisterPayload } from '@/types/auth'

// ログイン状態はアプリ全体で共有する必要があるためPiniaのstoreとして持つ。
// setup構文（ref/関数を返す形）で書くため、既存のcomposable（useHealthCheck等）と
// ほぼ同じ形のまま、devtools連携等のPiniaの恩恵を受けられる
export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthUser | null>(null)
  // 起動直後、GET /api/auth/me による最初のセッション確認が完了するまでtrue
  const isCheckingSession = ref(true)
  const submitting = ref(false)
  const errorMessage = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})

  function resetErrors() {
    errorMessage.value = null
    fieldErrors.value = {}
  }

  async function fetchMe() {
    try {
      const { data } = await apiClient.get<AuthUser>('/api/auth/me')
      currentUser.value = data
    } catch {
      currentUser.value = null
    } finally {
      isCheckingSession.value = false
    }
  }

  async function login(payload: LoginPayload): Promise<boolean> {
    resetErrors()
    submitting.value = true
    try {
      const { data } = await apiClient.post<AuthUser>('/api/auth/login', payload)
      currentUser.value = data
      return true
    } catch (err) {
      errorMessage.value = extractDetail(err) ?? 'ログインに失敗しました。'
      return false
    } finally {
      submitting.value = false
    }
  }

  async function register(payload: RegisterPayload): Promise<boolean> {
    resetErrors()
    submitting.value = true
    try {
      const { data } = await apiClient.post<AuthUser>('/api/auth/register', payload)
      currentUser.value = data
      return true
    } catch (err) {
      fieldErrors.value = extractFieldErrors(err)
      if (Object.keys(fieldErrors.value).length === 0) {
        errorMessage.value = extractDetail(err) ?? '登録に失敗しました。'
      }
      return false
    } finally {
      submitting.value = false
    }
  }

  async function logout() {
    submitting.value = true
    try {
      await apiClient.post('/api/auth/logout')
    } catch {
      // APIの成否に関わらずログイン状態を終了する（楽観的ログアウト）
    } finally {
      currentUser.value = null
      submitting.value = false
    }
  }

  return {
    currentUser,
    isCheckingSession,
    submitting,
    errorMessage,
    fieldErrors,
    fetchMe,
    login,
    register,
    logout,
  }
})
