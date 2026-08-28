## perf-tests

PenAndPalette のパフォーマンステスト一式。**開発者が任意のタイミングで手動実行するもの**であり、
`npm run test` / `npm run lint` / `pytest` / CI のいずれにも組み込まれていない。

`docs/basic-design.md` の非機能要件は「受講生・個人の学習利用を前提とし、大量アクセス・大量データは
考慮しない」としているため、目的は本番並みの負荷への耐性証明ではなく、以下のような設計上の判断が
実際にどう振る舞うか・劣化に気づけるようにすることである。

- タイムライン（`GET /api/posts`）は全ログインユーザーが 30 秒間隔でポーリングし、無限スクロールでも叩く
  （id 基準カーソルページネーション、基本設計書 6.9〜6.10節）
- 投稿一覧のいいね数・かきたい数・コメント数は `annotate()` 集計（N+1 回避、基本設計書 6.3節）
- フォロワー一覧・フォロー中一覧・コメント一覧・リクエスト一覧は意図的に非ページネーション
- ユーザー検索は索引なしの `LIKE`（`icontains`）検索

### 2 つのトラック

| ディレクトリ | 何を測るか | ツール |
|---|---|---|
| [k6/](k6/) | バックエンド API の負荷試験。同時アクセス数を上げてサーバー・DB の挙動を見る | [k6](https://k6.io/) |
| [frontend/](frontend/) | フロントエンド画面の Lighthouse 監査。1 ユーザーがページを開いたときの読み込み・描画品質 | Lighthouse + Puppeteer |

測定対象も手法も異なるため混同しないこと。

### 事前準備（共通）

1. `.claude/skills/run-app/SKILL.md` の手順で backend（8000）・frontend（5173）・DB（3306）を起動する
   （k6 のみなら frontend は不要）
2. ダミーデータを一度投入する（[seed/README.md](seed/README.md)）:

   ```sh
   cd backend && source .venv/bin/activate
   python manage.py seed_perf_data
   ```

### バックエンド API 負荷試験（k6）

シナリオは TypeScript（`k6/lib/`・`k6/scenarios/`）。k6（v0.57 以降）は `.ts` をビルドなしで
そのまま実行できるため事前コンパイルは不要。[k6](https://k6.io/) のインストールが必要（例: `brew install k6`）。

```sh
# load（既定）: 20VU までランプアップし 2 分維持。HTML レポートを残す
./perf-tests/k6/run.sh timeline-read

# smoke: 1VU・1イテレーションのみ。シナリオが壊れていないかの確認用（レポートは生成されない）
./perf-tests/k6/run.sh timeline-read smoke

# k6 を直接叩いてもよい（レポートは生成されず標準出力にサマリーのみ）
k6 run -e MODE=smoke perf-tests/k6/scenarios/timeline-read.ts

# ローカル以外へ実行する場合
BASE_URL=https://example.com ./perf-tests/k6/run.sh timeline-read
```

用意しているシナリオ（`k6/scenarios/`）:

| シナリオ | 対象 | 見るもの |
|---|---|---|
| `timeline-read` | `GET /api/posts`（1・2 ページ目） | カーソルページネーション＋集計 annotate。最優先 |
| `auth-login` | `POST /api/auth/login` | パスワードハッシュ（PBKDF2）検証コスト |
| `post-create` | `POST /api/posts`（小説・テキストのみ） | 投稿作成の書き込み。**DB に書き込む** |
| `reactions` | いいね/かきたいの登録・解除、コメント作成 | 書き込み＋直後の with_reactions 集計。**DB に書き込む** |
| `profile-read` | `GET /api/users/{id}`（perf_user_0001） | フォロー数集計・フォロー中 Exists サブクエリ |
| `followers-list` | `GET /api/users/{id}/followers` `/following` | 非ページネーションの弱点確認（499 フォロワー） |
| `requests-list` | `GET /api/requests/received` | 非ページネーション。通知バッジが高頻度で叩く |

各シナリオの `thresholds`（p95 応答時間・エラー率）は目安値。厳密な SLA ではなく「劣化に気づく基準」。

型チェック（`k6 run` 自体は型を検証しない。エディタ・手動チェック用）:

```sh
cd perf-tests/k6 && npm install && npm run typecheck
```

### フロントエンド画面性能監査（Lighthouse）

```sh
./perf-tests/frontend/run.sh
```

フロント（:5173）とバックエンド API（:8000）が別オリジンのため、Puppeteer で実ブラウザに
本物の認証 Cookie をセットしてから Lighthouse を走らせる（実装は
[frontend/audit.mjs](frontend/audit.mjs)）。監査対象は認証後のタイムライン画面（`/`）。

`FRONTEND_URL` 未指定なら `npm run dev`（Vite 開発サーバー）が対象になるため、本番ビルドより
スコアが大きく悪化して見える（未バンドル・未最適化のモジュールを都度配信するため）。本番相当の
数値が要る場合:

```sh
cd frontend && npm run build && npm run preview   # 別ターミナル（既定 4173 番）
FRONTEND_URL=http://localhost:4173 ./perf-tests/frontend/run.sh
```

### HTML レポート

`perf-tests/results/`（Git 管理対象外）に出力する。同一種別について直近 5 件だけ残して古いものを自動削除する。

- k6: `run.sh`（k6 の Web Dashboard 機能）が `results/k6/<シナリオ>-<日時>.html` に出力。
  **テスト時間が短すぎる（目安 30 秒未満）とスキップされる**。smoke モードでは常に生成されない
- Lighthouse: `run.sh` が `results/lighthouse/timeline-<日時>.report.{html,json}` に出力

### 実行後のデータの後片付け

`post-create` / `reactions` は DB に書き込むため、実行後もダミー投稿・コメントが残る。放置すると
普段の手動確認でタイムラインに混ざったり、`.claude/skills/quality-check/SKILL.md` が警告する
「DB の蓄積データによる見せかけの失敗」と同種の問題を招く。

書き込みを伴うシナリオを実行した後は `python manage.py seed_perf_data` を再実行すること
（`perf_user_%` を全削除→再投入するため、CASCADE でコメント・いいねも消えて元の状態に戻る）。
`timeline-read` / `auth-login` / `profile-read` / `followers-list` / `requests-list` のみ（読み取り専用）なら不要。
