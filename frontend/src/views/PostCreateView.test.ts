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
    await fireEvent.click(screen.getByTestId('post-compose-submit'))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/posts', expect.any(FormData))
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })

  it('本文が空のときは投稿ボタンがdisabledになる', () => {
    renderPostCreateView()

    expect(screen.getByTestId('post-compose-submit')).toBeDisabled()
  })

  it('本文が空白のみのときも投稿ボタンがdisabledになる（バックエンドのtrim検証と一致させる）', async () => {
    renderPostCreateView()

    await fireEvent.update(screen.getByTestId('post-body'), '   ')

    expect(screen.getByTestId('post-compose-submit')).toBeDisabled()
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
