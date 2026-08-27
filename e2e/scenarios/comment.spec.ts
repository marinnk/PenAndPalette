// F-4 コメント機能（docs/features/comment.md、画面 S05）

import { test, expect } from '../support/fixtures'
import { createIllustrationPost } from '../support/api'
import { commentForm, commentItems, commentItemByText, postCard } from '../support/selectors'
import { VALID_JPG } from '../support/fixtureFiles'

test.describe('コメント', () => {
  test('コメントを投稿すると一覧と💬件数に反映される', async ({ authedPage: page }) => {
    const postId = await createIllustrationPost(page.request, { body: `e2e commentable ${Date.now()}` })
    const content = `e2e comment ${Date.now()}`

    await page.goto(`/posts/${postId}`)
    // 空白のみでは送信できない
    await commentForm.body(page).fill('   ')
    await expect(commentForm.submit(page)).toBeDisabled()

    await commentForm.body(page).fill(content)
    await commentForm.submit(page).click()

    await expect(commentItemByText(page, content)).toBeVisible()
    await expect(postCard(page, postId)).toContainText('コメント 1')
  })

  test('自分のコメントを編集できる', async ({ authedPage: page }) => {
    const postId = await createIllustrationPost(page.request, { body: `e2e editable-comment ${Date.now()}` })
    await page.goto(`/posts/${postId}`)

    const original = `e2e comment original ${Date.now()}`
    await commentForm.body(page).fill(original)
    await commentForm.submit(page).click()

    // 各テストは1件だけコメントするので一意。編集モードに入ると本文は textarea の value になり
    // hasText では絞れなくなるため、要素そのものを掴んでおく。
    const item = commentItems(page)
    await expect(item).toContainText(original)

    const edited = `e2e comment edited ${Date.now()}`
    await item.getByRole('button', { name: '編集' }).click()
    await item.locator('textarea').fill(edited)
    await item.getByRole('button', { name: '保存する' }).click()

    await expect(item).toContainText(edited)
    await expect(item).not.toContainText(original)
  })

  test('自分のコメントを削除できる', async ({ authedPage: page }) => {
    const postId = await createIllustrationPost(page.request, { body: `e2e deletable-comment ${Date.now()}` })
    await page.goto(`/posts/${postId}`)

    const content = `e2e comment to delete ${Date.now()}`
    await commentForm.body(page).fill(content)
    await commentForm.submit(page).click()
    await expect(commentItems(page)).toContainText(content)

    page.once('dialog', (dialog) => dialog.accept())
    await commentItems(page).getByRole('button', { name: '削除' }).click()

    await expect(commentItems(page)).toHaveCount(0)
  })

  test('画像付きのコメントを投稿できる', async ({ authedPage: page }) => {
    const postId = await createIllustrationPost(page.request, { body: `e2e image-comment ${Date.now()}` })
    await page.goto(`/posts/${postId}`)

    const content = `e2e comment with image ${Date.now()}`
    await commentForm.body(page).fill(content)
    await commentForm.imageInput(page).setInputFiles(VALID_JPG)
    await commentForm.submit(page).click()

    await expect(commentItemByText(page, content).locator('img')).toHaveCount(1)
  })
})
