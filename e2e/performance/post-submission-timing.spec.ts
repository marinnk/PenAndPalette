// ブラウザパフォーマンステスト：イラスト投稿の送信 → タイムライン反映までの時間。

import { test, expect } from '../support/fixtures'
import { timeline, composeForm, postCardByText } from '../support/selectors'
import { recordTiming } from '../support/perfTiming'
import { VALID_JPG } from '../support/fixtureFiles'

const THRESHOLD_MS = 3000

test('投稿の送信からタイムライン反映までの時間', async ({ authedPage: page }, testInfo) => {
  const body = `e2e perf post-submission ${Date.now()}`

  await timeline.composeButton(page).click()
  await composeForm.body(page).fill(body)
  await composeForm.imageInput(page).setInputFiles(VALID_JPG)

  // 送信 → 遷移元（タイムライン）へ戻り、最新投稿として一覧に見えるまでを測る。
  const start = performance.now()
  await composeForm.submit(page).click()
  await expect(page).toHaveURL(new RegExp('/$'))
  await expect(postCardByText(page, body)).toBeVisible()
  const elapsed = performance.now() - start

  await recordTiming(testInfo, 'post-submit-to-timeline', elapsed, THRESHOLD_MS)
})
