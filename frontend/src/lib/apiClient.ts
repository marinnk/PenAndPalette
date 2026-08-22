import axios from 'axios'

// 基本設計書 3章: 認証はHttpOnly Cookieで行うため、フロントエンドはトークンの値を一切扱わない。
// withCredentials: true を指定することで、ブラウザが自動的にCookieを送信する
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  withCredentials: true,
})

// login/register/refresh自身への401はセッション切れではなく、認証情報の誤りや
// リフレッシュトークン自体の無効化を意味するため、無限リトライを避けるため対象から除外する
const NO_REFRESH_RETRY_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh']

// 同時に複数のリクエストが401になっても、refreshの呼び出しは1回にまとめる
let refreshPromise: Promise<boolean> | null = null
function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post('/api/auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

// 基本設計書 3章: アクセストークンが失効した場合、フロントエンドはPOST /api/auth/refreshを呼び
// 両トークンを再発行する。ここではその流れをaxios interceptorとして共通化し、401を受けたリクエストは
// refresh成功後に1回だけ透過的にリトライする
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    const shouldRetry =
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !NO_REFRESH_RETRY_PATHS.some((path) => config.url?.includes(path))

    if (shouldRetry) {
      config._retried = true
      if (await refreshSession()) {
        return apiClient.request(config)
      }
    }

    return Promise.reject(error)
  },
)
