// F-8 プロフィール機能：閲覧（docs/features/profile.md、画面 S07）

import { test, expect } from '../support/fixtures'
import { createIllustrationPost } from '../support/api'
import { postCardByText, profileScreen } from '../support/selectors'

test.describe('プロフィール閲覧', () => {
  test('自分のプロフィールには投稿一覧と「編集」「投稿する」ボタンが出る', async ({
    authedPage: page,
    user,
  }) => {
    const body = `e2e my profile post ${Date.now()}`
    await createIllustrationPost(page.request, { body })

    await page.goto(`/profile/${user.id}`)
    await expect(profileScreen.displayName(page)).toHaveText(user.displayName)
    await expect(postCardByText(page, body)).toBeVisible()
    await expect(profileScreen.editButton(page)).toBeVisible()
    await expect(profileScreen.composeButton(page)).toBeVisible()
    await expect(profileScreen.followButton(page)).toHaveCount(0)
  })

  test('他人のプロフィールには「フォローする」「リクエストする」ボタンが出る', async ({
    authedPage: page,
    secondUser,
  }) => {
    await page.goto(`/profile/${secondUser.id}`)
    await expect(profileScreen.displayName(page)).toHaveText(secondUser.displayName)
    await expect(profileScreen.followButton(page)).toBeVisible()
    await expect(profileScreen.requestButton(page)).toBeVisible()
    await expect(profileScreen.editButton(page)).toHaveCount(0)
  })

  test('投稿がない利用者のプロフィールには空状態が表示される', async ({
    authedPage: page,
    secondUser,
  }) => {
    await page.goto(`/profile/${secondUser.id}`)
    await expect(profileScreen.postsEmpty(page)).toBeVisible()
  })
})
