import type { AuthUser } from './auth'

// 基本設計書 6.3章 GET/POST /api/posts 等のレスポンス形式
export interface Post {
  id: number
  author: AuthUser
  body: string
  images: string[]
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
