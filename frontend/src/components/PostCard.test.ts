import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import PostCard from './PostCard.vue'
import type { Post } from '@/types/post'

const PostDetailStub = { template: '<div>post-detail</div>' }
const ProfileStub = { template: '<div>profile</div>' }
const TimelineStub = { template: '<div>timeline</div>' }

const post: Post = {
  id: 42,
  author: { id: 7, username: 'author', display_name: '投稿者', avatar_url: null },
  body: '本文です',
  images: [],
  like_count: 3,
  want_count: 1,
  comment_count: 2,
  liked_by_me: false,
  wanted_by_me: true,
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
}

function renderPostCard(props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailStub },
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
    ],
  })
  const result = render(PostCard, { props: { post, ...props }, global: { plugins: [router] } })
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

  it('imagesがある投稿では画像を並べて表示する', async () => {
    const withImages = {
      ...post,
      images: ['https://example.com/1.jpg', 'https://example.com/2.jpg', 'https://example.com/3.jpg'],
    }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'timeline', component: TimelineStub },
        { path: '/posts/:id', name: 'post-detail', component: PostDetailStub },
        { path: '/profile/:id', name: 'profile', component: ProfileStub },
      ],
    })
    render(PostCard, { props: { post: withImages }, global: { plugins: [router] } })
    await router.isReady()

    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('本文が空文字（画像のみ投稿）の場合は本文の段落を表示しない', async () => {
    const imageOnly = { ...post, body: '', images: ['https://example.com/1.jpg'] }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'timeline', component: TimelineStub },
        { path: '/posts/:id', name: 'post-detail', component: PostDetailStub },
        { path: '/profile/:id', name: 'profile', component: ProfileStub },
      ],
    })
    render(PostCard, { props: { post: imageOnly }, global: { plugins: [router] } })
    await router.isReady()

    expect(screen.queryByText('本文です')).not.toBeInTheDocument()
  })
})
