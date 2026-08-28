# PenAndPalette

文字書きさんとイラストを描く人を繋ぐ、創作特化のSNS風Webアプリケーション（学習用）。

## 概要

小説（テキスト作品）とイラストの両方を投稿でき、他利用者の作品に対して「いいね」「コメント」に加えて、「この小説にイラストを描かせてほしい」「このイラストのキャラクターで小説を書かせてほしい」といったリクエストを送り合える点が特徴です。姉妹プロジェクト[RaiseTechSNS](../RaiseTechSNS)と同じインフラ構成を踏襲しつつ、使用言語を変えて実装します。

詳細な仕様は以下のドキュメントを参照してください。

- [要件定義書](docs/requirements.md)：何を・なぜ作るか
- [機能一覧](docs/features/index.md)：機能ごとの詳しい仕様
- [画面設計](docs/screen-design.md)：画面一覧・画面遷移・ワイヤーフレーム
- [基本設計書](docs/basic-design.md)：技術スタック・データベース設計（ER図）など、どう作るか
- [インフラ構成書](docs/infrastructure-design.md)：本番AWS構成（Terraform）・デプロイ手順

## スクリーンショット

> ローカル環境で表示用のダミーデータを投入して撮影したものです（画像はプレースホルダー）。

### タイムライン

<p>
  <img src="docs/assets/timeline.png" width="49%" alt="タイムライン（イラスト）">
  <img src="docs/assets/timeline-novel.png" width="49%" alt="タイムライン（小説・分類タグ絞り込み）">
</p>

全体／フォロー中、イラスト／小説の切り替え、分類タグでの絞り込み、`id` カーソルベースの無限スクロール。新着投稿はバナーで通知。

### 投稿作成

<img src="docs/assets/post-create.png" width="60%" alt="投稿作成">

イラスト／小説の2種別。イラストは画像1〜4枚、小説はタイトル・本文（＋任意のカバー画像）。分類タグは最大5個。

### プロフィール／ユーザー検索

<p>
  <img src="docs/assets/profile.png" width="49%" alt="プロフィール">
  <img src="docs/assets/search.png" width="49%" alt="ユーザー検索">
</p>

プロフィールカード（アイコン・自己紹介・フォロー数）、投稿／ブックマークタブ、プロフィール編集。ユーザー名・表示名でのユーザー検索。

### リクエスト／リアクション

<p>
  <img src="docs/assets/request.png" width="49%" alt="リクエスト作成">
  <img src="docs/assets/post-detail.png" width="49%" alt="投稿詳細（いいね・かきたい・コメント）">
</p>

「いいね」「かきたい」、コメント（画像添付可）、個人宛てのリクエスト（参考投稿の指定、ヘッダーの通知バッジ）。

## 使用技術

- バックエンド：Python / Django（Django REST Framework）、Lint/テストはruff・pytest-django
- フロントエンド：Vue.js（TypeScript）、Lint/テストはESLint+Prettier・Vitest
- データベース：MySQL
- 画像ストレージ：Amazon S3（ローカル開発ではMinIOで代替）
- 本番インフラ：AWS（S3 + CloudFront / ECS Fargate / RDS for MySQL / Secrets Manager）を Terraform で構築。詳細は[インフラ構成書](docs/infrastructure-design.md)

## プロジェクト構成

```
.
├── backend/    # Django（REST API）
├── frontend/   # Vue.js（画面）
├── e2e/        # Playwright E2Eテスト（scenarios は CI で自動実行 / performance は手動）
├── terraform/  # 本番AWSインフラ（S3+CloudFront / ECS Fargate / RDS）
├── docs/       # 要件定義・設計ドキュメント
└── docker-compose.yml   # MySQL・MinIO（ローカル開発用）
```

起動手順は[.claude/skills/run-app/SKILL.md](.claude/skills/run-app/SKILL.md)を参照してください。

## ステータス

要件定義書・機能一覧・画面設計・基本設計書（ER図含む）、開発環境の土台（backend/frontendの雛形、docker-compose、Lint/テスト環境）に加え、[機能一覧](docs/features/index.md)の **F-1〜F-11 をすべて実装済み**。

- F-1 ログイン（会員登録・ログイン・ログアウト、JWTアクセストークン＋リフレッシュトークンのHttpOnly Cookie認証）
- F-2 タイムライン（全体／フォロー中、イラスト／小説の切り替え、分類タグでの絞り込み、カーソルベースの無限スクロール）
- F-3 投稿（イラスト／小説の2種別、画像0〜4枚、自分の投稿の編集・削除）
- F-4 コメント（画像添付・編集・削除）
- F-5 いいね ／ F-10 かきたい
- F-6 リクエスト（個人宛て、参考投稿の指定、ヘッダー通知バッジ）
- F-7 フォロー（フォロー／アンフォロー、フォロー中・フォロワー一覧）
- F-8 プロフィール（カード表示、投稿／ブックマークタブ、S08 プロフィール編集・アイコン）
- F-9 ユーザー検索
- F-11 分類タグ（投稿への付与・タイムラインでの絞り込み）

テストは backend（pytest-django）・frontend（Vitest）・E2E（Playwright scenarios）を整備済みで、Lint／テスト／ビルド／E2E を PR ごとに GitHub Actions（[.github/workflows/ci.yml](.github/workflows/ci.yml)）で自動実行しています。E2E の performance トラック（`e2e/performance`、ブラウザ実測タイミング）は手動実行です。k6 負荷試験・Lighthouse 監査（`perf-tests/`）はテンプレートのみで未整備です。

本番デプロイは AWS 構成を [`terraform/`](terraform/) にコード化し、バックエンドを本番設定に対応させ、イメージビルド〜配信を GitHub Actions（`.github/workflows/deploy.yml`、手動実行・OIDC 認証）にまとめ済み（[インフラ構成書](docs/infrastructure-design.md)にデプロイ手順あり）。実際の `terraform apply`／デプロイ実行は未実施です。
