// F-2 タイムライン機能：新着順表示・全体/フォロー中・イラスト/小説の絞り込み
// （docs/features/timeline.md、画面 S03）
//
// 「全体」タブは並列実行中の他specの投稿と混ざるため、件数・並び順を厳密に見る検証は
// 新規利用者（誰もフォローしていない＝自分の投稿だけが出る）の「フォロー中」タブで行う。

import { test, expect } from '../support/fixtures'
import { createIllustrationPost, createNovelPost } from '../support/api'
import { postCards, postCardByText, timeline } from '../support/selectors'
import { showFollowingTimeline } from '../support/helpers'

test.describe('タイムライン', () => {
  test('自分の投稿が新しい順に並ぶ（フォロー中タブ）', async ({ authedPage: page }) => {
    const older = `e2e timeline older ${Date.now()}`
    const newer = `e2e timeline newer ${Date.now()}`
    await createIllustrationPost(page.request, { body: older })
    await createIllustrationPost(page.request, { body: newer })

    await showFollowingTimeline(page)

    const cards = postCards(page)
    await expect(cards).toHaveCount(2)
    await expect(cards.first()).toContainText(newer)
    await expect(cards.nth(1)).toContainText(older)
  })

  test('イラスト／小説タブで投稿種別が絞り込まれる', async ({ authedPage: page }) => {
    const illust = `e2e timeline illust ${Date.now()}`
    const novelTitle = `e2e novel ${Date.now()}`
    await createIllustrationPost(page.request, { body: illust })
    await createNovelPost(page.request, { title: novelTitle, body: 'e2e novel body' })

    await showFollowingTimeline(page)
    await expect(postCardByText(page, illust)).toBeVisible()
    await expect(postCardByText(page, novelTitle)).toHaveCount(0)

    await timeline.typeTab(page, 'novel').click()
    await expect(postCardByText(page, `【${novelTitle}】`)).toBeVisible()
    await expect(postCardByText(page, illust)).toHaveCount(0)
  })

  test('投稿がない種別では空状態メッセージが表示される', async ({ authedPage: page }) => {
    await showFollowingTimeline(page)
    await timeline.typeTab(page, 'novel').click()
    await expect(timeline.empty(page)).toBeVisible()
  })
})
