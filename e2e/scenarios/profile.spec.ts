// F-8 プロフィール機能：閲覧（docs/features/profile.md、画面 S07）

import { test, expect } from '../support/fixtures'
import { createIllustrationPost, likePost } from '../support/api'
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

  test('自分のプロフィールの「ブックマーク」タブに、いいねした作品が表示される', async ({
    authedPage: page,
    user,
    secondUserRequest,
  }) => {
    const myBody = `e2e my post ${Date.now()}`
    const likedBody = `e2e liked post ${Date.now()}`
    await createIllustrationPost(page.request, { body: myBody })
    const likedId = await createIllustrationPost(secondUserRequest, { body: likedBody })
    await likePost(page.request, likedId)

    await page.goto(`/profile/${user.id}`)

    // 「投稿」タブ：自分の投稿が出て、いいねしただけの他人の投稿は出ない
    await expect(postCardByText(page, myBody)).toBeVisible()
    await expect(postCardByText(page, likedBody)).toHaveCount(0)

    // 「ブックマーク」タブ：いいねした作品が出て、自分の投稿（未いいね）は出ない
    await profileScreen.tabBookmarks(page).click()
    await expect(postCardByText(page, likedBody)).toBeVisible()
    await expect(postCardByText(page, myBody)).toHaveCount(0)
  })

  test('他人のプロフィールには「ブックマーク」タブが出ない', async ({
    authedPage: page,
    secondUser,
  }) => {
    await page.goto(`/profile/${secondUser.id}`)
    await expect(profileScreen.displayName(page)).toHaveText(secondUser.displayName)
    await expect(profileScreen.tabBookmarks(page)).toHaveCount(0)
  })
})
