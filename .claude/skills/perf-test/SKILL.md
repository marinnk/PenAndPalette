---
name: perf-test
description: Run the on-demand performance tests under perf-tests/ — k6 load tests against backend API endpoints (timeline, login, post creation, likes/wants/comments, profile, followers list, requests list) and a Lighthouse audit of the frontend timeline screen. Use whenever the user asks to run a "パフォーマンステスト"/"負荷試験"/"performance test"/"load test", or asks to run k6 or Lighthouse against this app. These are never run automatically (not part of CI/lint/test) — only when explicitly requested.
---

# パフォーマンステストの実行手順

`perf-tests/`配下のk6シナリオ（バックエンドAPI負荷試験）・Lighthouse監査（フロントエンド画面性能）を実行する手順。姉妹プロジェクト[RaiseTechSNS](../../../../RaiseTechSNS/.claude/skills/perf-test/SKILL.md)と同じ方針を踏襲する。

**このディレクトリ・スキルは現時点ではテンプレート。** `backend/`・`frontend/`の実装セットアップより前の段階では`perf-tests/`ディレクトリ自体が存在しない。実装が進んだら、以下の方針に沿って`perf-tests/README.md`・各シナリオ・シードデータを整備し、このSKILL.mdの具体的なコマンドを実際のものに更新すること。

**これらは常にオンデマンド実行。** ユーザーから明示的に頼まれたときだけ実行し、lint/test/buildの一部として自動実行してはならない。

`docs/basic-design.md`の非機能要件は「学習利用を前提とし、大量アクセス・大量データは考慮しない」としているため、ここでの目的は本番並みの負荷への耐性証明ではなく、以下のような設計上の判断が実際にどう振る舞うかを手元で確認できるようにすること。

- タイムライン（`GET /api/posts`）は`id`基準のカーソル方式ページネーション＋30秒間隔ポーリングで新着検知する設計（[基本設計書 6.9〜6.10節](../../../docs/basic-design.md#69-ページネーション方式カーソルベース)）
- 投稿一覧のいいね数・かきたい数・コメント数は`annotate()`による集計（N+1回避、[基本設計書 6.3節](../../../docs/basic-design.md#63-投稿api)）
- フォロワー一覧・フォロー中一覧・コメント一覧・リクエスト一覧は意図的に非ページネーション（LIMIT付き全件取得）

## 0. どのテストを実行するか判断する

ユーザーの依頼から以下を判断する。曖昧な場合はAskUserQuestion等で確認せず、**まずsmokeモードで全シナリオを実行し**、問題なければ結果を見せた上で「loadモードや個別シナリオも実行するか」をユーザーに確認する（負荷をかける実行はいきなり長時間・広範囲に行わない）。

- 対象トラック：バックエンド（k6）／フロントエンド（Lighthouse）／両方
- k6のモード：`smoke`（既定・数秒で終わる動作確認）／`load`（20VUまでランプアップし数分程度）
- 特定のシナリオ名の指定があれば、それだけを実行する

## 1. 前提環境を起動する

[run-app skill](../run-app/SKILL.md)の手順でbackend（8000）・DB（3306）を起動する。Lighthouseトラックも実行する場合はfrontend（5173）も起動する。k6のみなら不要。

```sh
docker compose up -d db
cd backend
source .venv/bin/activate
python manage.py runserver 8000   # バックグラウンドで起動し、以降のコマンドは別途実行する
```

起動確認：

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/auth/me
```

## 2. シードデータを投入する（未投入の場合）

k6シナリオ・Lighthouseはいずれもログイン可能なダミー利用者の存在を前提にする想定。未投入だとログインに失敗しシナリオが即座にスキップ/失敗するため、投入済みか確認し、無ければ投入する（シード方法は`perf-tests/seed/`整備時に確定する）。

## 3. k6（バックエンドAPI負荷試験）を実行する

`k6`コマンドが無ければ`brew install k6`でインストールする（`which k6`で確認）。想定するシナリオ：

- `timeline-read` — `GET /api/posts`（タイムライン。カーソルページネーション＋ポーリング想定、最優先）
- `auth-login` — `POST /api/auth/login`（パスワードハッシュ検証コストの影響確認）
- `post-create` — `POST /api/posts`（投稿作成、テキストのみ）
- `likes-wants-comments` — いいね/かきたいの登録/解除・コメント作成（高頻度な操作系）
- `profile-read` — `GET /api/users/{userId}`（フォロー数等の集計）
- `followers-list` — フォロワー一覧（意図的な非ページネーションの弱点確認）
- `requests-list` — リクエスト一覧（同上）

```sh
# まずは全シナリオをsmokeモードで動作確認
for s in timeline-read auth-login post-create likes-wants-comments profile-read followers-list requests-list; do
  echo "=== $s ==="
  k6 run -e MODE=smoke "perf-tests/k6/scenarios/$s.ts"
done

# loadモード（HTMLレポートも自動生成される想定）
./perf-tests/k6/run.sh timeline-read
```

結果は標準出力の`checks`（成功率100%が期待値）・`http_req_duration`（p95）・`http_req_failed`を見る。`thresholds`未達（`✗`表示）があれば、シナリオ名・エンドポイント・実測値をユーザーに報告する。

## 4. Lighthouse（フロントエンド画面性能監査）を実行する

frontend（5173）が起動していることを確認してから実行する。

```sh
./perf-tests/frontend/run.sh
```

結果は`perf-tests/results/lighthouse/<name>-<timestamp>.report.html`（ブラウザで開ける）と`.report.json`に出力される想定。JSONの`categories.performance.score`（0〜1）・`audits.largest-contentful-paint`等の主要指標をユーザーに報告する。

`npm run dev`（Viteの開発サーバー）に対する数値は未バンドル・未最適化のため本番ビルドより大幅に悪く出る。本番相当の数値が要る場合は`cd frontend && npm run build && npm run preview`を起動してから実行する。

## 5. 結果を報告する

- k6：シナリオごとにcheck成功率・p95応答時間・エラー率。thresholds未達があれば強調する。loadモード実行時はHTMLレポートのパスも伝える
- Lighthouse：performanceスコア・主要Core Web Vitals（LCP・CLS・TBT）。レポートファイルのパスを伝える
- 非機能要件（[基本設計書 5章](../../../docs/basic-design.md#5-非機能要件)）は「学習用途・大量アクセス非考慮」前提のため、数値は厳密なSLA判定ではなく「劣化に気づくための目安」として扱う

## 6. 後片付け

### DBに残ったテストデータのリセット

投稿・コメント・いいね/かきたいを作成するシナリオを実行すると、ダミーデータがDBに残ったままになる。放置すると、後で普通に手動確認したときにダミー投稿がタイムラインに混ざったり、[quality-check skill](../quality-check/SKILL.md)が警告する「DBの蓄積データによる見せかけの失敗」を自ら引き起こしたりする。

そのため、データを書き換えるシナリオを実行した後は、**ユーザーに確認した上で**シードのリセットを提案する（DBを直接操作する破壊的操作のため、無断では実行しない）。

`timeline-read`・`auth-login`・`profile-read`・`followers-list`・`requests-list`のみ実行した場合はデータを書き換えないため、このリセットは不要。

### サーバーの停止

検証のためだけに起動したサーバーは、作業終了時に停止する（[run-app skill](../run-app/SKILL.md)参照）。

```sh
lsof -ti:8000 -sTCP:LISTEN | xargs -r kill
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
docker compose down
```

ただし、ユーザーが引き続き動作確認等で使う様子なら、勝手に止めずに確認する。
