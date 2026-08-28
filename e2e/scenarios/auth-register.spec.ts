// F-1 ログイン機能：会員登録（docs/features/login.md、画面 S02）

import { test, expect } from '../support/fixtures'
import { registerUser } from '../support/api'
import { E2E_PASSWORD, emailFor, randomE2eUsername } from '../support/testUser'
import { loginScreen, registerScreen, timeline, header, profileScreen } from '../support/selectors'

test.describe('会員登録', () => {
  test('ユーザー名・メールアドレス・パスワードを入力して登録すると、タイムライン画面に遷移する', async ({
    page,
  }) => {
    const username = randomE2eUsername()

    await page.goto('/')
    // 未ログインは /login へ飛ばされる。そこから新規登録画面へ。
    await loginScreen.toRegisterLink(page).click()
    await expect(page).toHaveURL(/\/register$/)

    await registerScreen.usernameInput(page).fill(username)
    await registerScreen.emailInput(page).fill(emailFor(username))
    await registerScreen.passwordInput(page).fill(E2E_PASSWORD)
    await registerScreen.submitButton(page).click()

    await expect(page).toHaveURL(new RegExp('/$'))
    await expect(timeline.composeButton(page)).toBeVisible()
    // ヘッダーのアイコンから自分のプロフィールを開くと、表示名（初期値はユーザー名。
    // RegisterSerializer.create）が出る＝そのユーザーとしてログインできている
    await header.profileLink(page).click()
    await expect(profileScreen.displayName(page)).toHaveText(username)
  })

  test('登録済みのメールアドレスで登録しようとすると、エラーが表示され画面遷移しない', async ({
    page,
    request,
  }) => {
    const existing = await registerUser(request)

    await page.goto('/register')
    await registerScreen.usernameInput(page).fill(randomE2eUsername())
    await registerScreen.emailInput(page).fill(existing.email)
    await registerScreen.passwordInput(page).fill(E2E_PASSWORD)
    await registerScreen.submitButton(page).click()

    await expect(registerScreen.emailError(page)).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })

  test('弱いパスワード（短すぎる）ではエラーになり登録できない', async ({ page }) => {
    const username = randomE2eUsername()

    await page.goto('/register')
    await registerScreen.usernameInput(page).fill(username)
    await registerScreen.emailInput(page).fill(emailFor(username))
    await registerScreen.passwordInput(page).fill('short')
    await registerScreen.submitButton(page).click()

    await expect(registerScreen.passwordError(page)).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })
})
