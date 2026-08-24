import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import PostComposeForm from './PostComposeForm.vue'

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'create' as const,
    body: '',
    imagePreviews: [],
    canAddMore: true,
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
})
