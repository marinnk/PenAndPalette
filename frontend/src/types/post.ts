import type { AuthUser } from './auth'

// 基本設計書 6.3章 GET/POST /api/posts 等のレスポンス形式
export interface Post {
  id: number
  author: AuthUser
  body: string
  images: string[]
  // imagesと同じ並び順のid配列。投稿編集画面で「残す既存画像」を指定するkeep_image_idsに使う
  image_ids: number[]
  like_count: number
  want_count: number
  comment_count: number
  liked_by_me: boolean
  wanted_by_me: boolean
  created_at: string
  updated_at: string
}

export interface PostListResponse {
  results: Post[]
  has_more: boolean
}

export type TimelineScope = 'all' | 'following'
