# PenAndPalette

文字書きさんとイラストを描く人を繋ぐ、創作特化のSNS風Webアプリケーション（学習用）。

## 概要

小説（テキスト作品）とイラストの両方を投稿でき、他利用者の作品に対して「いいね」「コメント」に加えて、「この小説にイラストを描かせてほしい」「このイラストのキャラクターで小説を書かせてほしい」といったリクエストを送り合える点が特徴です。姉妹プロジェクト[RaiseTechSNS](../RaiseTechSNS)と同じインフラ構成を踏襲しつつ、使用言語を変えて実装します。

詳細な仕様は以下のドキュメントを参照してください。

- [要件定義書](docs/requirements.md)：何を・なぜ作るか
- [機能一覧](docs/features/index.md)：機能ごとの詳しい仕様
- [画面設計](docs/screen-design.md)：画面一覧・画面遷移・ワイヤーフレーム
- [基本設計書](docs/basic-design.md)：技術スタック・データベース設計（ER図）など、どう作るか

## 使用技術

- バックエンド：Python / Django（Django REST Framework）、Lint/テストはruff・pytest-django
- フロントエンド：Vue.js（TypeScript）、Lint/テストはESLint+Prettier・Vitest
- データベース：MySQL
- 画像ストレージ：Amazon S3（ローカル開発ではMinIOで代替）

## プロジェクト構成

```
.
├── backend/    # Django（REST API）
├── frontend/   # Vue.js（画面）
├── docs/       # 要件定義・設計ドキュメント
└── docker-compose.yml   # MySQL・MinIO（ローカル開発用）
```

起動手順は[.claude/skills/run-app/SKILL.md](.claude/skills/run-app/SKILL.md)を参照してください。

## ステータス

要件定義書・機能一覧・画面設計・基本設計書（ER図含む）、開発環境の土台（backend/frontendの雛形、docker-compose、Lint/テスト環境）に加え、F-1 ログイン機能（会員登録・ログイン・ログアウト、JWTアクセストークン＋リフレッシュトークンのHttpOnly Cookie認証）まで完了。F-2以降の機能実装はこれから進めます。
