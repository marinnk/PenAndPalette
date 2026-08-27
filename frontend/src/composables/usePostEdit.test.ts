import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { usePostEdit } from './usePostEdit'
import type { Post } from '@/types/post'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

function makeFile(name = 'a.jpg', type = 'image/jpeg', size = 1024) {
  return new File([new Uint8Array(size)], name, { type })
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    author: { id: 1, username: 'author', display_name: '投稿者', avatar_url: null },
    body: '編集前の本文',
    images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
    image_ids: [10, 11],
    post_type: 'illustration',
    title: '',
    tags: [],
    like_count: 0,
    want_count: 0,
    comment_count: 0,
    liked_by_me: false,
    wanted_by_me: false,
    created_at: '2026-08-23T00:00:00Z',
    updated_at: '2026-08-23T00:00:00Z',
    ...overrides,
  }
}

URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

describe('usePostEdit', () => {
  it('load: 既存の本文・画像id・画像URLで初期化する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })

    const { load, body, keepImageIds, keepImagePreviews, loading, loadError } = usePostEdit()
    await load(1)

    expect(apiClient.get).toHaveBeenCalledWith('/api/posts/1')
    expect(body.value).toBe('編集前の本文')
    expect(keepImageIds.value).toEqual([10, 11])
    expect(keepImagePreviews.value).toEqual([
      'https://example.com/1.jpg',
      'https://example.com/2.jpg',
    ])
    expect(loading.value).toBe(false)
    expect(loadError.value).toBe(false)
  })

  it('load: 失敗したらloadErrorがtrueになる', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('not found'))

    const { load, loadError } = usePostEdit()
    await load(1)

    expect(loadError.value).toBe(true)
  })

  it('load: 別のidで再度呼ぶと、その投稿の内容に更新される（コンポーネント再利用を想定）', async () => {
    // usePostEdit()は1回だけ呼び出し、同じインスタンスに対してload(1)→load(2)する。
    // これはVue Routerが/posts/1/edit→/posts/2/editでコンポーネントを再利用する状況の再現
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost({ id: 1, body: '投稿1' }) })
    const { load, body } = usePostEdit()
    await load(1)
    expect(body.value).toBe('投稿1')

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost({ id: 2, body: '投稿2' }) })
    await load(2)

    expect(apiClient.get).toHaveBeenLastCalledWith('/api/posts/2')
    expect(body.value).toBe('投稿2')
  })

  it('load: 別のidを読み込むと、前の投稿で選択していた未送信の新規画像はクリアされる', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost({ id: 1 }) })
    const { load, images, imagePreviews, addImage } = usePostEdit()
    await load(1)
    addImage(makeFile())
    expect(images.value).toHaveLength(1)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost({ id: 2 }) })
    await load(2)

    expect(images.value).toHaveLength(0)
    expect(imagePreviews.value).toHaveLength(0)
  })

  it('removeExistingImage: 指定したインデックスの既存画像を取り除く', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    const { load, keepImageIds, keepImagePreviews, removeExistingImage } = usePostEdit()
    await load(1)

    removeExistingImage(0)

    expect(keepImageIds.value).toEqual([11])
    expect(keepImagePreviews.value).toEqual(['https://example.com/2.jpg'])
  })

  it('addImage/removeNewImage: 新規画像を追加・削除できる', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    const { load, images, imagePreviews, addImage, removeNewImage } = usePostEdit()
    await load(1)

    const error = addImage(makeFile())
    expect(error).toBeNull()
    expect(images.value).toHaveLength(1)
    expect(imagePreviews.value).toHaveLength(1)

    removeNewImage(0)
    expect(images.value).toHaveLength(0)
    expect(imagePreviews.value).toHaveLength(0)
  })

  it('addImage: 既存＋新規の合計で4枚を超えるとエラーを返す', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    const { load, addImage } = usePostEdit()
    await load(1) // 既存2枚

    addImage(makeFile('a.jpg'))
    addImage(makeFile('b.jpg'))
    const error = addImage(makeFile('c.jpg')) // 2(既存) + 2(新規) + 1 = 5枚目

    expect(error).toBe('画像は4枚まで添付できます。')
  })

  it('submit: bodyとkeep_image_ids・新規imagesをFormDataで送信する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: makePost({ body: '更新後' }) })
    const { load, body, removeExistingImage, addImage, submit } = usePostEdit()
    await load(1)
    body.value = '更新後'
    removeExistingImage(0) // id=10を除外、残り[11]
    addImage(makeFile('new.jpg'))

    const result = await submit()

    expect(apiClient.put).toHaveBeenCalledWith('/api/posts/1', expect.any(FormData))
    const formData = vi.mocked(apiClient.put).mock.calls[0][1] as FormData
    expect(formData.get('body')).toBe('更新後')
    expect(formData.get('keep_image_ids')).toBe('11')
    expect(formData.getAll('images')).toHaveLength(1)
    expect(result?.body).toBe('更新後')
  })

  it('submit: loadより前に呼ばれた場合は何もせずnullを返す', async () => {
    const { submit } = usePostEdit()

    const result = await submit()

    expect(result).toBeNull()
    expect(apiClient.put).not.toHaveBeenCalled()
  })

  it('submit: 400バリデーションエラーはfieldErrorsに振り分けられる', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: makePost() })
    vi.mocked(apiClient.put).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { body: ['この項目は必須です。'] } },
    })
    const { load, submit, fieldErrors } = usePostEdit()
    await load(1)

    const result = await submit()

    expect(result).toBeNull()
    expect(fieldErrors.value.body).toEqual(['この項目は必須です。'])
  })
})
