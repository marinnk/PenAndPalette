// F-1 ログイン機能：ログイン・未ログインガード・ログアウト（docs/features/login.md、画面 S01）

import { test, expect } from '../support/fixtures'
import { registerUser } from '../support/api'
import { loginScreen, timeline, header } from '../support/selectors'

test.describe('ログイン', () => {
  test('正しいメールアドレス・パスワードでログインすると、タイムライン画面に遷移する', async ({
    page,
    request,
  }) => {
    const user = await registerUser(request)

    await page.goto('/login')
    await loginScreen.emailInput(page).fill(user.email)
    await loginScreen.passwordInput(page).fill(user.password)
    await loginScreen.submitButton(page).click()

    await expect(page).toHaveURL(new RegExp('/$'))
    await expect(timeline.composeButton(page)).toBeVisible()
  })

  test('誤ったパスワードではエラーが表示され、ログイン画面のままになる', async ({ page, request }) => {
    const user = await registerUser(request)

    await page.goto('/login')
    await loginScreen.emailInput(page).fill(user.email)
    await loginScreen.passwordInput(page).fill('wrong-password-123')
    await loginScreen.submitButton(page).click()

    await expect(loginScreen.error(page)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('未ログインで保護された画面を開くと、ログイン画面へリダイレクトされる', async ({ page }) => {
    await page.goto('/posts/new')
    await expect(page).toHaveURL(/\/login$/)
    await expect(loginScreen.submitButton(page)).toBeVisible()
  })
})

test.describe('ログアウト', () => {
  test('ログアウトするとログイン画面に戻り、リロードしてもログイン画面のままになる', async ({
    authedPage: page,
  }) => {
    await header.logoutButton(page).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.reload()
    await expect(page).toHaveURL(/\/login$/)
    await expect(loginScreen.submitButton(page)).toBeVisible()
  })
})
