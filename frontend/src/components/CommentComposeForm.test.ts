import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import CommentComposeForm from './CommentComposeForm.vue'

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    content: '',
    imagePreview: null,
    submitting: false,
    errorMessage: null,
    fieldErrors: {},
    imagePickError: null,
    ...overrides,
  }
}

function renderForm(props: Record<string, unknown> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: 1, username: 'taro', display_name: '太郎', avatar_url: null }

  return render(CommentComposeForm, { props: baseProps(props), global: { plugins: [pinia] } })
}

describe('CommentComposeForm', () => {
  it('本文入力でupdate:contentをemitする', async () => {
    const { emitted } = renderForm()

    await fireEvent.update(screen.getByTestId('comment-body'), 'こんにちは')

    expect(emitted()['update:content']).toEqual([['こんにちは']])
  })

  it('文字数カウンターを表示する', () => {
    renderForm({ content: 'こんにちは' })

    expect(screen.getByTestId('comment-body-counter')).toHaveTextContent('5/280')
  })

  it('本文・画像のどちらも無い場合は送信ボタンがdisabledになる', () => {
    renderForm()

    expect(screen.getByTestId('comment-compose-submit')).toBeDisabled()
  })

  it('本文があれば送信ボタンが有効になる', () => {
    renderForm({ content: '本文' })

    expect(screen.getByTestId('comment-compose-submit')).not.toBeDisabled()
  })

  it('送信ボタンクリックでsubmitをemitする', async () => {
    const { emitted } = renderForm({ content: '本文' })

    await fireEvent.click(screen.getByTestId('comment-compose-submit'))

    expect(emitted().submit).toHaveLength(1)
  })

  it('画像を選択するとadd-imageをemitする', async () => {
    const { emitted } = renderForm()
    const file = new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' })

    await fireEvent.change(screen.getByTestId('comment-image-input'), { target: { files: [file] } })

    expect(emitted()['add-image']).toEqual([[file]])
  })

  it('画像プレビューがある場合は削除ボタンを表示し、クリックでremove-imageをemitする', async () => {
    const { emitted } = renderForm({ imagePreview: 'blob:mock' })

    expect(screen.getByAltText('添付画像のプレビュー')).toBeInTheDocument()
    await fireEvent.click(screen.getByTestId('comment-image-remove'))

    expect(emitted()['remove-image']).toHaveLength(1)
  })

  it('画像プレビューがある間は追加ボタンを表示しない', () => {
    renderForm({ imagePreview: 'blob:mock' })

    expect(screen.queryByTestId('comment-image-add')).not.toBeInTheDocument()
  })

  it('errorMessageを表示する', () => {
    renderForm({ errorMessage: '投稿に失敗しました。' })

    expect(screen.getByTestId('comment-compose-error')).toHaveTextContent('投稿に失敗しました。')
  })

  it('fieldErrors.contentを表示する', () => {
    renderForm({ fieldErrors: { content: ['この項目は280文字以内で入力してください。'] } })

    expect(screen.getByTestId('comment-body-error')).toHaveTextContent(
      'この項目は280文字以内で入力してください。',
    )
  })

  it('imagePickErrorを表示する', () => {
    renderForm({ imagePickError: '画像はjpgまたはpng形式のみ添付できます。' })

    expect(screen.getByTestId('comment-image-error')).toHaveTextContent(
      '画像はjpgまたはpng形式のみ添付できます。',
    )
  })
})
