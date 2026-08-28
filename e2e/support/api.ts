// バックエンドAPIを直接叩くヘルパー群。
//
// Playwrightの APIRequestContext（`page.request` / `context.request`）は、そのページ／コンテキストと
// 同じCookie（access_token・refresh_token / HttpOnly）を共有する（基本設計書3章の認証方式）。
// このため手動でのCookie注入・Bearerトークン処理は不要で、`registerUser` / `loginViaApi` を
// `page.request` 経由で呼べば、その後の `page.goto('/')` はログイン済み状態で開ける。
//
// 「検証対象ではない前提データ」（例：いいね対象の投稿、無限スクロール用の大量投稿）は
// UIを何度も操作するのではなく、これらの API ヘルパーで用意する。UIは検証対象の操作のみで駆動する。

import type { APIRequestContext, APIResponse } from '@playwright/test'
import { E2E_PASSWORD, emailFor, randomE2eUsername, type TestUser } from './testUser'
import { VALID_JPG, readFixture } from './fixtureFiles'

// Playwrightの request はフロントエンド（5173）を baseURL にして相対パスを解決するため、
// `/api/...` のままでは backend（8000）ではなくフロントへ飛んでしまう。APIヘルパーは常に
// backend の絶対URLを組み立てる。
const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8000'

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

async function assertOk(res: APIResponse, label: string): Promise<APIResponse> {
  if (!res.ok()) {
    throw new Error(`${label} failed: ${res.status()} ${await res.text()}`)
  }
  return res
}

interface AuthUserResponse {
  id: number
  display_name: string
}

/**
 * POST /api/auth/register で e2e_ プレフィックス付きの新規利用者を登録する。
 * backend（RegisterView）は登録時点でログインと同じくCookieを発行するため、
 * この request コンテキスト内では登録後に別途ログインを呼ぶ必要はない。
 */
export async function registerUser(request: APIRequestContext): Promise<TestUser> {
  const username = randomE2eUsername()
  const email = emailFor(username)
  const res = await assertOk(
    await request.post(apiUrl('/api/auth/register'), {
      data: { username, email, password: E2E_PASSWORD },
    }),
    'registerUser',
  )
  const body = (await res.json()) as AuthUserResponse
  return { id: body.id, username, email, password: E2E_PASSWORD, displayName: body.display_name }
}

/** POST /api/auth/login。登録済み利用者で別コンテキストにログインし直したい場合に使う。 */
export async function loginViaApi(
  request: APIRequestContext,
  user: Pick<TestUser, 'email' | 'password'>,
): Promise<void> {
  await assertOk(
    await request.post(apiUrl('/api/auth/login'), {
      data: { email: user.email, password: user.password },
    }),
    'loginViaApi',
  )
}

export interface Tag {
  id: number
  name: string
}

/** GET /api/tags。固定の分類タグ12件（display_order順）を配列で返す。 */
export async function getTags(request: APIRequestContext): Promise<Tag[]> {
  const res = await assertOk(await request.get(apiUrl('/api/tags')), 'getTags')
  return (await res.json()) as Tag[]
}

function imagePart(fixturePath: string) {
  return new Blob([new Uint8Array(readFixture(fixturePath))], { type: 'image/jpeg' })
}

/**
 * POST /api/posts（multipart/form-data）でイラスト投稿を作成する。
 * イラスト投稿は画像1〜4枚必須（`images` を繰り返し送る）。frontend の usePostCreate.ts と同じ形。
 */
export async function createIllustrationPost(
  request: APIRequestContext,
  opts: { body?: string; images?: string[]; tagIds?: number[] } = {},
): Promise<number> {
  const form = new FormData()
  form.append('post_type', 'illustration')
  form.append('title', '')
  if (opts.body) form.append('body', opts.body)
  for (const path of opts.images ?? [VALID_JPG]) form.append('images', imagePart(path), 'image.jpg')
  for (const id of opts.tagIds ?? []) form.append('tag_ids', String(id))

  const res = await assertOk(
    await request.post(apiUrl('/api/posts'), { multipart: form }),
    'createIllustrationPost',
  )
  return ((await res.json()) as { id: number }).id
}

/**
 * POST /api/posts（multipart/form-data）で小説投稿を作成する。
 * 小説投稿はタイトル・本文必須、カバー画像は0〜1枚。
 */
export async function createNovelPost(
  request: APIRequestContext,
  opts: { title: string; body: string; coverImage?: string; tagIds?: number[] },
): Promise<number> {
  const form = new FormData()
  form.append('post_type', 'novel')
  form.append('title', opts.title)
  form.append('body', opts.body)
  if (opts.coverImage) form.append('images', imagePart(opts.coverImage), 'cover.jpg')
  for (const id of opts.tagIds ?? []) form.append('tag_ids', String(id))

  const res = await assertOk(
    await request.post(apiUrl('/api/posts'), { multipart: form }),
    'createNovelPost',
  )
  return ((await res.json()) as { id: number }).id
}

/** POST /api/posts/{id}/likes。投稿にいいねする（プロフィールの「ブックマーク」タブ＝
 * いいねした作品一覧の前提データ用）。いいねは冪等なので重複呼び出ししても200。 */
export async function likePost(request: APIRequestContext, postId: number): Promise<void> {
  await assertOk(await request.post(apiUrl(`/api/posts/${postId}/likes`)), 'likePost')
}

/**
 * 無限スクロール検証用に、イラスト投稿を指定件数、本文に連番を付けて作成する。
 * 消費側（timeline-pagination / *-timing）は作成順を検証しないため、少しずつ並行で投げて速くする。
 */
export async function createManyIllustrationPosts(
  request: APIRequestContext,
  count: number,
  prefix = 'e2e infinite-scroll post',
): Promise<void> {
  const BATCH = 5
  for (let start = 0; start < count; start += BATCH) {
    const batch = Array.from({ length: Math.min(BATCH, count - start) }, (_, i) =>
      createIllustrationPost(request, { body: `${prefix} #${start + i + 1}` }),
    )
    await Promise.all(batch)
  }
}
