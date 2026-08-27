// F-5 いいね機能 / F-10 かきたい機能（docs/features/like.md, want-to-create.md、画面 S03/S05）
// いいねとかきたいは別々のカウント（likes / wants テーブル）で、独立してトグルできる。

import { test, expect } from '../support/fixtures'
import { createIllustrationPost } from '../support/api'
import { postCardActions } from '../support/selectors'

test.describe('いいね・かきたい', () => {
  test('いいねはトグルでき、解除で件数が戻る（相手のプロフィールの投稿一覧）', async ({
    authedPage: page,
    secondUser,
    secondUserRequest,
  }) => {
    const postId = await createIllustrationPost(secondUserRequest, { body: `e2e likeable ${Date.now()}` })

    await page.goto(`/profile/${secondUser.id}`)
    const like = postCardActions.likeButton(page, postId)
    await expect(like).toContainText('いいね 0')

    await like.click()
    await expect(like).toContainText('いいね 1')
    await expect(like).toHaveClass(/active/)

    await like.click()
    await expect(like).toContainText('いいね 0')
    await expect(like).not.toHaveClass(/active/)
  })

  test('いいねとかきたいは独立してトグルできる（投稿詳細）', async ({
    authedPage: page,
    secondUserRequest,
  }) => {
    const postId = await createIllustrationPost(secondUserRequest, { body: `e2e reactions ${Date.now()}` })

    await page.goto(`/posts/${postId}`)
    const like = postCardActions.likeButton(page, postId)
    const want = postCardActions.wantButton(page, postId)

    await want.click()
    await expect(want).toContainText('かきたい 1')
    await expect(like).toContainText('いいね 0')

    await like.click()
    await expect(like).toContainText('いいね 1')
    await expect(want).toContainText('かきたい 1')
  })
})
