import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth'
import RequestComposeForm from './RequestComposeForm.vue'

// PostCard（選択した参考投稿のプレビューで使う）がuseRouter/useAuthStoreに依存し、
// このコンポーネント自体も参考投稿pickerのためにuseAuthStore・apiClientへ依存するため、
// ProfileView.test.tsと同様にrouter・piniaをglobal pluginsとして渡す
vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    toUserId: 2,
    toDisplayName: 'ユーザーB',
    message: '',
    relatedPostId: '',
    submitting: false,
    errorMessage: null,
    fieldErrors: {},
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

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

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

  it('「投稿を選ぶ」を押すと自分の投稿一覧（デフォルトタブ）が表示される', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(10)], has_more: false },
    })
    renderForm()

    await fireEvent.click(screen.getByTestId('request-related-post-picker-toggle'))

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts', { params: { user_id: 1 } })
      expect(screen.getByTestId('request-related-post-option-10')).toHaveTextContent('投稿10')
    })
  })

  it('「{相手}の投稿」タブに切り替えると相手の投稿一覧を取得する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { results: [], has_more: false } })
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(20)], has_more: false },
    })
    renderForm()
    await fireEvent.click(screen.getByTestId('request-related-post-picker-toggle'))
    await waitFor(() =>
      expect(screen.getByTestId('request-related-post-picker-empty')).toBeInTheDocument(),
    )

    await fireEvent.click(screen.getByTestId('request-related-post-tab-target'))

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts', { params: { user_id: 2 } })
      expect(screen.getByTestId('request-related-post-option-20')).toBeInTheDocument()
    })
  })

  it('一覧から投稿を選ぶとupdate:relatedPostIdをemitし、選択した投稿をプレビュー表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(10, { body: '参考にしてほしい投稿' })], has_more: false },
    })
    const { emitted } = renderForm()
    await fireEvent.click(screen.getByTestId('request-related-post-picker-toggle'))
    await waitFor(() =>
      expect(screen.getByTestId('request-related-post-option-10')).toBeInTheDocument(),
    )

    await fireEvent.click(screen.getByTestId('request-related-post-option-10'))

    expect(emitted()['update:relatedPostId']).toEqual([['10']])
    expect(screen.getByText('参考にしてほしい投稿')).toBeInTheDocument()
    expect(screen.queryByTestId('request-related-post-picker-toggle')).not.toBeInTheDocument()
  })

  it('選択を解除するとupdate:relatedPostIdに空文字をemitし、再度「投稿を選ぶ」を表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { results: [makePost(10)], has_more: false },
    })
    const { emitted } = renderForm()
    await fireEvent.click(screen.getByTestId('request-related-post-picker-toggle'))
    await waitFor(() =>
      expect(screen.getByTestId('request-related-post-option-10')).toBeInTheDocument(),
    )
    await fireEvent.click(screen.getByTestId('request-related-post-option-10'))

    await fireEvent.click(screen.getByTestId('request-related-post-clear'))

    expect(emitted()['update:relatedPostId'][1]).toEqual([''])
    expect(screen.getByTestId('request-related-post-picker-toggle')).toBeInTheDocument()
  })

  it('fieldErrors.related_post_idを表示する', () => {
    renderForm({ fieldErrors: { related_post_id: ['指定された投稿が見つかりません。'] } })

    expect(screen.getByTestId('request-related-post-id-error')).toHaveTextContent(
      '指定された投稿が見つかりません。',
    )
  })
})
