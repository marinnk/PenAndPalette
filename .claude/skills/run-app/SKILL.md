---
name: run-app
description: Start the backend (Django) and frontend (Vite/Vue) dev servers for local verification. Use whenever you need to run/launch/preview the app, take a screenshot, or manually confirm a change works end-to-end.
---

# アプリの起動手順

このプロジェクトを実際に動かして確認するときは、必ずこの手順に従うこと。姉妹プロジェクト[RaiseTechSNS](../../../../RaiseTechSNS/.claude/skills/run-app/SKILL.md)と同じ規律を、Django/Vueの構成に合わせて適用する。

## 前提: ポートは固定。競合したら「別ポートで動かす」のは禁止

- バックエンド（Django）: 必ず **8000**
- フロントエンド（Vite/Vue）: 必ず **5173**
- DB（MySQL / Docker）: 必ず **3306**

Djangoの開発サーバー（`manage.py runserver`）はポートが使用中だと起動に失敗する。Viteはポートが使用中だと**黙って**5174などの別ポートに自動で切り替わって起動してしまう。どちらの場合も「動いていればOK」ではなく、**指定ポートで動いていることを毎回確認する**こと。別ポートで起動した状態のまま作業を進めない（フロントエンドのAPIベースURLは`http://localhost:8000`固定の想定なので、バックエンドが別ポートだと接続できず、逆にフロントエンドが別ポートだとCORS設定（`CORS_ALLOWED_ORIGINS`に`http://localhost:5173`のみ許可）に弾かれる。[基本設計書 3.1節](../../../docs/basic-design.md#31-corscookie送信フロントバックエンドの別オリジン対策)参照）。

## 起動前: ポート競合の確認・解消

起動する前に、対象ポートを使っているプロセスがないか確認し、あれば停止する。

```sh
# 例: 8000番ポートを使っているプロセスを止める
lsof -ti:8000 -sTCP:LISTEN | xargs -r kill

# 例: 5173番ポートを使っているプロセスを止める
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
```

`rm`はこのプロジェクトの`.claude/settings.json`で禁止されているのと同様、`kill -9`も禁止されている。まずは通常の`kill`（SIGTERM）で止め、それでも残る場合はユーザーに相談する。

## 起動手順

```sh
# 1. DB・MinIO（初回 or 停止している場合のみ）
docker compose up -d

# 2. バックエンド（別ターミナル/バックグラウンド）
cd backend
python3 -m venv .venv && source .venv/bin/activate   # 初回のみ
pip install -r requirements.txt                       # 初回・依存追加時のみ
python manage.py migrate
python manage.py runserver 8000

# 3. フロントエンド（別ターミナル/バックグラウンド）
cd frontend
npm install   # 初回・依存追加時のみ
npm run dev
```

※ 仮想環境の作り方（venv/poetry/uv等）・依存管理ファイル名は、バックエンドの実装セットアップ時に確定する。確定したらこの節を実際のコマンドに更新すること。

## 起動後の確認

```sh
# バックエンドが8000で応答しているか（未ログインでも401が返れば起動確認としては十分）
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/auth/me

# フロントエンドが5173で応答しているか
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

いずれかが期待するポートで応答しない場合は、そのポートを使っている別プロセスがいないか再度`lsof`で確認し、止めてから起動し直す。「一時的に別のポートで動かして確認する」という代替策は取らない（アプリ側の設定が固定ポート前提のため、別ポートでは正しく動作しない）。

## バックエンドのテストとDBの関係（RaiseTechSNSとの違いに注意）

RaiseTechSNS（Spring Boot）はTestcontainersにより、テスト実行時に使い捨てのPostgreSQLコンテナを自動起動するため、開発用DBコンテナが起動していなくてもテストが実行できた。**Djangoはこの前提が異なる**：Djangoのテストランナー（`python manage.py test` / `pytest`）は、`settings.py`の`DATABASES`設定に従い同じMySQLサーバーに接続し、その中に`test_`プレフィックス付きの一時DBを作成・マイグレーション適用・テスト後に破棄する。つまり**テスト実行前にも`docker compose up -d db`でDBコンテナを起動しておく必要がある**（開発用DBの中身自体は変更されない。別名の一時DBが使われるだけ）。

## サンドボックス環境等でDockerが使えない場合

Docker daemonが起動していない環境では、DBに依存する`runserver`・マイグレーション・テストは実行できない。その場合は以下に限定して確認し、DBが必要な検証はユーザー側の環境で行ってもらう。

```sh
cd backend
python3 -m py_compile $(find . -name '*.py' -not -path './.venv/*')   # 最低限の構文確認
```

## ブラウザでの見た目確認（任意）

`chromium-cli`が使えない場合、`playwright-core` + ローカルのGoogle Chromeで代替できる:

```sh
npm install playwright-core   # スクラッチディレクトリ等、一時的な場所で
```

```js
const { chromium } = require('playwright-core');
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
```
