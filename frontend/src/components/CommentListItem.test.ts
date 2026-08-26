import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import CommentListItem from './CommentListItem.vue'
import type { Comment } from '@/types/comment'

const ProfileStub = { template: '<div>profile</div>' }

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
    props: { comment, ...props },
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

  it('編集して保存すると更新内容でupdateをemitし表示モードに戻る', async () => {
    const { emitted } = renderItem({}, 7)

    await fireEvent.click(screen.getByTestId('comment-edit-button-1'))
    await fireEvent.update(screen.getByTestId('comment-edit-content-1'), '更新後の本文')
    await fireEvent.click(screen.getByTestId('comment-edit-save-1'))

    expect(emitted().update).toEqual([[{ content: '更新後の本文', image: undefined, removeImage: false }]])
    expect(screen.queryByTestId('comment-edit-content-1')).not.toBeInTheDocument()
  })

  it('キャンセルを押すと編集を破棄し表示モードに戻る', async () => {
    renderItem({}, 7)

    await fireEvent.click(screen.getByTestId('comment-edit-button-1'))
    await fireEvent.click(screen.getByTestId('comment-edit-cancel-1'))

    expect(screen.queryByTestId('comment-edit-content-1')).not.toBeInTheDocument()
    expect(screen.getByText('コメント本文です')).toBeInTheDocument()
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
