import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { extractDetail, extractFieldErrors, extractNonFieldError } from '@/lib/apiError'
import { validateCommentImage } from '@/composables/postImageValidation'
import { useSingleImagePreview } from '@/composables/useSingleImagePreview'
import type { Comment } from '@/types/comment'

// S05 投稿詳細画面のコメント一覧・投稿・編集・削除を担うcomposable（基本設計書6.4章）。
// usePostReactions・usePostDeleteと同じく、API呼び出しの失敗はthrowせずnull/falseで返し、
// 呼び出し側がエラーメッセージの表示を判断できるようにする。
//
// postIdは呼び出し時点で固定せず、fetchComments・submitCommentの引数として都度受け取る
// （usePostDetail.loadと同じ理由：Vue Routerは/posts/:id内の別idへの遷移でコンポーネント
// インスタンスを使い回すため、生成時に固定すると別の投稿に切り替わらない）
export function useComments() {
  const comments = ref<Comment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  // 直近で開始したfetchComments呼び出しのpostId。複数の投稿間を素早く行き来した場合に、
  // 後から発行したリクエストより前のリクエストの応答が遅れて返ってくる（ネットワークの
  // 遅延・順序入れ替わり）ことがあるため、応答を反映する直前に「これはまだ最新の要求か」を
  // 確認し、古い応答が新しい投稿のコメントを上書きしてしまうのを防ぐ
  let latestRequestedPostId = 0

  // コメント投稿フォームの下書き状態。usePostCreateのbody/imagesと同じ形で、
  // composableがフォームの入力状態ごと持つことでCommentComposeFormを純粋な表示専用に保てる
  const composeContent = ref('')
  const composeImage = ref<File | undefined>(undefined)
  const { preview: composeImagePreview, setFile: setComposeImagePreview, clear: clearComposeImagePreview } =
    useSingleImagePreview()
  const composeImageError = ref<string | null>(null)

  const submitting = ref(false)
  const fieldErrors = ref<Record<string, string[]>>({})
  // コメント投稿（下のCommentComposeForm）専用のエラー。更新・削除のエラーとは表示場所が
  // 異なる（投稿フォームの直下 vs 一覧上部の共通バナー）ため、混ざらないよう別のrefにする
  const composeError = ref<string | null>(null)
  // コメントの編集・削除（一覧側の操作）で共有するエラー
  const actionError = ref<string | null>(null)

  // 編集・削除の二重送信防止（usePostReactions.useReactablePostsのpendingIdsと同じ考え方）
  const pendingIds = ref<Set<number>>(new Set())

  function isPending(commentId: number) {
    return pendingIds.value.has(commentId)
  }

  async function fetchComments(postId: number) {
    latestRequestedPostId = postId
    loading.value = true
    error.value = null
    // 別の投稿へ遷移した直後は、前の投稿のコメントを残したまま新しいコメントの取得を
    // 待たせない（usePostDetail.loadは投稿本体を並行して取得しており、そちらが先に
    // 終わるとloadingがfalseになりCommentListが描画されうるため、ここで空にしておかないと
    // 前の投稿のコメントが一瞬表示されたままになってしまう）
    comments.value = []
    try {
      const { data } = await apiClient.get<Comment[]>(`/api/posts/${postId}/comments`)
      // 応答が返ってきた時点で、既にもっと新しい投稿への切り替えが始まっていたら
      // （古い応答が後から届いた場合）、この結果は捨てる
      if (postId !== latestRequestedPostId) return
      comments.value = data
    } catch {
      if (postId !== latestRequestedPostId) return
      error.value = 'コメントの取得に失敗しました。'
    } finally {
      if (postId === latestRequestedPostId) loading.value = false
    }
  }

  function addComposeImage(file: File) {
    const validationError = validateCommentImage(file)
    if (validationError) {
      composeImageError.value = validationError
      return
    }
    composeImageError.value = null
    composeImage.value = file
    setComposeImagePreview(file)
  }

  function removeComposeImage() {
    clearComposeImagePreview()
    composeImage.value = undefined
  }

  async function submitComment(postId: number): Promise<Comment | null> {
    composeError.value = null
    fieldErrors.value = {}
    submitting.value = true
    try {
      const formData = new FormData()
      if (composeContent.value.trim()) formData.append('content', composeContent.value)
      if (composeImage.value) formData.append('image', composeImage.value)

      const { data } = await apiClient.post<Comment>(`/api/posts/${postId}/comments`, formData)
      comments.value.push(data)
      composeContent.value = ''
      removeComposeImage()
      return data
    } catch (err) {
      fieldErrors.value = extractFieldErrors(err)
      if (Object.keys(fieldErrors.value).length === 0) {
        composeError.value =
          extractNonFieldError(err) ?? extractDetail(err) ?? 'コメントの投稿に失敗しました。'
      }
      return null
    } finally {
      submitting.value = false
    }
  }

  async function updateComment(
    id: number,
    payload: { content: string; image?: File; removeImage?: boolean },
  ): Promise<Comment | null> {
    if (isPending(id)) return null
    pendingIds.value.add(id)
    actionError.value = null
    try {
      const formData = new FormData()
      if (payload.content.trim()) formData.append('content', payload.content)
      if (payload.image) formData.append('image', payload.image)
      if (payload.removeImage) formData.append('remove_image', 'true')

      const { data } = await apiClient.put<Comment>(`/api/comments/${id}`, formData)
      const index = comments.value.findIndex((c) => c.id === id)
      if (index !== -1) comments.value[index] = data
      return data
    } catch (err) {
      // フィールド別メッセージ（例：本文の文字数制限）も、一覧中の特定の1件に対する
      // エラーとして表示先が無いため、まとめて1つの文言にしてactionErrorに載せる
      const fieldMessages = Object.values(extractFieldErrors(err)).flat().join(' ')
      actionError.value =
        fieldMessages || extractNonFieldError(err) || extractDetail(err) || 'コメントの更新に失敗しました。'
      return null
    } finally {
      pendingIds.value.delete(id)
    }
  }

  async function removeComment(id: number): Promise<boolean> {
    if (isPending(id)) return false
    pendingIds.value.add(id)
    actionError.value = null
    try {
      await apiClient.delete(`/api/comments/${id}`)
      comments.value = comments.value.filter((c) => c.id !== id)
      return true
    } catch (err) {
      actionError.value = extractDetail(err) ?? '削除に失敗しました。もう一度お試しください。'
      return false
    } finally {
      pendingIds.value.delete(id)
    }
  }

  return {
    comments,
    loading,
    error,
    composeContent,
    composeImage,
    composeImagePreview,
    composeImageError,
    submitting,
    fieldErrors,
    composeError,
    actionError,
    isPending,
    fetchComments,
    addComposeImage,
    removeComposeImage,
    submitComment,
    updateComment,
    removeComment,
  }
}
