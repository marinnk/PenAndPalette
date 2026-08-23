import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { extractDetail, extractFieldErrors } from '@/lib/apiError'
import type { Post } from '@/types/post'

// S04 投稿作成画面（今回は本文のみのスタブ。画像添付は画像対応Issueで追加する）。
// stores/auth.tsのregister()と同じエラーハンドリングの形に揃える
export function usePostCreate() {
  const body = ref('')
  const submitting = ref(false)
  const errorMessage = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})

  async function submit(): Promise<Post | null> {
    errorMessage.value = null
    fieldErrors.value = {}
    submitting.value = true
    try {
      const { data } = await apiClient.post<Post>('/api/posts', { body: body.value })
      return data
    } catch (err) {
      fieldErrors.value = extractFieldErrors(err)
      if (Object.keys(fieldErrors.value).length === 0) {
        errorMessage.value = extractDetail(err) ?? '投稿に失敗しました。'
      }
      return null
    } finally {
      submitting.value = false
    }
  }

  return { body, submitting, errorMessage, fieldErrors, submit }
}
