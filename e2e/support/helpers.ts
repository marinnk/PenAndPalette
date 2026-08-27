// spec 間で繰り返す小さな操作。

import { expect, type Page } from '@playwright/test'
import { postCards, timeline } from './selectors'

const TIMELINE_SETTLED = '[data-testid="timeline-empty"], [data-testid^="post-card-"]'

/**
 * タイムラインを開き、「フォロー中」タブ（＝誰もフォローしていない新規利用者なら自分の投稿だけ）を
 * 表示する。他specと並列実行しても件数がぶれないよう、隔離された一覧を見るために使う。
 *
 * useTimeline.ts の load() には競合ガードが無く、初期ロード（scope=all）が落ち着く前に
 * タブを切り替えると初期ロードの結果に上書きされる／loadMore が古いカーソルで走ることがある。
 * そのため「初期ロードの描画を待つ → タブ click と scope=following レスポンスを一緒に待つ」
 * という順序で操作する（app 側の race は別途 issue 化）。
 */
export async function showFollowingTimeline(page: Page): Promise<void> {
  await page.goto('/')
  await expect(timeline.composeButton(page)).toBeVisible()
  await expect(page.locator(TIMELINE_SETTLED).first()).toBeVisible()

  await Promise.all([
    page.waitForResponse(
      (r) =>
        /\/api\/posts\?.*scope=following/.test(r.url()) &&
        r.request().method() === 'GET' &&
        r.ok(),
    ),
    timeline.scopeTab(page, 'following').click(),
  ])
  // レスポンス受信後、useTimeline の .then（posts / oldestLoadedId の反映）が回るのを待つ。
  await expect(page.locator(TIMELINE_SETTLED).first()).toBeVisible()
}

/** タイムライン末尾までスクロールして無限スクロールの追加読み込みを起こし、応答を待つ。 */
export async function scrollToLoadMore(page: Page): Promise<void> {
  await Promise.all([
    page.waitForResponse(
      (r) =>
        /\/api\/posts\?.*before_id=/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
    ),
    timeline.sentinel(page).scrollIntoViewIfNeeded(),
  ])
  await expect(postCards(page).last()).toBeVisible()
}
