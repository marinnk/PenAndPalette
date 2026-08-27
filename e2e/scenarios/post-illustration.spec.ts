// F-3 投稿機能：イラスト投稿（docs/features/post.md、画面 S04）
// イラスト投稿は画像1〜4枚必須・本文任意（280文字まで）。

import { test, expect } from '../support/fixtures'
import { timeline, composeForm, postCardByText } from '../support/selectors'
import { showFollowingTimeline } from '../support/helpers'
import { VALID_JPG } from '../support/fixtureFiles'

test.describe('イラスト投稿', () => {
  test('画像と本文を入力して投稿すると、タイムラインに反映される', async ({ authedPage: page }) => {
    const body = `e2e illustration post ${Date.now()}`

    await timeline.composeButton(page).click()
    await expect(page).toHaveURL(/\/posts\/new$/)

    await composeForm.body(page).fill(body)
    await composeForm.imageInput(page).setInputFiles(VALID_JPG)
    await composeForm.submit(page).click()

    // 投稿後は遷移元（タイムライン）へ戻る
    await expect(page).toHaveURL(new RegExp('/$'))
    await showFollowingTimeline(page)
    const card = postCardByText(page, body)
    await expect(card).toBeVisible()
    await expect(card.locator('img')).toHaveCount(1)
  })

  test('画像を1枚も選ばないと投稿ボタンが無効', async ({ authedPage: page }) => {
    await timeline.composeButton(page).click()
    await composeForm.body(page).fill('e2e illustration without image')

    await expect(composeForm.submit(page)).toBeDisabled()
  })

  test('本文はテキストエリア自体が280文字までに制限される', async ({ authedPage: page }) => {
    await timeline.composeButton(page).click()
    const body = composeForm.body(page)

    await body.pressSequentially('あ'.repeat(281), { delay: 0 })

    await expect(body).toHaveValue('あ'.repeat(280))
    await expect(composeForm.bodyCounter(page)).toHaveText('280/280')
  })
})
