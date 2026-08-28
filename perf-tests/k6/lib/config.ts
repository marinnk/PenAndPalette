// perf-tests 全体で共有する設定値。
// BASE_URL は環境変数で切り替えられる（既定はローカルのバックエンド）。
//   例: k6 run -e BASE_URL=http://localhost:8000 perf-tests/k6/scenarios/timeline-read.ts
export const BASE_URL: string = __ENV.BASE_URL || 'http://localhost:8000';

// backend/core/management/commands/seed_perf_data.py で投入するダミーユーザーの範囲・共通パスワード。
// 詳細は perf-tests/seed/README.md を参照。
export const SEED_USER_COUNT = 500;
export const SEED_USER_PASSWORD = 'Passw0rd!';

// seed_perf_data が全フォロワーを付与する「人気ユーザー」。
// フォロワー一覧（非ページネーション）・プロフィール（フォロワー数集計）の負荷試験対象。
export const POPULAR_USERNAME = 'perf_user_0001';

export function seedUsername(n: number): string {
  return `perf_user_${String(n).padStart(4, '0')}`;
}

export function seedEmail(n: number): string {
  return `${seedUsername(n)}@example.com`;
}
