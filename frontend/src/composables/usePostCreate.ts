import { onUnmounted, ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { extractDetail, extractFieldErrors, extractNonFieldError } from '@/lib/apiError'
import { validateNewImage } from '@/composables/postImageValidation'
import type { Post } from '@/types/post'

// S04 投稿作成画面。stores/auth.tsのregister()と同じエラーハンドリングの形に揃える
export function usePostCreate() {
  const body = ref('')
  const images = ref<File[]>([])
  const imagePreviews = ref<string[]>([])
  const submitting = ref(false)
  const errorMessage = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})

  function revokePreviews() {
    imagePreviews.value.forEach((url) => URL.revokeObjectURL(url))
  }

  function addImage(file: File): string | null {
    const error = validateNewImage(file, images.value.length)
    if (error) return error

    images.value.push(file)
    imagePreviews.value.push(URL.createObjectURL(file))
    return null
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(imagePreviews.value[index])
    images.value.splice(index, 1)
    imagePreviews.value.splice(index, 1)
  }

  onUnmounted(revokePreviews)

  async function submit(): Promise<Post | null> {
    errorMessage.value = null
    fieldErrors.value = {}
    submitting.value = true
    try {
      const formData = new FormData()
      if (body.value.trim()) formData.append('body', body.value)
      images.value.forEach((file) => formData.append('images', file))

      const { data } = await apiClient.post<Post>('/api/posts', formData)
      return data
    } catch (err) {
      fieldErrors.value = extractFieldErrors(err)
      if (Object.keys(fieldErrors.value).length === 0) {
        // 「本文または画像のいずれかを入力してください」のような、特定の入力欄に紐付かない
        // バリデーションエラー（non_field_errors）を優先して表示する
        errorMessage.value =
          extractNonFieldError(err) ?? extractDetail(err) ?? '投稿に失敗しました。'
      }
      return null
    } finally {
      submitting.value = false
    }
  }

  return {
    body,
    images,
    imagePreviews,
    submitting,
    errorMessage,
    fieldErrors,
    addImage,
    removeImage,
    submit,
  }
}
