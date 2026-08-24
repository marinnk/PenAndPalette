import { ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import { apiClient } from '@/lib/apiClient'
import { extractDetail, extractFieldErrors } from '@/lib/apiError'
import type { AuthUser, LoginPayload, RegisterPayload } from '@/types/auth'

// ログイン状態はアプリ全体で共有する必要があるためPiniaのstoreとして持つ。
// setup構文（ref/関数を返す形）で書くため、既存のcomposable（useTimeline等）と
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

  // 同時に複数の画面遷移が発生してもfetchMe()の呼び出しは1回にまとめる
  // （router.beforeEachは各ナビゲーションで独立に実行されるため、対策が無いと
  // 1回目の完了を待たずに2回目のナビゲーションが二重にGET /api/auth/meを呼んでしまう）
  let fetchMePromise: Promise<void> | null = null

  function fetchMe(): Promise<void> {
    if (fetchMePromise) return fetchMePromise
    fetchMePromise = (async () => {
      try {
        const { data } = await apiClient.get<AuthUser>('/api/auth/me')
        currentUser.value = data
        isCheckingSession.value = false
      } catch (err) {
        currentUser.value = null
        // サーバーからレスポンスが返ってきた場合（401等）は「未ログイン」と確定できるため
        // 確認完了とする。ネットワーク不調等でレスポンス自体が得られない一時的な失敗の場合は
        // isCheckingSessionをtrueのままにし、次の画面遷移で再試行できるようにする
        // （そうしないと、一時的な通信エラー1回だけでアプリ全体がログイン画面に固定されてしまう）
        if (isAxiosError(err) && err.response) {
          isCheckingSession.value = false
        }
      } finally {
        fetchMePromise = null
      }
    })()
    return fetchMePromise
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
