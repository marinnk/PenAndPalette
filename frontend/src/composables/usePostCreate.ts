import { onUnmounted, ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { extractDetail, extractFieldErrors, extractNonFieldError } from '@/lib/apiError'
import { validateNewImage } from '@/composables/postImageValidation'
import type { Post, PostType } from '@/types/post'

// S04 投稿作成画面。stores/auth.tsのregister()と同じエラーハンドリングの形に揃える
export function usePostCreate() {
  const postType = ref<PostType>('illustration')
  const title = ref('')
  const body = ref('')
  const images = ref<File[]>([])
  const imagePreviews = ref<string[]>([])
  const selectedTagIds = ref<number[]>([])
  const submitting = ref(false)
  const errorMessage = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})

  function revokePreviews() {
    imagePreviews.value.forEach((url) => URL.revokeObjectURL(url))
  }

  // 投稿種別を切り替える。切替前の入力内容（タイトル・本文・画像・タグ）を
  // そのまま持ち越すと種別ごとのルール違反になりうるため、切替と同時に空へ戻す
  // （切替前に「内容が失われる」ことをユーザーに確認するのはPostComposeForm側の責務）
  function setPostType(newType: PostType) {
    postType.value = newType
    title.value = ''
    body.value = ''
    revokePreviews()
    images.value = []
    imagePreviews.value = []
    selectedTagIds.value = []
  }

  function addImage(file: File): string | null {
    const error = validateNewImage(file, images.value.length, postType.value)
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
      formData.append('post_type', postType.value)
      formData.append('title', title.value)
      if (body.value.trim()) formData.append('body', body.value)
      images.value.forEach((file) => formData.append('images', file))
      selectedTagIds.value.forEach((id) => formData.append('tag_ids', String(id)))

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
    postType,
    title,
    body,
    images,
    imagePreviews,
    selectedTagIds,
    submitting,
    errorMessage,
    fieldErrors,
    setPostType,
    addImage,
    removeImage,
    submit,
  }
}
