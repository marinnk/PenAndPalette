// ブラウザパフォーマンステスト：無限スクロールの追加読み込みにかかる時間。

import { test, expect } from '../support/fixtures'
import { createManyIllustrationPosts } from '../support/api'
import { postCards, timeline } from '../support/selectors'
import { showFollowingTimeline } from '../support/helpers'
import { recordTiming } from '../support/perfTiming'

const THRESHOLD_MS = 1500
const TOTAL_POSTS = 25
const PAGE_SIZE = 20

test('スクロールでの追加読み込みにかかる時間', async ({ authedPage: page }, testInfo) => {
  await createManyIllustrationPosts(page.request, TOTAL_POSTS, 'e2e perf infinite-scroll')

  await showFollowingTimeline(page)
  await expect(postCards(page)).toHaveCount(PAGE_SIZE)

  const start = performance.now()
  const responsePromise = page.waitForResponse(
    (r) => /\/api\/posts\?.*before_id=/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  )
  await timeline.sentinel(page).scrollIntoViewIfNeeded()
  await responsePromise
  await expect(postCards(page)).toHaveCount(TOTAL_POSTS)
  const elapsed = performance.now() - start

  await recordTiming(testInfo, 'infinite-scroll-load-more', elapsed, THRESHOLD_MS)
})
