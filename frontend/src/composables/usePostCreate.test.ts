import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { usePostCreate } from './usePostCreate'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset()
})

describe('usePostCreate', () => {
  it('submit: 成功したら作成された投稿を返す', async () => {
    const created = { id: 1, body: 'はじめての投稿' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: created })

    const { body, submit } = usePostCreate()
    body.value = 'はじめての投稿'
    const result = await submit()

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts', { body: 'はじめての投稿' })
    expect(result).toEqual(created)
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
})
