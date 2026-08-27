// F-8 プロフィール機能：自分のプロフィール編集（docs/features/profile.md、画面 S08）
//
// 【前提】アイコン画像のアップロードは MinIO（docker-compose.yml の minio サービス）が必要。
// run-app スキルの手順で `docker compose up -d`（minio・minio-init 含む）していること。

import { test, expect } from '../support/fixtures'
import { profileScreen, profileEditScreen } from '../support/selectors'
import { VALID_JPG } from '../support/fixtureFiles'

test.describe('プロフィール編集', () => {
  test('自己紹介を編集して保存すると、プロフィール画面に反映される', async ({
    authedPage: page,
    user,
  }) => {
    const bio = `e2e bio ${Date.now()}`

    await page.goto(`/profile/${user.id}/edit`)
    await profileEditScreen.bio(page).fill(bio)
    await profileEditScreen.save(page).click()

    await expect(page).toHaveURL(new RegExp(`/profile/${user.id}$`))
    await expect(profileScreen.bio(page)).toHaveText(bio)
  })

  test('アイコン画像をアップロード・削除できる', async ({ authedPage: page, user }) => {
    await page.goto(`/profile/${user.id}/edit`)
    // 初期状態はアイコン未設定（img は無くプレースホルダー）
    await expect(profileEditScreen.avatarImage(page)).toHaveCount(0)

    await profileEditScreen.avatarInput(page).setInputFiles(VALID_JPG)
    await expect(profileEditScreen.avatarImage(page)).toBeVisible()

    await profileEditScreen.avatarRemove(page).click()
    await expect(profileEditScreen.avatarImage(page)).toHaveCount(0)
  })
})
