// 基本設計書 6.2章 GET /api/auth/me 等のレスポンス形式
export interface AuthUser {
  id: number
  username: string
  display_name: string
  avatar_url: string | null
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
}
