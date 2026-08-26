import type { AuthUser } from './auth'

// 基本設計書 6.4章 GET/POST /api/posts/{post_id}/comments 等のレスポンス形式
export interface Comment {
  id: number
  author: AuthUser
  content: string
  image_url: string | null
  created_at: string
  updated_at: string
}
