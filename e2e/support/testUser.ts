// e2e テストが自己登録するダミー利用者に関する共通定義。
//
// 各テストは毎回 POST /api/auth/register で自分専用の利用者を作る（固定シードには依存しない）。
// DBに溜まったこれらの利用者は `e2e_` プレフィックスで判別できるようにし、
// e2e/seed/cleanup.sql で一括削除できるようにする。

export interface TestUser {
  id: number
  username: string
  email: string
  password: string
  displayName: string
}

// Django の AUTH_PASSWORD_VALIDATORS（8文字以上・数字のみ不可・よくある語不可・
// ユーザー名と似すぎない）を満たす固定パスワード。
export const E2E_PASSWORD = 'E2ePassw0rd!'

// e2e_<timestamp>_<random> 形式。複数テストが並列実行されても衝突しないよう、
// タイムスタンプ＋ランダム文字列を組み合わせる。
// 注意: username は50文字まで（backend/users/serializers.py RegisterSerializer）。
// `e2e_` + 13桁timestamp + `_` + 6桁 = 24文字なので収まる。
export function randomE2eUsername(): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  return `e2e_${ts}_${rand}`
}

export function emailFor(username: string): string {
  return `${username}@example.com`
}
