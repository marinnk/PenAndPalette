import { onUnmounted, ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { extractDetail, extractFieldErrors, extractNonFieldError } from '@/lib/apiError'
import type { Post } from '@/types/post'

// 以下3つの定数は、バックエンドの検証ルールをクライアント側にも複製したもの（言語が異なるため
// 実行時に1つの定義を共有することはできない）。値を変更する場合は対応するバックエンド側も
// 必ず合わせて変更すること：
//   MAX_IMAGES          → backend/posts/serializers.py の PostCreateSerializer.MAX_IMAGES
//   MAX_IMAGE_SIZE_BYTES → backend/common/storage.py の MAX_IMAGE_SIZE_BYTES
//   ALLOWED_IMAGE_TYPES  → backend/common/storage.py の ALLOWED_CONTENT_TYPES
const MAX_IMAGES = 4
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

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

  // バックエンドのvalidate_image_file（common/storage.py）と同じルールをクライアント側でも
  // チェックし、送信前にその場でエラーを返せるようにする。サーバー側のfieldErrors.imagesは
  // このチェックをすり抜けたものに対する最終防衛線として残る
  function addImage(file: File): string | null {
    if (images.value.length >= MAX_IMAGES) return '画像は4枚まで添付できます。'
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return '画像はjpgまたはpng形式のみ添付できます。'
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) return '画像は1枚あたり5MBまでです。'

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
        errorMessage.value = extractNonFieldError(err) ?? extractDetail(err) ?? '投稿に失敗しました。'
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
