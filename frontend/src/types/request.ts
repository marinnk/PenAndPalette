import type { AuthUser } from './auth'

// 基本設計書 6.7章 POST /api/users/{id}/requests・GET /api/requests/received の
// レスポンスに埋め込まれる、参考投稿の軽量な要約（posts.PostSummarySerializer）
export interface RelatedPostSummary {
  id: number
  author: AuthUser
  body: string
  image: string | null
  created_at: string
}

export interface RequestItem {
  id: number
  from_user: AuthUser
  related_post: RelatedPostSummary | null
  message: string
  created_at: string
}
