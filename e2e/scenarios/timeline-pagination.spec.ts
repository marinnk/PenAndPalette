// F-2 タイムライン機能：無限スクロール（画面設計書 S03。末尾で自動的に追加読み込みする）
//
// useTimeline.ts の PAGE_SIZE=20 を踏まえ、20件を超えるイラスト投稿をAPIで用意し、
// スクロールで2ページ目が読み込まれることを確認する。「全体」タブは他specの投稿と混ざるため、
// 誰もフォローしていない新規利用者の「フォロー中」タブ（＝自分の投稿のみ）で件数を厳密に見る。

import { test, expect } from '../support/fixtures'
import { createManyIllustrationPosts } from '../support/api'
import { postCards } from '../support/selectors'
import { showFollowingTimeline, scrollToLoadMore } from '../support/helpers'

const PAGE_SIZE = 20
const TOTAL_POSTS = 25
const PREFIX = 'e2e infinite-scroll post'

test('20件を超える投稿がある場合、スクロールで追加読み込みされる', async ({ authedPage: page }) => {
  await createManyIllustrationPosts(page.request, TOTAL_POSTS, PREFIX)

  await showFollowingTimeline(page)

  const cards = postCards(page)
  await expect(cards).toHaveCount(PAGE_SIZE)

  await scrollToLoadMore(page)
  await expect(cards).toHaveCount(TOTAL_POSTS)

  // #1〜#25 がそれぞれちょうど1回ずつ表示されている（重複読み込みが無い）。
  const texts = await cards.allInnerTexts()
  for (let i = 1; i <= TOTAL_POSTS; i++) {
    const matches = texts.filter((t) => new RegExp(`${PREFIX} #${i}(?!\\d)`).test(t)).length
    expect(matches, `"${PREFIX} #${i}" の表示回数`).toBe(1)
  }
})
