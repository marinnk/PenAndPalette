import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import RequestComposeForm from './RequestComposeForm.vue'

// 選択済み投稿のプレビューでPostCard.vueを使うため、useAuthStore/useRouterのpluginsが必要
function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    toDisplayName: 'ユーザーB',
    message: '',
    submitting: false,
    errorMessage: null,
    fieldErrors: {},
    selectedPost: null,
    pickerOpen: false,
    pickerTab: 'own' as const,
    pickerLoading: false,
    pickerError: null,
    pickerPosts: [],
    ...overrides,
  }
}

function renderForm(overrides: Record<string, unknown> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: 1, username: 'taro', display_name: 'ユーザーA', avatar_url: null }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: { template: '<div />' } },
      { path: '/profile/:id', name: 'profile', component: { template: '<div />' } },
    ],
  })
  return render(RequestComposeForm, {
    props: baseProps(overrides),
    global: { plugins: [pinia, router] },
  })
}

function makePost(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    author: { id: 2, username: 'jiro', display_name: '次郎', avatar_url: null },
    body: `投稿${id}`,
    images: [],
    image_ids: [],
    like_count: 0,
    want_count: 0,
    comment_count: 0,
    liked_by_me: false,
    wanted_by_me: false,
    created_at: '2026-08-24T00:00:00Z',
    updated_at: '2026-08-24T00:00:00Z',
    ...overrides,
  }
}

describe('RequestComposeForm', () => {
  it('宛先の表示名を見出しに表示する', () => {
    renderForm()

    expect(
      screen.getByRole('heading', { name: 'ユーザーB さんにリクエストする' }),
    ).toBeInTheDocument()
  })

  it('メッセージ入力でupdate:messageをemitする', async () => {
    const { emitted } = renderForm()

    await fireEvent.update(screen.getByTestId('request-message'), 'こんにちは')

    expect(emitted()['update:message']).toEqual([['こんにちは']])
  })

  it('送信ボタンクリックでsubmitをemitする', async () => {
    const { emitted } = renderForm({ message: 'こんにちは' })

    await fireEvent.click(screen.getByTestId('request-compose-submit'))

    expect(emitted().submit).toHaveLength(1)
  })

  it('キャンセルボタンクリックでcancelをemitする', async () => {
    const { emitted } = renderForm()

    await fireEvent.click(screen.getByTestId('request-compose-cancel'))

    expect(emitted().cancel).toHaveLength(1)
  })

  it('メッセージが空の場合は送信ボタンがdisabledになる', () => {
    renderForm({ message: '' })

    expect(screen.getByTestId('request-compose-submit')).toBeDisabled()
  })

  it('errorMessageを表示する', () => {
    renderForm({ errorMessage: '送信に失敗しました。' })

    expect(screen.getByTestId('request-compose-error')).toHaveTextContent('送信に失敗しました。')
  })

  it('fieldErrors.messageを表示する', () => {
    renderForm({ fieldErrors: { message: ['この項目は必須です。'] } })

    expect(screen.getByTestId('request-message-error')).toHaveTextContent('この項目は必須です。')
  })

  it('selectedPostが無い場合は「投稿を選ぶ」ボタンを表示する', () => {
    renderForm({ selectedPost: null })

    expect(screen.getByTestId('request-related-post-picker-toggle')).toBeInTheDocument()
  })

  it('「投稿を選ぶ」を押すとopen-pickerをemitする', async () => {
    const { emitted } = renderForm()

    await fireEvent.click(screen.getByTestId('request-related-post-picker-toggle'))

    expect(emitted()['open-picker']).toHaveLength(1)
  })

  it('pickerOpen=trueのときタブと一覧を表示する', () => {
    renderForm({
      pickerOpen: true,
      pickerPosts: [makePost(10)],
    })

    expect(screen.getByTestId('request-related-post-tab-own')).toBeInTheDocument()
    expect(screen.getByTestId('request-related-post-tab-target')).toBeInTheDocument()
    expect(screen.getByTestId('request-related-post-option-10')).toHaveTextContent('投稿10')
  })

  it('タブクリックでswitch-tabをemitする', async () => {
    const { emitted } = renderForm({ pickerOpen: true })

    await fireEvent.click(screen.getByTestId('request-related-post-tab-target'))

    expect(emitted()['switch-tab']).toEqual([['target']])
  })

  it('一覧から投稿を選ぶとselect-postをemitする', async () => {
    const post = makePost(10)
    const { emitted } = renderForm({ pickerOpen: true, pickerPosts: [post] })

    await fireEvent.click(screen.getByTestId('request-related-post-option-10'))

    expect(emitted()['select-post']).toEqual([[post]])
  })

  it('pickerLoading=trueのとき読み込み中を表示する', () => {
    renderForm({ pickerOpen: true, pickerLoading: true })

    expect(screen.getByTestId('request-related-post-picker-loading')).toBeInTheDocument()
  })

  it('pickerError指定時はエラーメッセージを表示する', () => {
    renderForm({ pickerOpen: true, pickerError: '投稿一覧の取得に失敗しました。' })

    expect(screen.getByText('投稿一覧の取得に失敗しました。')).toBeInTheDocument()
  })

  it('pickerPostsが空の場合は空状態を表示する', () => {
    renderForm({ pickerOpen: true, pickerPosts: [] })

    expect(screen.getByTestId('request-related-post-picker-empty')).toBeInTheDocument()
  })

  it('閉じるボタンでclose-pickerをemitする', async () => {
    const { emitted } = renderForm({ pickerOpen: true })

    await fireEvent.click(screen.getByTestId('request-related-post-picker-close'))

    expect(emitted()['close-picker']).toHaveLength(1)
  })

  it('selectedPostがある場合はプレビューを表示し、「投稿を選ぶ」ボタンは表示しない', () => {
    renderForm({ selectedPost: makePost(10, { body: '参考にしてほしい投稿' }) })

    expect(screen.getByText('参考にしてほしい投稿')).toBeInTheDocument()
    expect(screen.queryByTestId('request-related-post-picker-toggle')).not.toBeInTheDocument()
  })

  it('選択を解除するとclear-selectionをemitする', async () => {
    const { emitted } = renderForm({ selectedPost: makePost(10) })

    await fireEvent.click(screen.getByTestId('request-related-post-clear'))

    expect(emitted()['clear-selection']).toHaveLength(1)
  })

  it('選択済み投稿のプレビューは編集・削除・いいね等のアクションを表示しない', () => {
    // selectedPost.author.id=2、ログイン中利用者id=1なので自分の投稿ではないが、
    // preview propによりそもそもアクション自体を表示しないことを確認する
    renderForm({ selectedPost: makePost(10) })

    expect(screen.queryByTestId('like-button-10')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-button-10')).not.toBeInTheDocument()
  })

  it('fieldErrors.related_post_idを表示する', () => {
    renderForm({ fieldErrors: { related_post_id: ['指定された投稿が見つかりません。'] } })

    expect(screen.getByTestId('request-related-post-id-error')).toHaveTextContent(
      '指定された投稿が見つかりません。',
    )
  })
})
