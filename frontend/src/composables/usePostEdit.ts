import { onUnmounted, ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { extractDetail, extractFieldErrors, extractNonFieldError } from '@/lib/apiError'
import { validateNewImage } from '@/composables/postImageValidation'
import type { Post } from '@/types/post'

// S04 投稿作成画面を編集モードで開いた場合（画面設計書169行目）。usePostCreateと状態の形は
// 似ているが、既存画像を「残す」「消す」で扱う分岐（keepImageIds/keepImagePreviews）が
// 加わり、送信もPOSTではなくPUTになるため独立したcomposableとする
export function usePostEdit(postId: number) {
  const body = ref('')
  // 残す既存画像のid・プレビューURL（常に同じ並び順）
  const keepImageIds = ref<number[]>([])
  const keepImagePreviews = ref<string[]>([])
  // 新規追加分（ファイル自体を保持する必要があるためFile[]）
  const images = ref<File[]>([])
  const imagePreviews = ref<string[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const errorMessage = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})

  function revokeNewPreviews() {
    imagePreviews.value.forEach((url) => URL.revokeObjectURL(url))
  }

  async function load() {
    loading.value = true
    errorMessage.value = null
    try {
      const { data } = await apiClient.get<Post>(`/api/posts/${postId}`)
      body.value = data.body
      keepImageIds.value = [...data.image_ids]
      keepImagePreviews.value = [...data.images]
    } catch {
      errorMessage.value = '投稿の読み込みに失敗しました。'
    } finally {
      loading.value = false
    }
  }

  function addImage(file: File): string | null {
    const error = validateNewImage(file, keepImageIds.value.length + images.value.length)
    if (error) return error

    images.value.push(file)
    imagePreviews.value.push(URL.createObjectURL(file))
    return null
  }

  function removeExistingImage(index: number) {
    keepImageIds.value.splice(index, 1)
    keepImagePreviews.value.splice(index, 1)
  }

  function removeNewImage(index: number) {
    URL.revokeObjectURL(imagePreviews.value[index])
    images.value.splice(index, 1)
    imagePreviews.value.splice(index, 1)
  }

  onUnmounted(revokeNewPreviews)

  async function submit(): Promise<Post | null> {
    errorMessage.value = null
    fieldErrors.value = {}
    submitting.value = true
    try {
      const formData = new FormData()
      formData.append('body', body.value)
      formData.append('keep_image_ids', keepImageIds.value.join(','))
      images.value.forEach((file) => formData.append('images', file))

      const { data } = await apiClient.put<Post>(`/api/posts/${postId}`, formData)
      return data
    } catch (err) {
      fieldErrors.value = extractFieldErrors(err)
      if (Object.keys(fieldErrors.value).length === 0) {
        errorMessage.value =
          extractNonFieldError(err) ?? extractDetail(err) ?? '更新に失敗しました。'
      }
      return null
    } finally {
      submitting.value = false
    }
  }

  return {
    body,
    keepImageIds,
    keepImagePreviews,
    images,
    imagePreviews,
    loading,
    submitting,
    errorMessage,
    fieldErrors,
    load,
    addImage,
    removeExistingImage,
    removeNewImage,
    submit,
  }
}
