// ブラウザパフォーマンステスト：ログイン送信 → タイムライン表示までの体感時間。
// perf-tests/k6 の auth-login は API 単体の応答時間を見るが、こちらはボタンクリックから
// 実際に画面が描画されるまでの、利用者が体感する時間を計測する。

import { test, expect } from '../support/fixtures'
import { loginScreen, timeline } from '../support/selectors'
import { recordTiming } from '../support/perfTiming'

const THRESHOLD_MS = 2500

test('ログイン送信からタイムライン表示までの時間', async ({ page, user }, testInfo) => {
  await page.goto('/login')
  await loginScreen.emailInput(page).fill(user.email)
  await loginScreen.passwordInput(page).fill(user.password)

  const start = performance.now()
  await loginScreen.submitButton(page).click()
  await expect(timeline.composeButton(page)).toBeVisible()
  const elapsed = performance.now() - start

  await recordTiming(testInfo, 'login-submit-to-timeline', elapsed, THRESHOLD_MS)
})
