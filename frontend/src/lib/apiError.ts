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

// DRFはシリアライザのvalidate()（特定のフィールドに紐付かない、フォーム全体に対する
// バリデーションエラー）をこのキーで返す。「本文または画像のいずれかを入力してください」等が該当する
const NON_FIELD_ERRORS_KEY = 'non_field_errors'

/** 400バリデーションエラー、`{"フィールド名": ["エラー内容", ...]}`形式をそのまま取り出す。
 * non_field_errorsは特定の入力欄に紐付けられないため、ここには含めない
 * （呼び出し側でextractNonFieldErrorを使って汎用エラーとして表示する）。
 */
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
    if (field === NON_FIELD_ERRORS_KEY) continue
    if (Array.isArray(messages)) {
      fieldErrors[field] = messages.map(String)
    }
  }
  return fieldErrors
}

/** 400バリデーションエラーのうち、特定の入力欄に紐付かないnon_field_errorsを取り出す。
 * 「本文または画像のいずれかを入力してください」のような、複数の入力欄にまたがる
 * バリデーションルールの違反時にDRFが返す形式。
 */
export function extractNonFieldError(error: unknown): string | null {
  if (!isAxiosError(error) || error.response?.status !== 400) {
    return null
  }

  const data = error.response.data as Record<string, unknown> | undefined
  const messages = data?.[NON_FIELD_ERRORS_KEY]
  if (Array.isArray(messages) && messages.length > 0) {
    return messages.map(String).join(' ')
  }
  return null
}
