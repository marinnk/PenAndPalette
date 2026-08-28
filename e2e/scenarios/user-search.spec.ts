// F-9 ユーザー検索機能（docs/features/user-search.md、画面 S09）

import { test, expect } from '../support/fixtures'
import { searchScreen, profileScreen, header } from '../support/selectors'

test.describe('ユーザー検索', () => {
  test('キーワードで検索すると該当利用者が一覧表示され、結果からプロフィールへ遷移できる', async ({
    authedPage: page,
    secondUser,
  }) => {
    await page.goto('/search')
    await searchScreen.keywordInput(page).fill(secondUser.username)
    await searchScreen.submitButton(page).click()

    const item = searchScreen.resultItem(page, secondUser.id)
    await expect(item).toBeVisible()
    await expect(item).toContainText(secondUser.displayName)

    await item.click()
    await expect(page).toHaveURL(new RegExp(`/profile/${secondUser.id}$`))
    await expect(profileScreen.displayName(page)).toHaveText(secondUser.displayName)
  })

  test('画面共通ヘッダーの検索入力欄からもキーワードで検索できる', async ({
    authedPage: page,
    secondUser,
  }) => {
    await page.goto('/')
    await header.searchInput(page).fill(secondUser.username)
    await header.searchSubmit(page).click()

    await expect(page).toHaveURL(/\/search\?q=/)
    const item = searchScreen.resultItem(page, secondUser.id)
    await expect(item).toBeVisible()
    await expect(item).toContainText(secondUser.displayName)
  })

  test('空のキーワードでは検索が実行されない', async ({ authedPage: page }) => {
    let searchRequests = 0
    page.on('request', (req) => {
      if (req.method() === 'GET' && /\/api\/users\/?\?/.test(req.url())) searchRequests++
    })

    await page.goto('/search')
    await searchScreen.submitButton(page).click()

    await expect(searchScreen.empty(page)).toHaveCount(0)
    expect(searchRequests).toBe(0)
  })

  test('該当する利用者がいない場合はその旨が表示される', async ({ authedPage: page }) => {
    await page.goto('/search')
    await searchScreen.keywordInput(page).fill('no-such-user-xyz-nonexistent')
    await searchScreen.submitButton(page).click()

    await expect(searchScreen.empty(page)).toBeVisible()
  })
})
