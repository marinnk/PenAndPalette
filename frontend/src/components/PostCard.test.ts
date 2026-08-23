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

function renderPostCard() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailStub },
      { path: '/profile/:id', name: 'profile', component: ProfileStub },
    ],
  })
  const result = render(PostCard, { props: { post }, global: { plugins: [router] } })
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
})
