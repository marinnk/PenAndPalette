// 画面ごとの小さなロケーターヘルパー。複数specで繰り返す testid / 構造を1箇所へまとめる。
//
// 【方針】姉妹プロジェクト RaiseTechSNS の e2e は `data-testid` を禁止しアクセシブルロケーター
// （getByRole / getByLabel）のみを使うが、本プロジェクトのフロントエンドは全画面で `data-testid`
// を一貫して採用しており、既存の Vitest + Testing Library のテストも `getByTestId` 主体で書かれている
// （frontend/src/**/*.test.ts）。E2E もそれに合わせ `page.getByTestId(...)` を第一選択にする。
// page-object 的な重い抽象化は避け、spec 内で直接 getByTestId を書いてもよい。
//
// ここにあるのは実際に spec で使われているものだけ。新しい画面要素を触るときに追加する。

import type { Locator, Page } from '@playwright/test'

type Scope = Page | Locator

export const loginScreen = {
  emailInput: (page: Page) => page.getByTestId('login-email'),
  passwordInput: (page: Page) => page.getByTestId('login-password'),
  submitButton: (page: Page) => page.getByTestId('login-submit'),
  error: (page: Page) => page.getByTestId('login-error'),
  toRegisterLink: (page: Page) => page.getByTestId('login-to-register-link'),
}

export const registerScreen = {
  usernameInput: (page: Page) => page.getByTestId('register-username'),
  emailInput: (page: Page) => page.getByTestId('register-email'),
  passwordInput: (page: Page) => page.getByTestId('register-password'),
  submitButton: (page: Page) => page.getByTestId('register-submit'),
  emailError: (page: Page) => page.getByTestId('register-email-error'),
  passwordError: (page: Page) => page.getByTestId('register-password-error'),
}

export const header = {
  logoutButton: (page: Page) => page.getByTestId('header-logout-button'),
  profileLink: (page: Page) => page.getByTestId('header-profile-link'),
  requestBadge: (page: Page) => page.getByTestId('header-request-badge'),
  searchInput: (page: Page) => page.getByTestId('header-search-input'),
  searchSubmit: (page: Page) => page.getByTestId('header-search-submit'),
}

export const timeline = {
  composeButton: (page: Page) => page.getByTestId('compose-button'),
  scopeTab: (page: Page, scope: 'all' | 'following') => page.getByTestId(`tab-${scope}`),
  typeTab: (page: Page, type: 'illustration' | 'novel') => page.getByTestId(`tab-${type}`),
  empty: (page: Page) => page.getByTestId('timeline-empty'),
  sentinel: (page: Page) => page.getByTestId('timeline-sentinel'),
  filterToggle: (page: Page) => page.getByTestId('filter-toggle'),
  filterTag: (page: Page, tagId: number) => page.getByTestId(`filter-tag-${tagId}`),
}

// 投稿カード（article[data-testid="post-card-{id}"]）。styling クラス `.post-card` ではなく
// testid の前方一致で辿る。
export function postCards(scope: Scope): Locator {
  return scope.locator('[data-testid^="post-card-"]')
}
export function postCard(scope: Scope, postId: number): Locator {
  return scope.locator(`[data-testid="post-card-${postId}"]`)
}
export function postCardByText(page: Page, snippet: string): Locator {
  return page.locator('[data-testid^="post-card-"]', { hasText: snippet })
}

export const postCardActions = {
  editButton: (page: Page, id: number) => page.getByTestId(`edit-button-${id}`),
  deleteButton: (page: Page, id: number) => page.getByTestId(`delete-button-${id}`),
  likeButton: (page: Page, id: number) => page.getByTestId(`like-button-${id}`),
  wantButton: (page: Page, id: number) => page.getByTestId(`want-button-${id}`),
}

// 投稿作成／編集画面（PostComposeForm.vue）。ルートは /posts/new と /posts/:id/edit。
export const composeForm = {
  typeNovel: (page: Page) => page.getByTestId('post-type-novel'),
  title: (page: Page) => page.getByTestId('post-title'),
  body: (page: Page) => page.getByTestId('post-body'),
  bodyCounter: (page: Page) => page.getByTestId('post-body-counter'),
  imageInput: (page: Page) => page.getByTestId('post-image-input'),
  imagePickError: (page: Page) => page.getByTestId('post-image-pick-error'),
  imageRemove: (page: Page, i: number) => page.getByTestId(`post-image-remove-${i}`),
  tag: (page: Page, tagId: number) => page.getByTestId(`post-tag-${tagId}`),
  submit: (page: Page) => page.getByTestId('post-compose-submit'),
}

// 投稿詳細画面のコメント（li[data-testid="comment-item-{id}"]）。
export function commentItems(page: Page): Locator {
  return page.locator('[data-testid^="comment-item-"]')
}
export function commentItemByText(page: Page, snippet: string): Locator {
  return page.locator('[data-testid^="comment-item-"]', { hasText: snippet })
}

export const commentForm = {
  body: (page: Page) => page.getByTestId('comment-body'),
  imageInput: (page: Page) => page.getByTestId('comment-image-input'),
  submit: (page: Page) => page.getByTestId('comment-compose-submit'),
}

export const profileScreen = {
  displayName: (page: Page) => page.getByTestId('profile-display-name'),
  bio: (page: Page) => page.getByTestId('profile-bio'),
  followerCount: (page: Page) => page.getByTestId('profile-follower-count'),
  editButton: (page: Page) => page.getByTestId('profile-edit-button'),
  composeButton: (page: Page) => page.getByTestId('profile-compose-button'),
  followButton: (page: Page) => page.getByTestId('profile-follow-button'),
  requestButton: (page: Page) => page.getByTestId('profile-request-button'),
  postsEmpty: (page: Page) => page.getByTestId('profile-posts-empty'),
}

export const profileEditScreen = {
  avatarInput: (page: Page) => page.getByTestId('profile-edit-avatar-input'),
  avatarRemove: (page: Page) => page.getByTestId('profile-edit-avatar-remove'),
  avatarImage: (page: Page) => page.getByTestId('profile-edit-avatar-image'),
  bio: (page: Page) => page.getByTestId('profile-edit-bio'),
  save: (page: Page) => page.getByTestId('profile-edit-save'),
}

export const followListScreen = {
  item: (page: Page, userId: number) => page.getByTestId(`follow-list-item-${userId}`),
}

export const searchScreen = {
  keywordInput: (page: Page) => page.getByTestId('user-search-keyword'),
  submitButton: (page: Page) => page.getByTestId('user-search-submit'),
  empty: (page: Page) => page.getByTestId('user-search-empty'),
  resultItem: (page: Page, userId: number) => page.getByTestId(`user-search-item-${userId}`),
}

export const requestForm = {
  message: (page: Page) => page.getByTestId('request-message'),
  pickerToggle: (page: Page) => page.getByTestId('request-related-post-picker-toggle'),
  pickerTabOwn: (page: Page) => page.getByTestId('request-related-post-tab-own'),
  pickerOption: (page: Page, postId: number) =>
    page.getByTestId(`request-related-post-option-${postId}`),
  relatedPostClear: (page: Page) => page.getByTestId('request-related-post-clear'),
  submit: (page: Page) => page.getByTestId('request-compose-submit'),
}
