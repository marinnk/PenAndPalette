import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useComments } from './useComments'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

// jsdomはURL.createObjectURL/revokeObjectURLを実装していないため、プレビュー生成のテストが
// 動くように最小限のスタブを用意する
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()

function makeFile(name = 'a.jpg', type = 'image/jpeg', size = 1024) {
  return new File([new Uint8Array(size)], name, { type })
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    author: { id: 1, username: 'taro', display_name: '太郎', avatar_url: null },
    content: 'コメント',
    image_url: null,
    created_at: '2026-08-23T00:00:00Z',
    updated_at: '2026-08-23T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('useComments', () => {
  describe('fetchComments', () => {
    it('投稿idのコメント一覧を取得しcommentsに反映する', async () => {
      const list = [makeComment({ id: 1 }), makeComment({ id: 2 })]
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: list })

      const { comments, fetchComments } = useComments()
      await fetchComments(42)

      expect(apiClient.get).toHaveBeenCalledWith('/api/posts/42/comments')
      expect(comments.value).toEqual(list)
    })

    it('失敗した場合はerrorにメッセージを設定する', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network error'))

      const { error, fetchComments } = useComments()
      await fetchComments(42)

      expect(error.value).toBe('コメントの取得に失敗しました。')
    })

    it('別の投稿へ切り替えたときは取得完了前に前の投稿のコメントを表示しない', async () => {
      // 投稿本体（usePostDetail.load）とコメント一覧は並行して取得するため、後者が
      // 完了するまでの間、前の投稿のコメントが一瞬でも見えてはいけない
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [makeComment({ id: 1 })] })
      const { comments, fetchComments } = useComments()
      await fetchComments(1)
      expect(comments.value).toHaveLength(1)

      let resolveNext: (value: unknown) => void = () => {}
      vi.mocked(apiClient.get).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNext = resolve
          }),
      )
      const pending = fetchComments(2)
      expect(comments.value).toEqual([])

      resolveNext({ data: [makeComment({ id: 2 })] })
      await pending
      expect(comments.value).toEqual([makeComment({ id: 2 })])
    })

    it('取得に失敗した場合は前の投稿のコメントを残さない', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [makeComment({ id: 1 })] })
      const { comments, fetchComments } = useComments()
      await fetchComments(1)
      expect(comments.value).toHaveLength(1)

      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network error'))
      await fetchComments(2)

      expect(comments.value).toEqual([])
    })
  })

  describe('submitComment', () => {
    it('成功したらcommentsに追加し下書きをリセットする（FormDataでcontentを送る）', async () => {
      const created = makeComment({ id: 5, content: 'はじめてのコメント' })
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: created })

      const { comments, composeContent, submitComment } = useComments()
      composeContent.value = 'はじめてのコメント'
      const result = await submitComment(42)

      expect(apiClient.post).toHaveBeenCalledWith('/api/posts/42/comments', expect.any(FormData))
      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('content')).toBe('はじめてのコメント')
      expect(result).toEqual(created)
      expect(comments.value).toEqual([created])
      expect(composeContent.value).toBe('')
    })

    it('画像を追加した場合はFormDataに含めて送信する', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: makeComment() })

      const { addComposeImage, submitComment } = useComments()
      addComposeImage(makeFile())
      await submitComment(42)

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('image')).toBeInstanceOf(File)
    })

    it('本文・画像のどちらも無効な形式の場合はcomposeImageErrorを設定し追加しない', () => {
      const { composeImage, composeImageError, addComposeImage } = useComments()

      addComposeImage(makeFile('a.gif', 'image/gif'))

      expect(composeImageError.value).toBe('画像はjpgまたはpng形式のみ添付できます。')
      expect(composeImage.value).toBeUndefined()
    })

    it('400バリデーションエラーはfieldErrorsに振り分けられる', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 400, data: { content: ['この項目は280文字以内で入力してください。'] } },
      })

      const { submitComment, fieldErrors, errorMessage } = useComments()
      const result = await submitComment(42)

      expect(result).toBeNull()
      expect(fieldErrors.value.content).toEqual(['この項目は280文字以内で入力してください。'])
      expect(errorMessage.value).toBeNull()
    })

    it('non_field_errorsはerrorMessageに表示される', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: { non_field_errors: ['本文または画像のいずれかを入力してください。'] },
        },
      })

      const { submitComment, errorMessage } = useComments()
      const result = await submitComment(42)

      expect(result).toBeNull()
      expect(errorMessage.value).toBe('本文または画像のいずれかを入力してください。')
    })
  })

  describe('updateComment', () => {
    it('成功したらcomments内の該当要素を置き換える', async () => {
      const original = makeComment({ id: 1, content: '編集前' })
      const updated = makeComment({ id: 1, content: '編集後' })
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [original] })
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: updated })

      const { comments, fetchComments, updateComment } = useComments()
      await fetchComments(42)
      const result = await updateComment(1, { content: '編集後' })

      expect(apiClient.put).toHaveBeenCalledWith('/api/comments/1', expect.any(FormData))
      expect(result).toEqual(updated)
      expect(comments.value).toEqual([updated])
    })

    it('remove_imageをtrueで送るとFormDataにremove_image=trueが含まれる', async () => {
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: makeComment() })

      const { updateComment } = useComments()
      await updateComment(1, { content: '本文', removeImage: true })

      const formData = vi.mocked(apiClient.put).mock.calls[0][1] as FormData
      expect(formData.get('remove_image')).toBe('true')
    })

    it('失敗した場合はerrorMessageを設定しnullを返す', async () => {
      vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('network error'))

      const { updateComment, errorMessage } = useComments()
      const result = await updateComment(1, { content: '本文' })

      expect(result).toBeNull()
      expect(errorMessage.value).toBe('コメントの更新に失敗しました。')
    })

    it('400バリデーションエラーは具体的なメッセージをerrorMessageに表示する', async () => {
      vi.mocked(apiClient.put).mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 400, data: { content: ['この項目は280文字以内で入力してください。'] } },
      })

      const { updateComment, errorMessage, fieldErrors } = useComments()
      const result = await updateComment(1, { content: '本文' })

      expect(result).toBeNull()
      expect(errorMessage.value).toBe('この項目は280文字以内で入力してください。')
      // 更新対象は一覧中の1件だけなので、投稿フォームと共有するfieldErrorsは汚染しない
      expect(fieldErrors.value).toEqual({})
    })
  })

  describe('removeComment', () => {
    it('成功したらcommentsから取り除きtrueを返す', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [makeComment({ id: 1 })] })
      vi.mocked(apiClient.delete).mockResolvedValueOnce({})

      const { comments, fetchComments, removeComment } = useComments()
      await fetchComments(42)
      const result = await removeComment(1)

      expect(apiClient.delete).toHaveBeenCalledWith('/api/comments/1')
      expect(result).toBe(true)
      expect(comments.value).toEqual([])
    })

    it('失敗した場合はerrorMessageを設定しfalseを返す', async () => {
      vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('network error'))

      const { removeComment, errorMessage } = useComments()
      const result = await removeComment(1)

      expect(result).toBe(false)
      expect(errorMessage.value).toBe('削除に失敗しました。もう一度お試しください。')
    })
  })
})
