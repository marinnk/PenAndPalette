// F-3 投稿機能 × F-11 分類タグ機能（docs/features/tag.md、画面 S04/S05）
// アプリが用意した固定の分類タグを最大5個まで付けられる。イラスト・小説で同じ一覧。

import { test, expect } from '../support/fixtures'
import { getTags } from '../support/api'
import { timeline, composeForm, postCardByText } from '../support/selectors'
import { showFollowingTimeline } from '../support/helpers'
import { VALID_JPG } from '../support/fixtureFiles'

test.describe('分類タグ', () => {
  test('タグを選んでイラスト投稿すると、カードに #タグ が表示される', async ({ authedPage: page }) => {
    const tags = await getTags(page.request)
    const chosen = tags.slice(0, 2)
    const body = `e2e tagged post ${Date.now()}`

    await timeline.composeButton(page).click()
    await composeForm.body(page).fill(body)
    await composeForm.imageInput(page).setInputFiles(VALID_JPG)
    for (const tag of chosen) {
      await composeForm.tag(page, tag.id).click()
      await expect(composeForm.tag(page, tag.id)).toHaveAttribute('aria-pressed', 'true')
    }
    await composeForm.submit(page).click()
    // 投稿成功で遷移元（タイムライン）へ戻る。戻る前に次の goto をするとXHRが中断されるため待つ。
    await expect(page).toHaveURL(new RegExp('/$'))

    await showFollowingTimeline(page)
    const card = postCardByText(page, body)
    for (const tag of chosen) {
      await expect(card.getByTestId('post-tags')).toContainText(`#${tag.name}`)
    }
  })

  test('6個目以降のタグボタンは選択できない（disabled）', async ({ authedPage: page }) => {
    const tags = await getTags(page.request)
    expect(tags.length).toBeGreaterThanOrEqual(6)

    await timeline.composeButton(page).click()
    for (const tag of tags.slice(0, 5)) {
      await composeForm.tag(page, tag.id).click()
    }

    // 未選択の6個目は disabled、選択済みの1個目は解除できる（enabled）
    await expect(composeForm.tag(page, tags[5].id)).toBeDisabled()
    await expect(composeForm.tag(page, tags[0].id)).toBeEnabled()
  })

  test('同じタグ一覧が小説投稿でも使える', async ({ authedPage: page }) => {
    const tags = await getTags(page.request)

    await timeline.composeButton(page).click()
    await composeForm.typeNovel(page).click()

    for (const tag of tags) {
      await expect(composeForm.tag(page, tag.id)).toBeVisible()
    }
  })
})
