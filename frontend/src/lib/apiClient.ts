import axios from 'axios'

// 基本設計書 3章: 認証はHttpOnly Cookieで行うため、フロントエンドはトークンの値を一切扱わない。
// withCredentials: true を指定することで、ブラウザが自動的にCookieを送信する
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  withCredentials: true,
})
