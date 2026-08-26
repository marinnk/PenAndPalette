import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import PostGrid from './PostGrid.vue'
import type { Post } from '@/types/post'

const PostDetailStub = { template: '<div>post-detail</div>' }
const TimelineStub = { template: '<div>timeline</div>' }

function makePost(id: number, overrides: Partial<Post> = {}): Post {
  return {
    id,
    author: { id: 1, username: 'author', display_name: '投稿者', avatar_url: null },
    body: '',
    images: [`https://example.com/${id}-1.jpg`, `https://example.com/${id}-2.jpg`],
    image_ids: [id * 10, id * 10 + 1],
    post_type: 'illustration',
    title: '',
    tags: [],
    like_count: 0,
    want_count: 0,
    comment_count: 0,
    liked_by_me: false,
    wanted_by_me: false,
    created_at: '2026-08-23T00:00:00Z',
    updated_at: '2026-08-23T00:00:00Z',
    ...overrides,
  }
}

function renderPostGrid(posts: Post[]) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      { path: '/posts/:id', name: 'post-detail', component: PostDetailStub },
    ],
  })
  const result = render(PostGrid, { props: { posts }, global: { plugins: [router] } })
  return { ...result, router }
}

describe('PostGrid', () => {
  it('投稿ごとに最初の画像だけをタイルとして表示する（本文・タグ・カウントは表示しない）', async () => {
    const posts = [makePost(1), makePost(2)]
    const { router } = renderPostGrid(posts)
    await router.isReady()

    expect(screen.getByTestId('post-grid-tile-1')).toBeInTheDocument()
    expect(screen.getByTestId('post-grid-tile-2')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByTestId('post-grid-tile-1').querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/1-1.jpg',
    )
  })

  it('タイルをクリックすると投稿詳細画面へ遷移する', async () => {
    const { router } = renderPostGrid([makePost(5)])
    await router.isReady()

    await fireEvent.click(screen.getByTestId('post-grid-tile-5'))

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('post-detail')
      expect(router.currentRoute.value.params.id).toBe('5')
    })
  })

  it('投稿が無い場合は何も表示しない', () => {
    renderPostGrid([])

    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })
})
