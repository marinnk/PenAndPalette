import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import CommentListItem from './CommentListItem.vue'
import type { Comment } from '@/types/comment'

const ProfileStub = { template: '<div>profile</div>' }

// jsdomはURL.createObjectURL/revokeObjectURLを実装していないため、画像プレビューの
// テストが動くように最小限のスタブを用意する
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()

const comment: Comment = {
  id: 1,
  author: { id: 7, username: 'author', display_name: 'コメント太郎', avatar_url: null },
  content: 'コメント本文です',
  image_url: null,
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
}

// currentUserIdは既定でcomment.authorとは別人（=自分のコメントではない）。編集・削除ボタンの
// 表示条件を検証するテストでは、7（=comment.author.id）を明示的に渡す
function renderItem(props: Record<string, unknown> = {}, currentUserId = 999) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: currentUserId, username: 'viewer', display_name: '閲覧者', avatar_url: null }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/profile/:id', name: 'profile', component: ProfileStub }],
  })
  return render(CommentListItem, {
    props: { comment, updateComment: vi.fn().mockResolvedValue(comment), ...props },
    global: { plugins: [pinia, router] },
  })
}

describe('CommentListItem', () => {
  it('本文とコメント者名を表示する', () => {
    renderItem()

    expect(screen.getByText('コメント本文です')).toBeInTheDocument()
    expect(screen.getByText('コメント太郎')).toBeInTheDocument()
  })

  it('画像があれば表示する', () => {
    renderItem({ comment: { ...comment, image_url: 'https://example.com/c.jpg' } })

    expect(screen.getByAltText('コメント画像')).toBeInTheDocument()
  })

  it('自分以外のコメントには編集・削除ボタンを表示しない', () => {
    renderItem()

    expect(screen.queryByTestId('comment-edit-button-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('comment-delete-button-1')).not.toBeInTheDocument()
  })

  it('自分のコメントには編集・削除ボタンを表示する', () => {
    renderItem({}, 7)

    expect(screen.getByTestId('comment-edit-button-1')).toBeInTheDocument()
    expect(screen.getByTestId('comment-delete-button-1')).toBeInTheDocument()
  })

  it('編集ボタンを押すとその場で編集フォームに切り替わる', async () => {
    renderItem({}, 7)

    await fireEvent.click(screen.getByTestId('comment-edit-button-1'))

    expect(screen.getByTestId('comment-edit-content-1')).toBeInTheDocument()
    expect(screen.getByTestId('comment-edit-save-1')).toBeInTheDocument()
  })

  it('編集して保存に成功すると更新内容でupdateCommentを呼び表示モードに戻る', async () => {
    const updateComment = vi.fn().mockResolvedValue({ ...comment, content: '更新後の本文' })
    renderItem({ updateComment }, 7)

    await fireEvent.click(screen.getByTestId('comment-edit-button-1'))
    await fireEvent.update(screen.getByTestId('comment-edit-content-1'), '更新後の本文')
    await fireEvent.click(screen.getByTestId('comment-edit-save-1'))

    expect(updateComment).toHaveBeenCalledWith({
      content: '更新後の本文',
      image: undefined,
      removeImage: false,
    })
    await vi.waitFor(() => {
      expect(screen.queryByTestId('comment-edit-content-1')).not.toBeInTheDocument()
    })
  })

  it('保存に失敗した場合は編集フォームを開いたままエラーを表示する（入力内容を破棄しない）', async () => {
    const updateComment = vi.fn().mockResolvedValue(null)
    renderItem({ updateComment }, 7)

    await fireEvent.click(screen.getByTestId('comment-edit-button-1'))
    await fireEvent.update(screen.getByTestId('comment-edit-content-1'), '保存できない本文')
    await fireEvent.click(screen.getByTestId('comment-edit-save-1'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('comment-edit-error-1')).toBeInTheDocument()
    })
    // 編集フォームは開いたまま、入力した内容も残っている
    expect(screen.getByTestId('comment-edit-content-1')).toHaveValue('保存できない本文')
  })

  it('キャンセルを押すと編集を破棄し表示モードに戻る', async () => {
    renderItem({}, 7)

    await fireEvent.click(screen.getByTestId('comment-edit-button-1'))
    await fireEvent.click(screen.getByTestId('comment-edit-cancel-1'))

    expect(screen.queryByTestId('comment-edit-content-1')).not.toBeInTheDocument()
    expect(screen.getByText('コメント本文です')).toBeInTheDocument()
  })

  it('画像を選んでからキャンセルすると、選んだ画像のプレビューURLを解放する', async () => {
    renderItem({}, 7)
    await fireEvent.click(screen.getByTestId('comment-edit-button-1'))

    const file = new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' })
    await fireEvent.change(screen.getByTestId('comment-edit-image-input-1'), {
      target: { files: [file] },
    })
    expect(screen.getByAltText('新しい画像のプレビュー')).toBeInTheDocument()

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    await fireEvent.click(screen.getByTestId('comment-edit-cancel-1'))

    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url')
    revokeSpy.mockRestore()
  })

  it('削除ボタンは確認ダイアログでOKした場合のみdeleteをemitする', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { emitted } = renderItem({}, 7)

    await fireEvent.click(screen.getByTestId('comment-delete-button-1'))
    expect(emitted().delete).toBeUndefined()

    confirmSpy.mockReturnValue(true)
    await fireEvent.click(screen.getByTestId('comment-delete-button-1'))
    expect(emitted().delete).toHaveLength(1)

    confirmSpy.mockRestore()
  })
})
