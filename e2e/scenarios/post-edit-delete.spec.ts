// F-3 投稿機能：自分の投稿の編集・削除（docs/features/post.md、画面 S04/S05）

import { test, expect } from '../support/fixtures'
import { createIllustrationPost } from '../support/api'
import { composeForm, postCard, postCardActions, profileScreen } from '../support/selectors'
import { showFollowingTimeline } from '../support/helpers'

test.describe('投稿の編集・削除', () => {
  test('自分のイラスト投稿の本文を編集すると、詳細画面に反映される', async ({ authedPage: page, user }) => {
    const original = `e2e editable post ${Date.now()}`
    const edited = `e2e edited post ${Date.now()}`
    const postId = await createIllustrationPost(page.request, { body: original })

    await page.goto(`/posts/${postId}/edit`)
    await composeForm.body(page).fill(edited)
    await composeForm.submit(page).click()
    // 保存が完了して編集画面から離れるのを待つ（待たずに遷移すると PUT が中断される）
    await expect(page).not.toHaveURL(/\/edit$/)

    await page.goto(`/posts/${postId}`)
    await expect(postCard(page, postId)).toContainText(edited)
    await expect(postCard(page, postId)).not.toContainText(original)
  })

  test('自分の投稿を削除すると、確認ダイアログを経てタイムラインから消える', async ({
    authedPage: page,
  }) => {
    const body = `e2e deletable post ${Date.now()}`
    const postId = await createIllustrationPost(page.request, { body })

    await showFollowingTimeline(page)
    await expect(postCard(page, postId)).toBeVisible()

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('削除しますか')
      dialog.accept()
    })
    await postCardActions.deleteButton(page, postId).click()

    await expect(postCard(page, postId)).toHaveCount(0)
  })

  test('他人の投稿には編集・削除ボタンが表示されない', async ({
    authedPage: page,
    secondUser,
    secondUserRequest,
  }) => {
    const body = `e2e other's post ${Date.now()}`
    const postId = await createIllustrationPost(secondUserRequest, { body })

    await page.goto(`/profile/${secondUser.id}`)
    await expect(profileScreen.displayName(page)).toHaveText(secondUser.displayName)
    await expect(postCard(page, postId)).toBeVisible()
    await expect(postCardActions.editButton(page, postId)).toHaveCount(0)
    await expect(postCardActions.deleteButton(page, postId)).toHaveCount(0)
  })
})
