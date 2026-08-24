import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { usePostCreate } from './usePostCreate'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

function makeFile(name = 'a.jpg', type = 'image/jpeg', size = 1024) {
  const file = new File([new Uint8Array(size)], name, { type })
  return file
}

// jsdomはURL.createObjectURL/revokeObjectURLを実装していないため、プレビュー生成のテストが
// 動くように最小限のスタブを用意する
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset()
})

describe('usePostCreate', () => {
  it('submit: 成功したら作成された投稿を返す（FormDataでbodyを送る）', async () => {
    const created = { id: 1, body: 'はじめての投稿' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: created })

    const { body, submit } = usePostCreate()
    body.value = 'はじめての投稿'
    const result = await submit()

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts', expect.any(FormData))
    const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
    expect(formData.get('body')).toBe('はじめての投稿')
    expect(result).toEqual(created)
  })

  it('submit: 選択した画像もFormDataに含めて送信する', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 1 } })

    const { addImage, submit } = usePostCreate()
    addImage(makeFile('a.jpg'))
    addImage(makeFile('b.png', 'image/png'))
    await submit()

    const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
    expect(formData.getAll('images')).toHaveLength(2)
  })

  it('submit: 本文が空でも画像があれば送信できる', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 1 } })

    const { addImage, submit } = usePostCreate()
    addImage(makeFile())
    const result = await submit()

    expect(result).toEqual({ id: 1 })
    const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
    expect(formData.has('body')).toBe(false)
  })

  it('submit: 400バリデーションエラーはfieldErrorsに振り分けられる', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { body: ['この項目は必須です。'] } },
    })

    const { submit, fieldErrors, errorMessage } = usePostCreate()
    const result = await submit()

    expect(result).toBeNull()
    expect(fieldErrors.value.body).toEqual(['この項目は必須です。'])
    expect(errorMessage.value).toBeNull()
  })

  it('submit: non_field_errors（本文または画像が必要等）はerrorMessageに表示される', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { non_field_errors: ['本文または画像のいずれかを入力してください。'] },
      },
    })

    const { submit, fieldErrors, errorMessage } = usePostCreate()
    const result = await submit()

    expect(result).toBeNull()
    expect(fieldErrors.value).toEqual({})
    expect(errorMessage.value).toBe('本文または画像のいずれかを入力してください。')
  })

  it('submit中はsubmittingがtrueになる', async () => {
    let resolvePost: (value: unknown) => void = () => {}
    vi.mocked(apiClient.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve
        }),
    )

    const { submit, submitting } = usePostCreate()
    const promise = submit()

    expect(submitting.value).toBe(true)
    resolvePost({ data: { id: 1 } })
    await promise

    expect(submitting.value).toBe(false)
  })

  describe('addImage', () => {
    it('画像を追加するとimagesとimagePreviewsが増える', () => {
      const { images, imagePreviews, addImage } = usePostCreate()

      const error = addImage(makeFile())

      expect(error).toBeNull()
      expect(images.value).toHaveLength(1)
      expect(imagePreviews.value).toHaveLength(1)
    })

    it('5枚目を追加しようとするとエラーを返し追加されない', () => {
      const { images, addImage } = usePostCreate()
      for (let i = 0; i < 4; i++) addImage(makeFile(`${i}.jpg`))

      const error = addImage(makeFile('5.jpg'))

      expect(error).toBe('画像は4枚まで添付できます。')
      expect(images.value).toHaveLength(4)
    })

    it('jpg/png以外の形式はエラーを返し追加されない', () => {
      const { images, addImage } = usePostCreate()

      const error = addImage(makeFile('a.gif', 'image/gif'))

      expect(error).toBe('画像はjpgまたはpng形式のみ添付できます。')
      expect(images.value).toHaveLength(0)
    })

    it('5MBを超える画像はエラーを返し追加されない', () => {
      const { images, addImage } = usePostCreate()

      const error = addImage(makeFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1))

      expect(error).toBe('画像は1枚あたり5MBまでです。')
      expect(images.value).toHaveLength(0)
    })
  })

  describe('removeImage', () => {
    it('画像を削除するとimagesとimagePreviewsから取り除かれ、プレビューURLを解放する', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
      const { images, imagePreviews, addImage, removeImage } = usePostCreate()
      addImage(makeFile())

      removeImage(0)

      expect(images.value).toHaveLength(0)
      expect(imagePreviews.value).toHaveLength(0)
      expect(revokeSpy).toHaveBeenCalled()
    })
  })
})
