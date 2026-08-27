// Playwrightのカスタムフィクスチャ（test.extend）。
//
// `user` の登録は共有の `request` フィクスチャ（page とは別の APIRequestContext）で行うため、
// そのCookieは page のブラウザコンテキストとは共有されない。そのため `authedPage` は
// `user` のメールアドレス・パスワードで改めて `page.request` 経由のログインを行い、
// page のコンテキストに Cookie を載せてから `/` を開く。
//
// 2人目の利用者は用途で使い分ける：
//   - `secondUserRequest` … API だけで前提データ（相手の投稿・フォロー等）を作る場合。ブラウザ不要。
//   - `secondUserPage`   … 2人目として画面を操作する場合（別ブラウザコンテキスト）。

import { test as base, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test'
import { loginViaApi, registerUser } from './api'
import { timeline } from './selectors'
import type { TestUser } from './testUser'

interface Fixtures {
  user: TestUser
  authedPage: Page
  secondUser: TestUser
  secondUserRequest: APIRequestContext
  secondUserPage: Page
}

async function waitForTimelineReady(page: Page) {
  // ルーターガードは GET /api/auth/me の完了を待ってから画面を出す。ログイン済み状態が
  // 安定してから後続の操作に入るため、タイムライン画面の目印（投稿ボタン）を待つ。
  await expect(timeline.composeButton(page)).toBeVisible()
}

export const test = base.extend<Fixtures>({
  user: async ({ request }, use) => {
    await use(await registerUser(request))
  },

  authedPage: async ({ page, user }, use) => {
    await loginViaApi(page.request, user)
    await page.goto('/')
    await waitForTimelineReady(page)
    await use(page)
  },

  secondUser: async ({}, use) => {
    // page とも user（共有 request）ともCookieを共有しない独立コンテキストで登録する。
    const context = await playwrightRequest.newContext()
    const user = await registerUser(context)
    await use(user)
    await context.dispose()
  },

  // 2人目としてAPIを叩くための、ログイン済み APIRequestContext（ブラウザページは持たない）。
  secondUserRequest: async ({ secondUser }, use) => {
    const context = await playwrightRequest.newContext()
    await loginViaApi(context, secondUser)
    await use(context)
    await context.dispose()
  },

  secondUserPage: async ({ browser, secondUser }, use) => {
    const context = await browser.newContext()
    await loginViaApi(context.request, secondUser)
    const page = await context.newPage()
    await page.goto('/')
    await waitForTimelineReady(page)
    await use(page)
    await context.close()
  },
})

export { expect }
