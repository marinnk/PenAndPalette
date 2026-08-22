---
name: quality-check
description: Run a comprehensive code-quality review of the PenAndPalette app (Django/DRF backend + Vue.js frontend) — automated lint/test/build checks plus a deeper architectural review comparing the implementation against docs/ and README.md, common Vue/Django anti-patterns, and JWT authentication/authorization concerns. Use whenever the user asks for a "品質チェック"/"quality check"/"code review" of the whole app, wants to know if the codebase has drifted from best practices or from the requirements docs, or asks to check the app before a release/milestone. Do not use this for routine per-PR verification — CI already covers that; this skill is for the periodic, deeper review.
---

# 品質チェック

このアプリ（Django/DRFバックエンド + Vue.jsフロントエンド）の品質を、自動チェックと設計レベルのレビューの2段階で確認する手順。姉妹プロジェクト[RaiseTechSNS](../../../../RaiseTechSNS/.claude/skills/quality-check/SKILL.md)と同じ方針を、本プロジェクトの技術スタック・設計に合わせて適用する。

## この手順を使うタイミング

CIが毎回のpush・PRで自動的にlint/testを実行している場合、**このスキル全体を毎回のPRごとに実行する必要はない**。以下のようなタイミングで使う。

- まとまった機能追加が一段落したとき
- 個人開発・学習プロジェクトのペースなら1〜2ヶ月に1回程度
- 「なんとなくコードが雑然としてきた」と感じたとき
- リリースや大きな区切りの前

## 第1段階：自動チェック（毎回同じ、機械的に実行）

```sh
# フロントエンド
cd frontend
npm run lint
npm run test
npm run build
```

```sh
# バックエンド
cd backend
source .venv/bin/activate
ruff check .
ruff format --check .
pytest
```

テストはMySQLへの接続を必要とする（[run-app skill](../run-app/SKILL.md)の「バックエンドのテストとDBの関係」参照）。Docker daemonが起動していない環境では、先に`docker compose up -d db`を実行する。

### ローカル特有の注意：DBの蓄積データによる見せかけの失敗

Djangoのテストは実行のたびに一時DBを作り直すため、RaiseTechSNS（Testcontainersなし・開発用DBに直接依存する構成だった場合）ほどはこの問題の影響を受けにくい。ただし、開発用DBコンテナ自体を長期間起動しっぱなしにして手動確認を繰り返していると、シードデータや手動投入したデータが蓄積し、**アプリの動作確認（テストではなく手動確認）の際に**「コードには問題がないのに様子がおかしい」という状況が起こり得る。

その場合は、まずこれが原因でないか疑い、DBをリセットしてから再確認して切り分ける。

```sh
docker compose down -v
docker compose up -d
```

リセット後も同じ箇所で問題が再現する場合のみ、実際のコードの問題として扱う。

## 第2段階：設計・アーキテクチャレベルのレビュー（自動化できない部分）

### ドキュメントとの整合性

`docs/`（requirements.md・features/・screen-design.md・basic-design.md）と`README.md`の内容が、実際の実装と食い違っていないか確認する。

