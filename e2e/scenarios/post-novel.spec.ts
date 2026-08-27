// F-3 投稿機能：小説投稿（docs/features/post.md、画面 S04）
// 小説投稿はタイトル（100文字まで）・本文（4000文字まで）必須、カバー画像は任意0〜1枚。

import { test, expect } from '../support/fixtures'
import { timeline, composeForm, postCardByText } from '../support/selectors'
import { showFollowingTimeline } from '../support/helpers'

test.describe('小説投稿', () => {
  test('タイトルと本文を入力して投稿すると、タイムラインに【タイトル】付きで反映される', async ({
    authedPage: page,
  }) => {
    const title = `e2e novel ${Date.now()}`
    const body = 'むかしむかしあるところに、E2E テストがありました。'

    await timeline.composeButton(page).click()
    await composeForm.typeNovel(page).click()

    await composeForm.title(page).fill(title)
    await composeForm.body(page).fill(body)
    await composeForm.submit(page).click()

    await expect(page).toHaveURL(new RegExp('/$'))
    await showFollowingTimeline(page)
    await timeline.typeTab(page, 'novel').click()

    const card = postCardByText(page, `【${title}】`)
    await expect(card).toBeVisible()
    await expect(card).toContainText(body)
  })

  test('タイトルまたは本文が未入力だと投稿ボタンが無効', async ({ authedPage: page }) => {
    await timeline.composeButton(page).click()
    await composeForm.typeNovel(page).click()

    await expect(composeForm.submit(page)).toBeDisabled()

    await composeForm.title(page).fill('タイトルだけ')
    await expect(composeForm.submit(page)).toBeDisabled()

    await composeForm.body(page).fill('本文も入れた')
    await expect(composeForm.submit(page)).toBeEnabled()
  })

  test('入力済みで種別を切り替えると確認ダイアログが出て、承認すると内容がクリアされる', async ({
    authedPage: page,
  }) => {
    await timeline.composeButton(page).click()
    await composeForm.body(page).fill('イラスト投稿のつもりで書いた本文')

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('入力した内容は失われます')
      dialog.accept()
    })
    await composeForm.typeNovel(page).click()

    await expect(composeForm.body(page)).toHaveValue('')
    await expect(composeForm.title(page)).toBeVisible()
  })
})
