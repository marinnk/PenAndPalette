// F-6 リクエスト機能（docs/features/request.md、画面 S06/S07）

import { test, expect } from '../support/fixtures'
import { createIllustrationPost } from '../support/api'
import { profileScreen, requestForm, header } from '../support/selectors'

test.describe('リクエスト', () => {
  test('相手のプロフィールからリクエストを送ると、相手のヘッダーに通知バッジが出る', async ({
    authedPage: page,
    secondUser,
    secondUserPage,
  }) => {
    await page.goto(`/profile/${secondUser.id}`)
    await profileScreen.requestButton(page).click()
    await expect(page).toHaveURL(new RegExp(`/profile/${secondUser.id}/requests/new$`))

    // 空メッセージでは送信できない
    await expect(requestForm.submit(page)).toBeDisabled()

    await requestForm.message(page).fill(`e2e request ${Date.now()}`)
    await requestForm.submit(page).click()

    await expect(page).toHaveURL(new RegExp(`/profile/${secondUser.id}$`))

    // 相手（secondUser）側で再読み込みするとヘッダーに「届いたリクエスト」バッジが出る
    await secondUserPage.goto('/')
    await expect(header.requestBadge(secondUserPage)).toBeVisible()
  })

  test('参考にしてほしい投稿を選んでリクエストできる', async ({ authedPage: page, secondUser }) => {
    const body = `e2e request related post ${Date.now()}`
    const postId = await createIllustrationPost(page.request, { body })

    await page.goto(`/profile/${secondUser.id}/requests/new`)
    await requestForm.message(page).fill(`e2e request with related ${Date.now()}`)

    await requestForm.pickerToggle(page).click()
    await requestForm.pickerTabOwn(page).click()
    await requestForm.pickerOption(page, postId).click()

    // 選択済みの投稿プレビューと「選択を解除する」が出る
    await expect(requestForm.relatedPostClear(page)).toBeVisible()

    await requestForm.submit(page).click()
    await expect(page).toHaveURL(new RegExp(`/profile/${secondUser.id}$`))
  })
})
