import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import RequestComposeForm from './RequestComposeForm.vue'

// PostCard（参考投稿プレビューで使う）がuseRouter/useAuthStoreに依存するため、
// ProfileView.test.tsと同様にrouter・piniaをglobal pluginsとして渡す
vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
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

  it('参考投稿ID入力でupdate:relatedPostIdをemitする', async () => {
    const { emitted } = renderForm()

    await fireEvent.update(screen.getByTestId('request-related-post-id'), '42')

    expect(emitted()['update:relatedPostId']).toEqual([['42']])
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

  it('参考投稿IDを入力してフォーカスを外すと、見つかった投稿をプレビュー表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        id: 42,
        author: { id: 2, username: 'jiro', display_name: '次郎', avatar_url: null },
        body: '参考にしてほしい投稿',
        images: [],
        image_ids: [],
        like_count: 0,
        want_count: 0,
        comment_count: 0,
        liked_by_me: false,
        wanted_by_me: false,
        created_at: '2026-08-24T00:00:00Z',
        updated_at: '2026-08-24T00:00:00Z',
      },
    })
    renderForm({ relatedPostId: '42' })

    await fireEvent.blur(screen.getByTestId('request-related-post-id'))

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts/42')
      expect(screen.getByText('参考にしてほしい投稿')).toBeInTheDocument()
    })
  })

  it('参考投稿IDに該当する投稿が見つからない場合はエラーメッセージを表示する', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('not found'))
    renderForm({ relatedPostId: '999' })

    await fireEvent.blur(screen.getByTestId('request-related-post-id'))

    await waitFor(() => {
      expect(screen.getByTestId('request-related-post-preview-error')).toHaveTextContent(
        '投稿が見つかりません。',
      )
    })
  })
})
