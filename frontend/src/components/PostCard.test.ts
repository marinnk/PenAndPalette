import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PostCard from './PostCard.vue'
import type { Post } from '@/types/post'

const PostDetailStub = { template: '<div>post-detail</div>' }
const ProfileStub = { template: '<div>profile</div>' }
const TimelineStub = { template: '<div>timeline</div>' }
const PostEditStub = { template: '<div>post-edit</div>' }

const post: Post = {
  id: 42,
  author: { id: 7, username: 'author', display_name: '投稿者', avatar_url: null },
  body: '本文です',
  images: [],
  image_ids: [],
  post_type: 'illustration',
  title: '',
  tags: [],
  like_count: 3,
  want_count: 1,
  comment_count: 2,
  liked_by_me: false,
  wanted_by_me: true,
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
}

// currentUserIdは既定でpost.authorとは別人（=自分の投稿ではない）。編集・削除ボタンの
// 表示条件を検証するテストでは、7（=post.author.id）を明示的に渡す
function renderPostCard(props: Record<string, unknown> = {}, currentUserId = 999) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.currentUser = {
    id: currentUserId,
    username: 'viewer',
    display_name: '閲覧者',
    avatar_url: null,
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/:id/edit', name: 'post-edit', component: PostEditStub },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailStub },
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
    ],
  })
  const result = render(PostCard, {
    props: { post, ...props },
    global: { plugins: [pinia, router] },
  })
  return { ...result, router }
}