- READMEの「ステータス」節が実装済み機能を正しく反映しているか
- `docs/basic-design.md`のテーブル定義・制約（users・posts・post_images・comments・likes・wants・follows・requests・refresh_tokens）が、実際のDjangoモデル（`max_length`/`null`/`unique`等）やマイグレーション（`backend/*/migrations/`）と一致しているか
- `docs/features/index.md`の機能一覧（F-1〜F-10）に対して、未実装の機能がREADMEで「実装済み」と誤って書かれていないか
- タイムラインの「全体」「フォロー中」の2種類の表示、新着投稿のポーリング＋通知バナー（[基本設計書 6.10節](../../../docs/basic-design.md#610-リアルタイム反映ポーリング新着通知バナー)）が画面設計通りに実装されているか

### フロントエンドのチェック観点

- アクセシビリティ：ESLintに`eslint-plugin-vuejs-accessibility`相当のルールが有効化されているか。モーダルを使う画面（投稿フォーム等）に`role="dialog"`・フォーカストラップ・Escapeキーでの閉じる操作があるか
- 責務分離：コンポーネントがデータ取得・状態管理・画面表示を1ファイルに詰め込んでいないか（API通信・データ更新ロジックはcomposable（`useXxx`）に分離されているべき）
- 認証状態の扱い：JWTトークンをJavaScriptから扱っていないか（[基本設計書 3章](../../../docs/basic-design.md#3-認証方式)の設計どおりHttpOnly Cookieのみで運用し、フロントは`withCredentials: true`／`credentials: "include"`でリクエストするだけになっているか）。未ログイン時のリダイレクト、アクセストークン失効時の`/api/auth/refresh`呼び出しが一貫しているか
- ミューテーション後の無駄な全件再取得：投稿・いいね・かきたい・コメント・フォロー・リクエストのたびに、APIレスポンスを使わず画面全体のデータを取り直していないか
- 未使用のアセット・importが残っていないか

### バックエンドのチェック観点

- 入力バリデーション：新しいAPIのリクエストにDRFシリアライザの`validators`/`max_length`等が付いているか（投稿本文280文字、画像最大4枚、画像形式jpg/png・5MB以下等、[基本設計書 4章・6章](../../../docs/basic-design.md)の制約が実装に反映されているか）
- 認証・認可：`CookieJWTAuthentication`（Cookieからのトークン読み取り）がDRFの認証クラスとして一貫して設定されているか。「自分の投稿/コメントだけ削除できる」「未ログインでは`/api/auth/`以外にアクセスできない」といった認可ルールが、個々のビューで場当たり的に実装されていないか
- 例外処理：DRF標準のエラーレスポンス形式（バリデーションエラー400は`{"フィールド名": [...]}`、401/403/404は`{"detail": "..."}`）で一貫しているか（[基本設計書 5章](../../../docs/basic-design.md#5-非機能要件)参照）
- N+1クエリ：投稿一覧のいいね数・かきたい数・コメント数集計は`annotate()`（`Count`・`Exists`）で1回のSELECTにまとまっているか、ループでの個別クエリになっていないか（[基本設計書 6.3節](../../../docs/basic-design.md#63-投稿api)参照）
- ページネーション方針の一貫性：タイムライン（`GET /api/posts`）のみ`id`基準のカーソル方式（`before_id`/`after_id`）を使い、フォロワー一覧・コメント一覧・リクエスト一覧等は意図的に非ページネーション（LIMIT付き全件取得）になっているか（[基本設計書 6.9節](../../../docs/basic-design.md#69-ページネーション方式カーソルベース)）。offsetベースのページネーションを誤って混在させていないか
- 画像削除の整合性：投稿削除・アバター置き換え・投稿画像入れ替え・コメント画像置き換え/削除の際、DB行だけでなくS3（開発時はMinIO）上の実ファイルも削除されているか（CASCADEでは消えないため、アプリケーション側の削除処理が必要。[基本設計書 6.3節](../../../docs/basic-design.md#63-投稿api)）
- スキーマ管理：DBのテーブル定義変更が、Djangoの`makemigrations`で生成したマイグレーションファイルとしてコミットされているか
- レイヤリング：ビューが薄く保たれ（業務ロジックはサービス層・モデルメソッドに）、シリアライザで入出力の検証・整形が分離されているか

## レポートのまとめ方

第1段階（自動チェック）の結果と、第2段階（観点ごとの気づき）を分けて報告する。第2段階は「問題」と決めつけず、「気になった点」として提示し、対応するかどうか・どの粒度で進めるか（Issueを分けるか、まとめるか）はユーザーに確認してから着手する。CLAUDE.mdのIssue駆動開発フローに従い、実際にコードを直す場合は必ずIssue→ブランチ→PRの手順を踏む。
