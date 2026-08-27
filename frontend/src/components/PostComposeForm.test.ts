import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import PostComposeForm from './PostComposeForm.vue'

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'create' as const,
    postType: 'illustration' as const,
    title: '',
    body: '',
    imagePreviews: [],
    canAddMore: true,
    tags: [
      { id: 1, name: 'オリジナル' },
      { id: 2, name: '二次創作' },
    ],
    selectedTagIds: [],
    submitDisabled: false,
    submitting: false,
    errorMessage: null,
    fieldErrors: {},
    imagePickError: null,
    ...overrides,
  }
}

describe('PostComposeForm', () => {
  it('mode=createでは「投稿する」の見出し・送信ボタン文言になる', () => {
    render(PostComposeForm, { props: baseProps() })

    expect(screen.getByRole('heading', { name: '投稿する' })).toBeInTheDocument()
    expect(screen.getByTestId('post-compose-submit')).toHaveTextContent('投稿する')
  })

  it('mode=editでは「投稿を編集」「保存する」の見出し・送信ボタン文言になる（画面設計書169行目）', () => {
    render(PostComposeForm, { props: baseProps({ mode: 'edit' }) })

    expect(screen.getByRole('heading', { name: '投稿を編集' })).toBeInTheDocument()
    expect(screen.getByTestId('post-compose-submit')).toHaveTextContent('保存する')
  })

  it('本文入力でupdate:bodyをemitする', async () => {
    const { emitted } = render(PostComposeForm, { props: baseProps() })

    await fireEvent.update(screen.getByTestId('post-body'), 'こんにちは')

    expect(emitted()['update:body']).toEqual([['こんにちは']])
  })

  it('送信ボタンクリックでsubmitをemitする', async () => {
    const { emitted } = render(PostComposeForm, { props: baseProps() })

    await fireEvent.click(screen.getByTestId('post-compose-submit'))

    expect(emitted().submit).toHaveLength(1)
  })

  it('キャンセルボタンクリックでcancelをemitする', async () => {
    const { emitted } = render(PostComposeForm, { props: baseProps() })

    await fireEvent.click(screen.getByTestId('post-compose-cancel'))

    expect(emitted().cancel).toHaveLength(1)
  })

  it('submitDisabled=trueの場合は送信ボタンがdisabledになる', () => {
    render(PostComposeForm, { props: baseProps({ submitDisabled: true }) })

    expect(screen.getByTestId('post-compose-submit')).toBeDisabled()
  })

  it('imagePreviewsの各画像に削除ボタンを表示し、クリックでインデックス付きremove-imageをemitする', async () => {
    const { emitted } = render(PostComposeForm, {
      props: baseProps({
        imagePreviews: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      }),
    })

    expect(screen.getAllByRole('img')).toHaveLength(2)
    await fireEvent.click(screen.getByTestId('post-image-remove-1'))

    expect(emitted()['remove-image']).toEqual([[1]])
  })

  it('canAddMore=falseの場合は追加枠を表示しない', () => {
    render(PostComposeForm, { props: baseProps({ canAddMore: false }) })

    expect(screen.queryByTestId('post-image-add')).not.toBeInTheDocument()
  })

  it('errorMessageを表示する', () => {
    render(PostComposeForm, { props: baseProps({ errorMessage: '更新に失敗しました。' }) })

    expect(screen.getByTestId('post-compose-error')).toHaveTextContent('更新に失敗しました。')
  })

  it('fieldErrors.bodyを表示する', () => {
    render(PostComposeForm, {
      props: baseProps({ fieldErrors: { body: ['この項目は必須です。'] } }),
    })

    expect(screen.getByTestId('post-body-error')).toHaveTextContent('この項目は必須です。')
  })

  it('fieldErrors.keep_image_idsを画像欄のエラーとして表示する（編集画面専用の項目）', () => {
    render(PostComposeForm, {
      props: baseProps({
        mode: 'edit',
        fieldErrors: { keep_image_ids: ['指定された画像がこの投稿に存在しません。'] },
      }),
    })

    expect(screen.getByTestId('post-image-error')).toHaveTextContent(
      '指定された画像がこの投稿に存在しません。',
    )
  })

  it('mode=editでは種別切替ボタンを表示しない（画面設計書169行目）', () => {
    render(PostComposeForm, { props: baseProps({ mode: 'edit' }) })

    expect(screen.queryByTestId('post-type-illustration')).not.toBeInTheDocument()
    expect(screen.queryByTestId('post-type-novel')).not.toBeInTheDocument()
  })

  it('未入力の状態で種別切替ボタンを押すと確認なしでupdate:postTypeをemitする', async () => {
    const { emitted } = render(PostComposeForm, { props: baseProps() })

    await fireEvent.click(screen.getByTestId('post-type-novel'))

    expect(emitted()['update:postType']).toEqual([['novel']])
  })

  it('入力済みの状態で種別切替ボタンを押すと確認ダイアログを出し、OKならupdate:postTypeをemitする', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { emitted } = render(PostComposeForm, { props: baseProps({ body: '入力中の本文' }) })

    await fireEvent.click(screen.getByTestId('post-type-novel'))

    expect(confirmSpy).toHaveBeenCalledWith('入力した内容は失われます。切り替えますか？')
    expect(emitted()['update:postType']).toEqual([['novel']])
    confirmSpy.mockRestore()
  })

  it('入力済みの状態で確認ダイアログをキャンセルするとupdate:postTypeをemitしない', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { emitted } = render(PostComposeForm, { props: baseProps({ body: '入力中の本文' }) })

    await fireEvent.click(screen.getByTestId('post-type-novel'))

    expect(emitted()['update:postType']).toBeUndefined()
    confirmSpy.mockRestore()
  })

  it('postType=novelの場合のみタイトル欄を表示する', async () => {
    const { rerender } = render(PostComposeForm, { props: baseProps() })
    expect(screen.queryByTestId('post-title')).not.toBeInTheDocument()

    await rerender(baseProps({ postType: 'novel' }))
    expect(screen.getByTestId('post-title')).toBeInTheDocument()
  })

  it('postType=novelでは本文の上限が4000文字になる', () => {
    render(PostComposeForm, { props: baseProps({ postType: 'novel' }) })

    expect(screen.getByTestId('post-body')).toHaveAttribute('maxlength', '4000')
    expect(screen.getByTestId('post-body-counter')).toHaveTextContent('0/4000')
  })

  it('タグを選択するとupdate:tag-idsをemitする', async () => {
    const { emitted } = render(PostComposeForm, { props: baseProps() })

    await fireEvent.click(screen.getByTestId('post-tag-1'))

    expect(emitted()['update:tag-ids']).toEqual([[[1]]])
  })

  it('既に5個選択済みの場合、未選択のタグはdisabledになる（最大5個・docs/features/tag.md）', () => {
    render(PostComposeForm, {
      props: baseProps({
        tags: [
          { id: 1, name: 'a' },
          { id: 2, name: 'b' },
          { id: 3, name: 'c' },
          { id: 4, name: 'd' },
          { id: 5, name: 'e' },
          { id: 6, name: 'f' },
        ],
        selectedTagIds: [1, 2, 3, 4, 5],
      }),
    })

    expect(screen.getByTestId('post-tag-6')).toBeDisabled()
    expect(screen.getByTestId('post-tag-1')).not.toBeDisabled()
  })

  it('fieldErrors.tag_idsを表示する', () => {
    render(PostComposeForm, {
      props: baseProps({ fieldErrors: { tag_ids: ['タグは5個まで選択できます。'] } }),
    })

    expect(screen.getByTestId('post-tag-error')).toHaveTextContent('タグは5個まで選択できます。')
  })
})
