import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import PostCreateView from './PostCreateView.vue'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

// jsdomはURL.createObjectURL/revokeObjectURLを実装していないため最小限のスタブを用意する
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()

const TimelineStub = { template: '<div>timeline</div>' }

function renderPostCreateView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/new', name: 'post-create', component: PostCreateView },
    ],
  })
  router.push({ name: 'post-create' })
  const result = render(PostCreateView, { global: { plugins: [router] } })
  return { ...result, router }
}

function makeFile(name = 'a.jpg', type = 'image/jpeg', size = 1024) {
  return new File([new Uint8Array(size)], name, { type })
}

async function selectImage(file: File) {
  const input = screen.getByTestId('post-image-input')
  await fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset()
})

describe('PostCreateView', () => {
  it('文字数カウンターが入力に応じて更新される', async () => {
    renderPostCreateView()

    await fireEvent.update(screen.getByTestId('post-body'), 'こんにちは')

    expect(screen.getByTestId('post-body-counter')).toHaveTextContent('5/280')
  })

  it('投稿成功時にタイムラインへ遷移する', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 1, body: 'テスト' } })
    const { router } = renderPostCreateView()
    await router.isReady()

    await fireEvent.update(screen.getByTestId('post-body'), 'テスト')
    await selectImage(makeFile())
    await fireEvent.click(screen.getByTestId('post-compose-submit'))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/posts', expect.any(FormData))
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })

  it('画像が無いときは投稿ボタンがdisabledになる（イラスト投稿は画像必須）', () => {
    renderPostCreateView()

    expect(screen.getByTestId('post-compose-submit')).toBeDisabled()
  })

  it('本文を入力しても画像が無ければ投稿ボタンはdisabledのまま', async () => {
    renderPostCreateView()

    await fireEvent.update(screen.getByTestId('post-body'), 'テスト')

    expect(screen.getByTestId('post-compose-submit')).toBeDisabled()
  })

  it('小説を選ぶとタイトル欄が現れ、タイトル・本文の両方を入力するまで投稿ボタンはdisabledのまま', async () => {
    renderPostCreateView()

    await fireEvent.click(screen.getByTestId('post-type-novel'))
    expect(screen.getByTestId('post-compose-submit')).toBeDisabled()

    await fireEvent.update(screen.getByTestId('post-title'), 'タイトル')
    expect(screen.getByTestId('post-compose-submit')).toBeDisabled()

    await fireEvent.update(screen.getByTestId('post-body'), '本文')
    expect(screen.getByTestId('post-compose-submit')).not.toBeDisabled()
  })

  it('post_type・titleを含めて送信する', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 1 } })
    renderPostCreateView()

    await fireEvent.click(screen.getByTestId('post-type-novel'))
    await fireEvent.update(screen.getByTestId('post-title'), 'タイトル')
    await fireEvent.update(screen.getByTestId('post-body'), '本文')
    await fireEvent.click(screen.getByTestId('post-compose-submit'))

    await waitFor(() => {
      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('post_type')).toBe('novel')
      expect(formData.get('title')).toBe('タイトル')
    })
  })

  it('キャンセルでタイムラインへ戻る', async () => {
    const { router } = renderPostCreateView()
    await router.isReady()

    await fireEvent.click(screen.getByTestId('post-compose-cancel'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })

  it('画像を選ぶとプレビューが表示され、削除ボタンで取り消せる', async () => {
    renderPostCreateView()

    await selectImage(makeFile())

    expect(screen.getByTestId('post-image-remove-0')).toBeInTheDocument()

    await fireEvent.click(screen.getByTestId('post-image-remove-0'))

    expect(screen.queryByTestId('post-image-remove-0')).not.toBeInTheDocument()
  })

  it('本文が空でも画像があれば投稿ボタンが有効になる', async () => {
    renderPostCreateView()

    await selectImage(makeFile())

    expect(screen.getByTestId('post-compose-submit')).not.toBeDisabled()
  })

  it('4枚選択すると追加枠が消える', async () => {
    renderPostCreateView()

    for (let i = 0; i < 4; i++) {
      await selectImage(makeFile(`${i}.jpg`))
    }

    expect(screen.queryByTestId('post-image-add')).not.toBeInTheDocument()
  })

  it('jpg/png以外の画像を選ぶとピックエラーが表示され送信されない', async () => {
    renderPostCreateView()

    await selectImage(makeFile('a.gif', 'image/gif'))

    expect(screen.getByTestId('post-image-pick-error')).toHaveTextContent(
      '画像はjpgまたはpng形式のみ添付できます。',
    )
    expect(screen.queryByTestId('post-image-remove-0')).not.toBeInTheDocument()
  })
})
