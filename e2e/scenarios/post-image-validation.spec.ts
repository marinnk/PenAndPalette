// F-3 投稿機能：投稿画像のクライアント側バリデーション（docs/features/post.md 5節）
// jpg/png 形式・1枚5MBまで・イラストは4枚まで・小説のカバーは1枚まで。

import { test, expect } from '../support/fixtures'
import { timeline, composeForm } from '../support/selectors'
import { INVALID_TXT, VALID_JPG, VALID_PNG, oversizedImageFile } from '../support/fixtureFiles'

test.describe('投稿画像のバリデーション', () => {
  test('画像以外のファイルは拒否される', async ({ authedPage: page }) => {
    await timeline.composeButton(page).click()
    await composeForm.imageInput(page).setInputFiles(INVALID_TXT)

    await expect(composeForm.imagePickError(page)).toHaveText(
      '画像はjpgまたはpng形式のみ添付できます。',
    )
  })

  test('5MBを超える画像は拒否される', async ({ authedPage: page }) => {
    await timeline.composeButton(page).click()
    await composeForm.imageInput(page).setInputFiles(oversizedImageFile())

    await expect(composeForm.imagePickError(page)).toHaveText('画像は1枚あたり5MBまでです。')
  })

  test('jpg・png はいずれも受理される', async ({ authedPage: page }) => {
    await timeline.composeButton(page).click()
    await composeForm.imageInput(page).setInputFiles(VALID_JPG)
    await composeForm.imageInput(page).setInputFiles(VALID_PNG)

    await expect(composeForm.imagePickError(page)).toHaveCount(0)
    await expect(composeForm.imageRemove(page, 0)).toBeVisible()
    await expect(composeForm.imageRemove(page, 1)).toBeVisible()
  })

  test('イラストは4枚を超えて追加できない（追加ボタンが消える）', async ({ authedPage: page }) => {
    await timeline.composeButton(page).click()
    for (const f of [VALID_JPG, VALID_PNG, VALID_JPG, VALID_PNG]) {
      await composeForm.imageInput(page).setInputFiles(f)
    }
    await expect(composeForm.imageRemove(page, 3)).toBeVisible()
    await expect(composeForm.imageInput(page)).toHaveCount(0)
  })

  test('小説のカバー画像は1枚まで（追加ボタンが消える）', async ({ authedPage: page }) => {
    await timeline.composeButton(page).click()
    await composeForm.typeNovel(page).click()
    await composeForm.imageInput(page).setInputFiles(VALID_JPG)

    await expect(composeForm.imageRemove(page, 0)).toBeVisible()
    await expect(composeForm.imageInput(page)).toHaveCount(0)
  })
})
