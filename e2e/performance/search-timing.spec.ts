// ブラウザパフォーマンステスト：ユーザー検索の実行 → 結果表示までの時間。

import { test, expect } from '../support/fixtures'
import { searchScreen } from '../support/selectors'
import { recordTiming } from '../support/perfTiming'

const THRESHOLD_MS = 2000

test('検索実行から結果表示までの時間', async ({ authedPage: page, secondUser }, testInfo) => {
  await page.goto('/search')
  await searchScreen.keywordInput(page).fill(secondUser.username)

  const start = performance.now()
  await searchScreen.submitButton(page).click()
  await expect(searchScreen.resultItem(page, secondUser.id)).toBeVisible()
  const elapsed = performance.now() - start

  await recordTiming(testInfo, 'search-submit-to-results', elapsed, THRESHOLD_MS)
})
