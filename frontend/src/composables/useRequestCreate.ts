import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { extractDetail, extractFieldErrors } from '@/lib/apiError'
import type { RequestItem } from '@/types/request'

// S06 リクエスト作成画面。usePostCreate.tsと同じ形のsubmit/エラーハンドリング
export function useRequestCreate(toUserId: number) {
  const message = ref('')
  const relatedPostId = ref('')
  const submitting = ref(false)
  const errorMessage = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})

  async function submit(): Promise<RequestItem | null> {
    errorMessage.value = null
    fieldErrors.value = {}
    submitting.value = true
    try {
      const { data } = await apiClient.post<RequestItem>(`/api/users/${toUserId}/requests`, {
        message: message.value,
        related_post_id: relatedPostId.value.trim() ? Number(relatedPostId.value) : null,
      })
      return data
    } catch (err) {
      fieldErrors.value = extractFieldErrors(err)
      if (Object.keys(fieldErrors.value).length === 0) {
        errorMessage.value = extractDetail(err) ?? 'リクエストの送信に失敗しました。'
      }
      return null
    } finally {
      submitting.value = false
    }
  }

  return { message, relatedPostId, submitting, errorMessage, fieldErrors, submit }
}
