// ブラウザパフォーマンステスト：タイムラインを開いて最初の投稿一覧が見えるまでの時間。

import { test, expect } from '../support/fixtures'
import { createManyIllustrationPosts } from '../support/api'
import { postCards } from '../support/selectors'
import { recordTiming } from '../support/perfTiming'

const THRESHOLD_MS = 3000

test('タイムラインを開いて投稿一覧が表示されるまでの時間', async ({ authedPage: page }, testInfo) => {
  await createManyIllustrationPosts(page.request, 20, 'e2e perf timeline-load')

  const start = performance.now()
  await page.goto('/')
  await expect(postCards(page).first()).toBeVisible()
  const elapsed = performance.now() - start

  await recordTiming(testInfo, 'timeline-open-to-first-post', elapsed, THRESHOLD_MS)
})
