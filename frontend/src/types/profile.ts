// 基本設計書 6.6章 GET /api/users/{id} のレスポンス形式
export interface Profile {
  id: number
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  follower_count: number
  following_count: number
  followed_by_me: boolean
}
