import { defineConfig, devices } from '@playwright/test'

// 本プロジェクトのフロントエンドはVue Router（createWebHistory）を使うため、各テストは
// `/posts/new` などのURLへ直接遷移（deep link）できる。ただし backend（8000）・frontend（5173）・
// DB（3306）・MinIO（9000）の起動はこのconfigでは行わず、run-appスキルと同じく手動起動を前提に、
// e2e/run.sh が実行前にヘルスチェックする（固定ポート運用・「黙って別ポートに逃げない」という
// run-appスキルの方針と、configのwebServer自動起動は相性が悪いため）。
//
// baseURL は E2E_BASE_URL で上書きできる（本番ビルド計測時は `npm run preview` の 4173 を指定。
// e2e/README.md 参照）。API を直接叩くヘルパー（support/api.ts）は別途 E2E_API_BASE_URL
// （既定 http://localhost:8000）を使う。
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  // ローカルは0（flakyに即気づく）。CIは共有MySQL・共有タイムラインへの並列アクセスで
  // まれに競合しうるため2回まで再試行する。
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    // performanceプロジェクトの計測結果集計。scenariosプロジェクトのテストは内部でフィルタし無視する
    // （support/perfReporter.ts 参照。Playwrightにプロジェクト単位でレポーターを切り替える仕組みが無いため）
    ['./support/perfReporter.ts'],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'scenarios',
      testDir: './scenarios',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'performance',
      testDir: './performance',
      use: { ...devices['Desktop Chrome'] },
      // 時間計測がCPU競合でぶれないよう、performanceトラックだけは直列実行に固定する
      fullyParallel: false,
      workers: 1,
    },
  ],
})
