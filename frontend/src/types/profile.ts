// 基本設計書 6.6章 GET /api/users/{id} のレスポンス形式（今回はプロフィール本実装の
// 暫定narrowingのため、follower_count等は含まない）
export interface Profile {
  id: number
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
}
