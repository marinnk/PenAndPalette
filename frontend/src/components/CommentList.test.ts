import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import CommentList from './CommentList.vue'
import type { Comment } from '@/types/comment'

const ProfileStub = { template: '<div>profile</div>' }

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    author: { id: 7, username: 'author', display_name: '太郎', avatar_url: null },
    content: '本文',
    image_url: null,
    created_at: '2026-08-20T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
    ...overrides,
  }
}

function renderList(props: Record<string, unknown> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = { id: 999, username: 'viewer', display_name: '閲覧者', avatar_url: null }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/profile/:id', name: 'profile', component: ProfileStub }],
  })
  return render(CommentList, {
    props: { comments: [], isPending: () => false, ...props },
    global: { plugins: [pinia, router] },
  })
}

describe('CommentList', () => {
  it('件数見出しを表示する', () => {
    renderList({ comments: [makeComment({ id: 1 }), makeComment({ id: 2 })] })

    expect(screen.getByText('コメント（2件）')).toBeInTheDocument()
  })

  it('コメントが無い場合は空状態のメッセージを表示する', () => {
    renderList({ comments: [] })

    expect(screen.getByText('コメント（0件）')).toBeInTheDocument()
    expect(screen.getByTestId('comment-list-empty')).toBeInTheDocument()
  })

  it('渡された順（古い順）でコメントを表示する', () => {
    renderList({
      comments: [
        makeComment({ id: 1, content: '1件目' }),
        makeComment({ id: 2, content: '2件目' }),
      ],
    })

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('1件目')
    expect(items[1]).toHaveTextContent('2件目')
  })

  it('子コンポーネントのupdate/deleteをコメントidとともに中継する', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    // author.id=999はrenderListが設定するcurrentUser.idと一致させ、自分のコメントとして
    // 削除ボタンを表示させる
    const { emitted } = renderList({
      comments: [makeComment({ id: 5, author: { id: 999, username: 'viewer', display_name: '閲覧者', avatar_url: null } })],
    })

    await fireEvent.click(screen.getByTestId('comment-delete-button-5'))

    expect(emitted().delete).toEqual([[5]])
    vi.restoreAllMocks()
  })
})
