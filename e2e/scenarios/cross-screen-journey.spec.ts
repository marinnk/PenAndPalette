// 統合シナリオ：画面横断のハッピーパス（docs/screen-design.md の画面遷移をなぞる）
//
// A（authedPage）がイラストを投稿 → B（secondUserPage）が検索でAを見つけ、フォロー・いいね・
// コメント → 双方の画面（Bの「フォロー中」タブ、Aの投稿のカウント）に反映される、という
// 一連の流れを test.step で区切って検証する。

import { test, expect } from '../support/fixtures'
import {
  timeline,
  searchScreen,
  profileScreen,
  postCard,
  postCardByText,
  postCardActions,
  commentForm,
  commentItemByText,
  composeForm,
} from '../support/selectors'
import { showFollowingTimeline } from '../support/helpers'
import { VALID_JPG } from '../support/fixtureFiles'

test('投稿 → 別利用者のフォロー・いいね・コメント → 双方の画面に反映される', async ({
  authedPage: userA,
  user: a,
  secondUserPage: userB,
}) => {
  const postBody = `e2e cross-screen post ${Date.now()}`
  const commentText = `e2e cross-screen comment ${Date.now()}`
  let postId = 0

  await test.step('A がイラストを投稿する', async () => {
    await timeline.composeButton(userA).click()
    await composeForm.body(userA).fill(postBody)
    await composeForm.imageInput(userA).setInputFiles(VALID_JPG)
    await composeForm.submit(userA).click()
    await expect(userA).toHaveURL(new RegExp('/$'))

    await userA.goto(`/profile/${a.id}`)
    const card = postCardByText(userA, postBody)
    await expect(card).toBeVisible()
    postId = Number((await card.getAttribute('data-testid'))!.replace('post-card-', ''))
  })

  await test.step('B が検索で A を見つけ、フォロー・いいね・コメントする', async () => {
    await userB.goto('/search')
    await searchScreen.keywordInput(userB).fill(a.username)
    await searchScreen.submitButton(userB).click()
    await searchScreen.resultItem(userB, a.id).click()

    await profileScreen.followButton(userB).click()
    await expect(profileScreen.followButton(userB)).toHaveText('フォロー中')

    await postCardActions.likeButton(userB, postId).click()
    await expect(postCardActions.likeButton(userB, postId)).toContainText('いいね 1')

    await userB.goto(`/posts/${postId}`)
    await commentForm.body(userB).fill(commentText)
    await commentForm.submit(userB).click()
    await expect(commentItemByText(userB, commentText)).toBeVisible()
  })

  await test.step('B の「フォロー中」タブに A の投稿が出る', async () => {
    await showFollowingTimeline(userB)
    await expect(postCardByText(userB, postBody)).toBeVisible()
  })

  await test.step('A の投稿にいいね1・コメント1、A のフォロワーが1になる', async () => {
    await userA.goto(`/posts/${postId}`)
    await expect(postCard(userA, postId)).toContainText('いいね 1')
    await expect(postCard(userA, postId)).toContainText('コメント 1')

    await userA.goto(`/profile/${a.id}`)
    await expect(profileScreen.followerCount(userA)).toHaveText('フォロワー 1')
  })
})
