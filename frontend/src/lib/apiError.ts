import { isAxiosError } from 'axios'

// 基本設計書 6.1章: バリデーションエラー(400)は {"フィールド名": ["エラー内容", ...]}、
// 認証/権限/存在しない(401/403/404)は {"detail": "エラー内容"} というDRF標準の形式に従う

/** 401/403/404等、`{"detail": "..."}`形式のエラーメッセージを取り出す。 */
export function extractDetail(error: unknown): string | null {
  if (isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
    return error.response.data.detail
  }
  return null
}

/** 400バリデーションエラー、`{"フィールド名": ["エラー内容", ...]}`形式をそのまま取り出す。 */
export function extractFieldErrors(error: unknown): Record<string, string[]> {
  if (!isAxiosError(error) || error.response?.status !== 400) {
    return {}
  }

  const data = error.response.data as unknown
  if (typeof data !== 'object' || data === null) {
    return {}
  }

  const fieldErrors: Record<string, string[]> = {}
  for (const [field, messages] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(messages)) {
      fieldErrors[field] = messages.map(String)
    }
  }
  return fieldErrors
}
