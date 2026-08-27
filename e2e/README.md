## e2e

PenAndPalette の E2E テスト一式（Playwright）。姉妹プロジェクト
[RaiseTechSNS](../../RaiseTechSNS/e2e) の構成を、Django + Vue + MySQL のスタックへ読み替えたもの。

### 2つのトラック

- **[scenarios/](scenarios/)** — 機能シナリオテスト。[docs/features/index.md](../docs/features/index.md)
  の F-1〜F-11（会員登録・ログイン・タイムライン・投稿・コメント・いいね/かきたい・リクエスト・
  フォロー・プロフィール・ユーザー検索・分類タグ）のユーザーフローを実ブラウザで検証する。
  PR 作成時・main への push 時に [CI](../.github/workflows/ci.yml) で自動実行される
- **[performance/](performance/)** — ブラウザパフォーマンステスト。ログイン・投稿・無限スクロール・
  検索など、複数ステップにまたがる操作の体感時間（ms）を計測する。lint / test / build・CI の
  いずれにも組み込まれていない、**開発者が任意のタイミングで手動実行するもの**
  （しきい値ベースの計測は CI 環境の CPU 競合で不安定になりやすいため）

### 事前準備

1. 依存サービスを起動する（MySQL 3306・MinIO 9000）:

   ```sh
   docker compose up -d
   ```

2. [.claude/skills/run-app/SKILL.md](../.claude/skills/run-app/SKILL.md) の手順で
   backend（**8000**）・frontend（**5173**）を起動する。ポートは固定。別ポートで起動された状態では
   CORS / Cookie が通らずテストが失敗する。

3. 初回のみ、Playwright 本体（Chromium のみ）をインストールする:

   ```sh
   cd e2e
   npm install
   npx playwright install chromium
   ```

### テストデータ戦略

各テスト（またはフィクスチャ）が `POST /api/auth/register` で `e2e_<timestamp>_<random>` という
ユニークなユーザー名を都度自前登録する（[support/api.ts](support/api.ts)・
[support/fixtures.ts](support/fixtures.ts) 参照）。固定シードには依存しない。

このため、テストを実行するたびに DB へ `e2e_` 利用者が蓄積する。不要になったら
[seed/cleanup.sql](seed/README.md) で一括削除できる（自動実行はされない。破壊的操作のため）。

### scenarios の実行

```sh
./e2e/run.sh scenarios
./e2e/run.sh scenarios post-novel.spec.ts   # 特定specのみ
```

内部で backend・frontend のヘルスチェックを行ってから `playwright test --project=scenarios` を
実行する。ヘルスチェックを省いて素早く回したい場合（実装中の反復実行等）は、`e2e` 配下で
`npm run test:scenarios` を直接使ってもよい。

### performance の実行

```sh
./e2e/run.sh performance
```

`e2e/results/performance/performance-<timestamp>.json` に、計測した各操作（journey）の実測 ms・
しきい値・超過の有無が出力される。しきい値は **「劣化に気づくための目安」であり厳密な SLA ではない**
（[基本設計書 5章](../docs/basic-design.md#5-非機能要件) の非機能要件が学習用途規模を前提としているため）。
[performance/](performance/) 配下の各 spec のしきい値は暫定値のため、一度実行して得られる実測値を
もとに調整すること。

`npm run dev`（未バンドルの Vite 開発サーバー）に対する計測は本番ビルドより悪化して見える。
本番相当の数値が必要な場合:

```sh
cd frontend && npm run build && npm run preview   # 4173番で起動
E2E_BASE_URL=http://localhost:4173 ./e2e/run.sh performance
```

### レポート

`e2e/results/`（Git 管理対象外）に出力する。直近5件のみ保持し、古いものは `run.sh` が自動削除する。

- `e2e/results/scenarios/scenarios-<timestamp>/index.html` — Playwright の HTML レポート
  （失敗時のスクリーンショット・トレースを含む。`npx playwright show-trace <trace.zip>` で開ける）
- `e2e/results/performance/performance-<timestamp>.json` — 計測結果のサマリー

`e2e` 配下で `npm run report` を実行すると、直近の実行結果（`playwright-report/`）をブラウザで開ける。

### 既知の制約

- **タイムラインの30秒間隔ポーリング（新着投稿バナー）はテスト対象外**。1テストあたり30秒以上を
  要し、日常的に回す E2E スイートには見合わないため意図的に除外している。必要になれば、バックエンドの
  ポーリング間隔を環境変数化してテスト時だけ短縮する等の対応を別 Issue で検討する
- **セレクタは `data-testid`（`getByTestId`）を第一選択にする**。RaiseTechSNS の e2e は
  `data-testid` を禁止しアクセシブルロケーターのみを使うが、本プロジェクトのフロントエンドは
  全画面で `data-testid` を一貫採用しており、既存の Vitest テストもそれに倣っているため
  （[support/selectors.ts](support/selectors.ts) 参照）

### 後片付け

検証のためだけに起動したサーバーは、作業終了時に停止する
（[.claude/skills/run-app/SKILL.md](../.claude/skills/run-app/SKILL.md) 参照）。
蓄積した `e2e_` 利用者の削除は [seed/README.md](seed/README.md) を参照。
