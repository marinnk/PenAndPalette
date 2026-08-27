---
name: e2e-test
description: Run the Playwright E2E tests under e2e/ on demand — functional scenario tests (F-1〜F-11 user flows from docs/features/ — login, timeline, post (illustration/novel + classification tags), comment, like/want, request, follow, profile, user search) that also run automatically in CI on every PR/push to main, and browser performance/timing tests (login, post submission, infinite scroll, search latency; on-demand only, excluded from CI). Use whenever the user asks to run "E2Eテスト"/"E2Eテストを実行"/"Playwrightテスト"/an end-to-end or browser functional test, or asks to measure real-browser page/interaction timing (distinct from k6 load tests or Lighthouse audits under perf-tests/).
---

# E2Eテスト（Playwright）の実行手順

`e2e/` 配下の Playwright テストを実行する手順。姉妹プロジェクト
[RaiseTechSNS](../../../../RaiseTechSNS/.claude/skills/e2e-test/SKILL.md) の2トラック構成を、
Django + Vue + MySQL のスタックへ読み替えたもの。詳細は [e2e/README.md](../../../e2e/README.md) を参照。

## 2トラックの方針

- **scenarios** — 機能シナリオテスト。[docs/features/index.md](../../../docs/features/index.md) の
  F-1〜F-11 のユーザーフローを実ブラウザで検証する。**PR 作成時・main への push 時に
  [CI](../../../.github/workflows/ci.yml)（`e2e-scenarios` ジョブ）で自動実行される**
- **performance** — ブラウザパフォーマンステスト。ログイン・投稿・無限スクロール・検索などの
  体感時間（ms）を計測する。lint / test / build・CI のいずれにも組み込まない、**開発者が任意の
  タイミングで手動実行するもの**（しきい値ベースの計測は CI 環境の CPU 競合で不安定になりやすいため。
  [perf-test skill](../perf-test/SKILL.md) と同じ方針）

`perf-tests/`（バックエンドAPI負荷試験のk6・タイムライン単体監査のLighthouse）とは測定対象が
異なる点に注意（[perf-test skill](../perf-test/SKILL.md) 参照）。

- `perf-tests/k6/` — バックエンドAPIへの同時アクセス負荷（サーバー・DB側の挙動）
- `perf-tests/frontend/`（Lighthouse） — タイムライン単体ページの読み込み品質監査（Core Web Vitals）
- `e2e/performance/` — 実ブラウザで1利用者が一連の操作をしたときの体感時間（クリック→通信→
  再描画までの合計時間）。「投稿してから一覧に反映されるまで」のような複数ステップの実測

## 0. どのトラックを実行するか判断する

ユーザーの依頼から判断する。曖昧な場合は、まず scenarios を実行し、結果を見せた上で performance も
実行するかをユーザーに確認する。特定 spec の指定があればそれだけを実行する。

## 1. 前提環境を起動する

[run-app skill](../run-app/SKILL.md) の手順で backend（**8000**）・frontend（**5173**）・
DB（MySQL **3306**）を起動する。画像アップロードを伴うシナリオ（イラスト投稿・コメント画像・
アイコン画像）を実行するなら MinIO（9000）も（`docker compose up -d` で一緒に起動する）。

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

## 2. 初回のみ：Playwright 本体のインストール

```sh
cd e2e
npm install
npx playwright install chromium
```

## 3. 実行する

```sh
./e2e/run.sh scenarios
./e2e/run.sh performance
./e2e/run.sh scenarios post-novel.spec.ts   # 特定specのみ
```

`run.sh` は実行前に backend・frontend のヘルスチェックを行い、実行後は
`e2e/results/<track>/<track>-<timestamp>/` に HTML レポートを保存する（直近5件のみ保持）。
ヘルスチェックを省いて素早く回したい場合は `e2e` 配下で `npm run test:scenarios` を直接使ってもよい。

## 4. 結果を報告する

- **scenarios**：成功/失敗した spec 名。失敗時はスクリーンショット・トレースのパス
  （`npx playwright show-trace <trace.zip>` で開ける旨も伝える）。CI では失敗時に
  `playwright-report` がアーティファクトとしてアップロードされる
- **performance**：各 journey の実測 ms・しきい値・超過の有無（`e2e/results/performance/
  performance-<timestamp>.json`）。しきい値は目安であって SLA ではない旨を添える
  （[基本設計書 5章](../../../docs/basic-design.md#5-非機能要件) 参照）

## 5. 後片付け

各テストは登録用APIで `e2e_` プレフィックス付きのダミー利用者を自己登録するため、実行のたびに
DBへ蓄積する。**ユーザーに確認した上で**、クリーンアップの実行を提案する（無断では実行しない。
DBを直接操作する破壊的操作のため）。

```sh
docker exec -i pen-and-palette-db mysql -uroot -proot pen_and_palette < e2e/seed/cleanup.sql
```

サーバーの停止については [run-app skill](../run-app/SKILL.md) 参照（ユーザーが引き続き
動作確認等で使う様子なら、勝手に止めずに確認する）。
