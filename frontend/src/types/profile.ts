// S07 プロフィール画面の投稿一覧タブ（自分のプロフィールでのみ表示）。
// 「投稿」＝その利用者の投稿、「ブックマーク」＝その利用者がいいねした投稿
// （ブックマークはいいねを兼用する）
export type ProfileTab = 'posts' | 'bookmarks'

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
