import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useRequestCreate } from './useRequestCreate'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { post: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset()
})

describe('useRequestCreate', () => {
  it('submit: 成功したら作成されたリクエストを返す', async () => {
    const created = { id: 1, message: 'こんにちは' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: created })

    const { message, submit } = useRequestCreate(2)
    message.value = 'こんにちは'
    const result = await submit()

    expect(apiClient.post).toHaveBeenCalledWith('/api/users/2/requests', {
      message: 'こんにちは',
      related_post_id: null,
    })
    expect(result).toEqual(created)
  })

  it('submit: related_post_idを入力していれば数値として送信する', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 1 } })

    const { message, relatedPostId, submit } = useRequestCreate(2)
    message.value = 'この投稿の続きが読みたいです'
    relatedPostId.value = '42'
    await submit()

    expect(apiClient.post).toHaveBeenCalledWith('/api/users/2/requests', {
      message: 'この投稿の続きが読みたいです',
      related_post_id: 42,
    })
  })

  it('submit: 400バリデーションエラーはfieldErrorsに振り分けられる', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { message: ['この項目は必須です。'] } },
    })

    const { submit, fieldErrors, errorMessage } = useRequestCreate(2)
    const result = await submit()

    expect(result).toBeNull()
    expect(fieldErrors.value.message).toEqual(['この項目は必須です。'])
    expect(errorMessage.value).toBeNull()
  })

  it('submit: detail形式のエラーはerrorMessageに表示される', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { detail: '自分自身にリクエストを送ることはできません。' } },
    })

    const { submit, fieldErrors, errorMessage } = useRequestCreate(2)
    const result = await submit()

    expect(result).toBeNull()
    expect(fieldErrors.value).toEqual({})
    expect(errorMessage.value).toBe('自分自身にリクエストを送ることはできません。')
  })

  it('submit中はsubmittingがtrueになる', async () => {
    let resolvePost: (value: unknown) => void = () => {}
    vi.mocked(apiClient.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve
        }),
    )

    const { submit, submitting } = useRequestCreate(2)
    const promise = submit()

    expect(submitting.value).toBe(true)
    resolvePost({ data: { id: 1 } })
    await promise

    expect(submitting.value).toBe(false)
  })
})