describe('PostCard', () => {
  it('本文・いいね数・かきたい数・コメント数を表示する', async () => {
    const { router } = renderPostCard()
    await router.isReady()

    expect(screen.getByText('本文です')).toBeInTheDocument()
    expect(screen.getByTestId('like-button-42')).toHaveTextContent('いいね 3')
    expect(screen.getByTestId('want-button-42')).toHaveTextContent('かきたい 1')
    expect(screen.getByText('💬 コメント 2')).toBeInTheDocument()
    expect(screen.getByTestId('want-button-42')).toHaveClass('active')
    expect(screen.getByTestId('like-button-42')).not.toHaveClass('active')
  })

  it('カード本体クリックで投稿詳細へ遷移する', async () => {
    const { router } = renderPostCard()
    await router.isReady()

    await fireEvent.click(screen.getByTestId('post-card-42'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('post-detail')
      expect(router.currentRoute.value.params.id).toBe('42')
    })
  })

  it('著者名クリックではカードのクリックを発火させずプロフィールへ遷移する', async () => {
    const { router } = renderPostCard()
    await router.isReady()

    await fireEvent.click(screen.getByTestId('author-link-42'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('profile')
      expect(router.currentRoute.value.params.id).toBe('7')
    })
  })

  it('いいねボタンのクリックはtoggle-likeをemitしカード遷移はしない', async () => {
    const { router, emitted } = renderPostCard()
    await router.isReady()

    await fireEvent.click(screen.getByTestId('like-button-42'))

    expect(emitted()['toggle-like']).toEqual([[post]])
    expect(router.currentRoute.value.name).toBe('timeline')
  })

  it('かきたいボタンのクリックはtoggle-wantをemitしカード遷移はしない', async () => {
    const { router, emitted } = renderPostCard()
    await router.isReady()

    await fireEvent.click(screen.getByTestId('want-button-42'))

    expect(emitted()['toggle-want']).toEqual([[post]])
    expect(router.currentRoute.value.name).toBe('timeline')
  })

  it('clickable=falseの場合はカード本体をクリックしても遷移しない（投稿詳細画面用）', async () => {
    const { router } = renderPostCard({ clickable: false })
    await router.isReady()

    await fireEvent.click(screen.getByTestId('post-card-42'))

    expect(router.currentRoute.value.name).toBe('timeline')
    expect(screen.getByTestId('post-card-42')).not.toHaveAttribute('role')
  })

  it('pending=trueの場合はいいね/かきたいボタンが無効化される', async () => {
    const { router } = renderPostCard({ pending: true })
    await router.isReady()

    expect(screen.getByTestId('like-button-42')).toBeDisabled()
    expect(screen.getByTestId('want-button-42')).toBeDisabled()
  })

  it('imagesが無い投稿では画像を表示しない', async () => {
    const { router } = renderPostCard()
    await router.isReady()

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('投稿者にアイコン画像が設定されている場合は投稿者名の横に表示する', async () => {
    const withAvatar = {
      ...post,
      author: { ...post.author, avatar_url: 'https://example.com/avatar.jpg' },
    }
    const { router } = renderPostCard({ post: withAvatar })
    await router.isReady()

    expect(screen.getByTestId('author-avatar-42')).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg',
    )
  })

  it('投稿者にアイコン画像が設定されていない場合は画像の代わりにプレースホルダーを表示する（表示位置は空けておく）', async () => {
    const { router } = renderPostCard()
    await router.isReady()

    expect(screen.queryByTestId('author-avatar-42')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('author-link-42').querySelector('.avatar-placeholder'),
    ).toBeInTheDocument()
  })

  it('imagesがある投稿では画像を並べて表示する', async () => {
    const withImages = {
      ...post,
      images: [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg',
      ],
    }
    const { router } = renderPostCard({ post: withImages })
    await router.isReady()

    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('imageLimitを指定すると、その枚数までしか画像を表示しない（S03イラストタブのグリッド用）', async () => {
    const withImages = {
      ...post,
      images: [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg',
      ],
    }
    const { router } = renderPostCard({ post: withImages, imageLimit: 1 })
    await router.isReady()

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('src', 'https://example.com/1.jpg')
  })

  it('imageLimitを指定しない場合は添付画像を全て表示する（一覧・詳細画面の既定動作）', async () => {
    const withImages = {
      ...post,
      images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
    }
    const { router } = renderPostCard({ post: withImages })
    await router.isReady()

    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('本文が画像より上に表示される（投稿詳細画面と同じ並び）', async () => {
    const withImages = { ...post, images: ['https://example.com/1.jpg'] }
    const { router } = renderPostCard({ post: withImages })
    await router.isReady()

    const card = screen.getByTestId('post-card-42')
    const bodyEl = screen.getByText('本文です')
    const imageEl = screen.getByRole('img')
    const position = bodyEl.compareDocumentPosition(imageEl)
    // Node.DOCUMENT_POSITION_FOLLOWING: bodyElより後（下）にimageElがあることを確認
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(card).toContainElement(bodyEl)
  })

  it('本文が空文字（画像のみ投稿）の場合は本文の段落を表示しない', async () => {
    const imageOnly = { ...post, body: '', images: ['https://example.com/1.jpg'] }
    const { router } = renderPostCard({ post: imageOnly })
    await router.isReady()

    expect(screen.queryByText('本文です')).not.toBeInTheDocument()
  })

  describe('タイトル・分類タグ（画面設計書・docs/features/tag.md）', () => {
    it('小説投稿はタイトルを【】付きで本文の上に表示する', async () => {
      const novelPost = { ...post, post_type: 'novel' as const, title: 'タイトルです' }
      const { router } = renderPostCard({ post: novelPost })
      await router.isReady()

      expect(screen.getByTestId('post-title')).toHaveTextContent('【タイトルです】')
    })

    it('イラスト投稿はタイトルを持たないため表示しない', async () => {
      const { router } = renderPostCard()
      await router.isReady()

      expect(screen.queryByTestId('post-title')).not.toBeInTheDocument()
    })

    it('分類タグが選択されている場合、#タグ名の形で並べて表示する', async () => {
      const tagged = {
        ...post,
        tags: [
          { id: 1, name: 'オリジナル' },
          { id: 2, name: 'ファンタジー' },
        ],
      }
      const { router } = renderPostCard({ post: tagged })
      await router.isReady()

      expect(screen.getByTestId('post-tags')).toHaveTextContent('#オリジナル')
      expect(screen.getByTestId('post-tags')).toHaveTextContent('#ファンタジー')
    })

    it('分類タグが無い場合はタグ行を表示しない', async () => {
      const { router } = renderPostCard()
      await router.isReady()

      expect(screen.queryByTestId('post-tags')).not.toBeInTheDocument()
    })
  })

  describe('編集・削除（自分の投稿のみ表示、画面設計書141行目）', () => {
    it('他人の投稿には編集・削除ボタンを表示しない', async () => {
      const { router } = renderPostCard({}, 999)
      await router.isReady()

      expect(screen.queryByTestId('edit-button-42')).not.toBeInTheDocument()
      expect(screen.queryByTestId('delete-button-42')).not.toBeInTheDocument()
    })

    it('自分の投稿には編集・削除ボタンを表示する', async () => {
      const { router } = renderPostCard({}, 7)
      await router.isReady()

      expect(screen.getByTestId('edit-button-42')).toBeInTheDocument()
      expect(screen.getByTestId('delete-button-42')).toBeInTheDocument()
    })

    it('編集ボタンクリックで投稿編集画面へ遷移する', async () => {
      const { router } = renderPostCard({}, 7)
      await router.isReady()

      await fireEvent.click(screen.getByTestId('edit-button-42'))

      await waitFor(() => {
        expect(router.currentRoute.value.name).toBe('post-edit')
        expect(router.currentRoute.value.params.id).toBe('42')
      })
    })

    it('削除ボタンは確認後にdeleteをemitする', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { router, emitted } = renderPostCard({}, 7)
      await router.isReady()

      await fireEvent.click(screen.getByTestId('delete-button-42'))

      expect(window.confirm).toHaveBeenCalled()
      expect(emitted().delete).toEqual([[post]])
      vi.restoreAllMocks()
    })

    it('削除確認をキャンセルするとdeleteをemitしない', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const { router, emitted } = renderPostCard({}, 7)
      await router.isReady()

      await fireEvent.click(screen.getByTestId('delete-button-42'))

      expect(emitted().delete).toBeUndefined()
      vi.restoreAllMocks()
    })

    it('削除ボタンクリックはカード自体の遷移を発火させない', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { router } = renderPostCard({}, 7)
      await router.isReady()

      await fireEvent.click(screen.getByTestId('delete-button-42'))

      expect(router.currentRoute.value.name).toBe('timeline')
      vi.restoreAllMocks()
    })
  })

  describe('preview=true（S06の参考投稿プレビュー用途）', () => {
    it('自分の投稿でも編集・削除ボタンを表示しない', () => {
      // currentUserId=7（=post.author.id）: previewが無ければ編集・削除が出る条件
      renderPostCard({ preview: true, clickable: false }, 7)

      expect(screen.queryByTestId('edit-button-42')).not.toBeInTheDocument()
      expect(screen.queryByTestId('delete-button-42')).not.toBeInTheDocument()
    })

    it('いいね・かきたい・コメント数のアクション行を表示しない', () => {
      renderPostCard({ preview: true, clickable: false })

      expect(screen.queryByTestId('like-button-42')).not.toBeInTheDocument()
      expect(screen.queryByTestId('want-button-42')).not.toBeInTheDocument()
    })

    it('投稿者名をリンクにせず、クリックしてもプロフィールへ遷移しない', async () => {
      const { router } = renderPostCard({ preview: true, clickable: false })
      await router.isReady()

      expect(screen.queryByTestId('author-link-42')).not.toBeInTheDocument()
      expect(screen.getByText('投稿者')).toBeInTheDocument()

      await fireEvent.click(screen.getByText('投稿者'))

      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })
})
