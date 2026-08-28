---
name: perf-test
description: Run the on-demand performance tests under perf-tests/ — k6 load tests against backend API endpoints (timeline, login, post creation, likes/wants/comments, profile, followers list, requests list) and a Lighthouse audit of the frontend timeline screen. Use whenever the user asks to run a "パフォーマンステスト"/"負荷試験"/"performance test"/"load test", or asks to run k6 or Lighthouse against this app. These are never run automatically (not part of CI/lint/test) — only when explicitly requested.
---

# パフォーマンステストの実行手順

`perf-tests/` 配下の k6 シナリオ（バックエンド API 負荷試験）・Lighthouse 監査（フロントエンド画面性能）を
実行する手順。詳細は [perf-tests/README.md](../../../perf-tests/README.md) を参照。

**これらは常にオンデマンド実行。** ユーザーから明示的に頼まれたときだけ実行し、lint/test/build の
一部として自動実行してはならない。

`docs/basic-design.md` の非機能要件は「学習利用を前提とし、大量アクセス・大量データは考慮しない」と
しているため、目的は本番並みの負荷への耐性証明ではなく、設計判断（カーソルページネーション＋
30 秒ポーリング、`annotate()` 集計、フォロワー一覧等の意図的な非ページネーション）が実際にどう
振る舞うかを手元で確認できるようにすること。

## 0. どのテストを実行するか判断する

ユーザーの依頼から以下を判断する。曖昧な場合は AskUserQuestion 等で確認せず、**まず smoke モードで
全シナリオを実行し**、問題なければ結果を見せた上で「load モードや個別シナリオも実行するか」を確認する
（負荷をかける実行はいきなり長時間・広範囲に行わない）。

- 対象トラック：バックエンド（k6）／フロントエンド（Lighthouse）／両方
- k6 のモード：`smoke`（既定・数秒）／`load`（20VU までランプアップし数分）
- 特定のシナリオ名の指定があれば、それだけを実行する

## 1. 前提環境を起動する

[run-app skill](../run-app/SKILL.md) の手順で backend（8000）・DB（3306）を起動する。Lighthouse トラックも
実行する場合は frontend（5173）も起動する。k6 のみなら frontend は不要。

```sh
docker compose up -d db
cd backend && source .venv/bin/activate
python manage.py runserver 8000   # 別ターミナルで起動したまま以降を実行する
```

起動確認：

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/health   # 200
```

## 2. シードデータを投入する（未投入・または書き込みシナリオ実行後）

```sh
cd backend && source .venv/bin/activate
python manage.py seed_perf_data     # 500 ユーザー / 1 万投稿。冪等（perf_user_% を消して再投入）
```

未投入だとログインに失敗し全シナリオがスキップ/失敗する。詳細は
[perf-tests/seed/README.md](../../../perf-tests/seed/README.md)。

## 3. k6（バックエンド API 負荷試験）

`k6` が無ければ `brew install k6`（`which k6` で確認）。シナリオ一覧は
[perf-tests/README.md](../../../perf-tests/README.md#バックエンド-api-負荷試験k6) 参照
（timeline-read / auth-login / post-create / reactions / profile-read / followers-list / requests-list）。

```sh
# まず全シナリオを smoke で動作確認
for s in timeline-read auth-login post-create reactions profile-read followers-list requests-list; do
  echo "=== $s ==="
  k6 run -e MODE=smoke "perf-tests/k6/scenarios/$s.ts"
done

# load モード（HTML レポートが results/k6/ に出る。1 シナリオ約 3 分）
./perf-tests/k6/run.sh timeline-read
```

結果は標準出力の `checks`（成功率 100% が期待値）・`http_req_duration`（p95）・`http_req_failed` を見る。
`thresholds` 未達（`✗` 表示）があれば、シナリオ名・エンドポイント・実測値をユーザーに報告する。

## 4. Lighthouse（フロントエンド画面性能監査）

frontend（5173）が起動していることを確認してから実行する。

```sh
./perf-tests/frontend/run.sh
```

初回は `perf-tests/frontend/` で `npm install` が走る（lighthouse・puppeteer-core）。
結果は `perf-tests/results/lighthouse/timeline-<日時>.report.{html,json}` に出力される。
JSON の `categories.performance.score`（0〜1）・`audits.largest-contentful-paint` 等をユーザーに報告する。

`npm run dev`（Vite 開発サーバー）に対する数値は未バンドル・未最適化のため本番ビルドより大幅に悪く出る
（FCP 10 秒超なども普通）。本番相当の数値が要る場合は frontend を `npm run build && npm run preview` で
起動し、`FRONTEND_URL=http://localhost:4173 ./perf-tests/frontend/run.sh` のように実行する。

## 5. 結果を報告する

- k6：シナリオごとに check 成功率・p95 応答時間・エラー率。thresholds 未達があれば強調。
  load モード実行時は HTML レポートのパスも伝える
- Lighthouse：performance スコア・主要 Core Web Vitals（LCP・CLS・TBT）。レポートファイルのパス
- 非機能要件（[基本設計書 5章](../../../docs/basic-design.md#5-非機能要件)）は「学習用途・大量アクセス非考慮」
  前提のため、数値は厳密な SLA 判定ではなく「劣化に気づくための目安」として扱う

## 6. 後片付け

### DB に残ったテストデータのリセット

`post-create` / `reactions` を実行するとダミー投稿・コメントが DB に残る。放置すると手動確認時に
タイムラインへ混ざったり、[quality-check skill](../quality-check/SKILL.md) が警告する「DB の蓄積データによる
見せかけの失敗」を招く。

書き込みシナリオを実行した後は、**ユーザーに確認した上で** `python manage.py seed_perf_data` の再実行を
提案する（DB を書き換える操作のため無断では実行しない）。`timeline-read` / `auth-login` / `profile-read` /
`followers-list` / `requests-list` のみなら不要。

### サーバーの停止

検証のためだけに起動したサーバーは作業終了時に停止する（[run-app skill](../run-app/SKILL.md) 参照）。
ただしユーザーが引き続き使う様子なら勝手に止めずに確認する。

```sh
lsof -ti:8000 -sTCP:LISTEN | xargs -r kill
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
```
