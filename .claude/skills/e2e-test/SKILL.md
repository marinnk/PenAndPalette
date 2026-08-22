---
name: e2e-test
description: Run the Playwright E2E tests under e2e/ on demand — functional scenario tests (F-1〜F-10 user flows from docs/features/ — login, timeline, post, comment, like/want, request, follow, profile, user search — intended to also run automatically in CI on every PR/push to main once set up) and browser performance/timing tests (login, post submission, infinite scroll, search latency; on-demand only, excluded from CI). Use whenever the user asks to run "E2Eテスト"/"E2Eテストを実行"/"Playwrightテスト"/an end-to-end or browser functional test, or asks to measure real-browser page/interaction timing (distinct from k6 load tests or Lighthouse audits under perf-tests/).
---

# E2Eテスト（Playwright）の実行手順

`e2e/`配下のPlaywrightテストを実行する手順。姉妹プロジェクト[RaiseTechSNS](../../../../RaiseTechSNS/.claude/skills/e2e-test/SKILL.md)と同じ2トラック構成を踏襲する。

**このディレクトリ・スキルは現時点ではテンプレート。** `backend/`・`frontend/`の実装セットアップより前の段階では`e2e/`ディレクトリ自体が存在しない。実装が進み、Playwrightをセットアップする段階になったら、以下の方針に沿って`e2e/README.md`・`e2e/run.sh`・各specを整備し、このSKILL.mdの具体的なコマンドを実際のものに更新すること。

## 2トラックの方針

- **scenarios** — 機能シナリオテスト。[docs/features/index.md](../../../docs/features/index.md)のF-1〜F-10（会員登録・ログイン・タイムライン・投稿・コメント・いいね/かきたい・リクエスト・フォロー・プロフィール・ユーザー検索）のユーザーフローを実ブラウザで検証する。CIをセットアップした際は、PR作成時・mainへのpush時に自動実行する対象にする
- **performance** — ブラウザパフォーマンステスト。ログイン・投稿・無限スクロール・検索など、複数ステップにまたがる操作の体感時間（ms）を計測する。lint/test/build・CIのいずれにも組み込まない、**開発者が任意のタイミングで手動実行するもの**（[perf-test skill](../perf-test/SKILL.md)と同じ方針。しきい値ベースの計測はCI環境のCPU競合で不安定になりやすいため）

`perf-tests/`（バックエンドAPI負荷試験のk6・タイムライン単体監査のLighthouse）とは測定対象が異なる点に注意（[perf-test skill](../perf-test/SKILL.md)参照）。

- `perf-tests/k6/` — バックエンドAPIへの同時アクセス負荷（サーバー・DB側の挙動）
- `perf-tests/frontend/`（Lighthouse） — タイムライン単体ページの読み込み品質監査（Core Web Vitals）
- `e2e/performance/` — 実ブラウザで1利用者が一連の操作をしたときの体感時間（クリック→通信→再描画までの合計時間）。「投稿してから一覧に反映されるまで」「新着通知バナーをクリックしてから反映されるまで」のような、複数ステップにまたがる操作の実測

## 0. どのトラックを実行するか判断する

ユーザーの依頼から以下を判断する。曖昧な場合は、まずscenariosを実行し、結果を見せた上でperformanceも実行するかをユーザーに確認する。

- 対象トラック：scenarios（機能シナリオ）／performance（画面・操作の時間計測）／両方
- 特定specの指定があれば、それだけを実行する

## 1. 前提環境を起動する

[run-app skill](../run-app/SKILL.md)の手順でbackend（8000）・frontend（5173）・DB（3306）を起動する。画像アップロードを伴うシナリオ（アバター・投稿・コメント画像）を実行するならMinIOも（`docker compose up -d`で一緒に起動する）。

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/auth/me
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

## 2. 初回のみ：Playwright本体のインストール

```sh
cd e2e
npm install
npx playwright install chromium
```

## 3. 実行する

```sh
./e2e/run.sh scenarios
./e2e/run.sh performance
./e2e/run.sh scenarios post-detail.spec.ts   # 特定specのみ
```

`run.sh`は実行前にbackend・frontendのヘルスチェックを行い、実行後は`e2e/results/<track>/`にHTMLレポートを保存する想定（直近5件のみ保持）。

## 4. 結果を報告する

- **scenarios**：成功/失敗したspec名。失敗時はスクリーンショット・トレースのパス（`npx playwright show-trace`で開ける旨も伝える）
- **performance**：各journeyの実測ms・しきい値・超過の有無。非機能要件が緩いプロジェクトである点を踏まえ、目安であってSLAではない旨を添える（[基本設計書 5章](../../../docs/basic-design.md#5-非機能要件)参照）

## 5. 後片付け

各テストが登録用APIで`e2e_`プレフィックス付きのダミー利用者を自己登録する設計にする想定のため、実行するたびにDBへ蓄積する。**ユーザーに確認した上で**、クリーンアップ（該当ユーザーの削除）の実行を提案する（無断では実行しない。DBを直接操作する破壊的操作のため）。

サーバーの停止については[run-app skill](../run-app/SKILL.md)参照（ユーザーが引き続き動作確認等で使う様子なら、勝手に止めずに確認する）。
