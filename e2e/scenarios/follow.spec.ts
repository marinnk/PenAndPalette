// F-7 フォロー機能（docs/features/follow.md、画面 S07/S10）

import { test, expect } from '../support/fixtures'
import { createIllustrationPost } from '../support/api'
import { postCardByText, profileScreen, followListScreen } from '../support/selectors'
import { showFollowingTimeline } from '../support/helpers'

test.describe('フォロー・フォロー解除', () => {
  test('フォローするとフォロワー数が増え、「フォロー中」タブに相手の投稿が出る', async ({
    authedPage: page,
    user,
    secondUser,
    secondUserRequest,
  }) => {
    const body = `e2e followee post ${Date.now()}`
    await createIllustrationPost(secondUserRequest, { body })

    await page.goto(`/profile/${secondUser.id}`)
    const followButton = profileScreen.followButton(page)
    await expect(followButton).toHaveText('フォローする')
    await expect(profileScreen.followerCount(page)).toHaveText('フォロワー 0')

    await followButton.click()
    await expect(followButton).toHaveText('フォロー中')
    await expect(profileScreen.followerCount(page)).toHaveText('フォロワー 1')

    // タイムラインの「フォロー中」タブに相手の投稿が出る
    await showFollowingTimeline(page)
    await expect(postCardByText(page, body)).toBeVisible()

    // 自分のプロフィールの「フォロー中」一覧に相手が載る
    await page.goto(`/profile/${user.id}/following`)
    await expect(followListScreen.item(page, secondUser.id)).toBeVisible()

    // フォロー解除するとフォロワー数が戻る
    await page.goto(`/profile/${secondUser.id}`)
    await profileScreen.followButton(page).click()
    await expect(profileScreen.followButton(page)).toHaveText('フォローする')
    await expect(profileScreen.followerCount(page)).toHaveText('フォロワー 0')
  })

  test('フォロワー一覧にフォローしてきた利用者が表示される', async ({
    authedPage: page,
    user,
    secondUser,
    secondUserPage,
  }) => {
    // secondUser が authed user をフォロー
    await secondUserPage.goto(`/profile/${user.id}`)
    await profileScreen.followButton(secondUserPage).click()
    await expect(profileScreen.followButton(secondUserPage)).toHaveText('フォロー中')

    await page.goto(`/profile/${user.id}/followers`)
    await expect(followListScreen.item(page, secondUser.id)).toBeVisible()
  })
})
