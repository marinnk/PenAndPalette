# CLAUDE.md

Claude Codeがこのリポジトリで作業する際に必ず守るルールです。姉妹プロジェクト[RaiseTechSNS](../RaiseTechSNS/CLAUDE.md)のルールを踏襲しつつ、本プロジェクトの技術スタック（Python/Django + Vue.js）に合わせて読み替えています。

## 開発フロー（Issue駆動開発）

ドキュメント整備・コード変更を伴うタスクに着手する際は、必ず以下の順序で作業してください。ユーザーから明示的に「Issueを立てて」と指示されていなくても、このフローに従います。

1. **Issueを起票する**

   ```sh
   gh issue create --title "<タイトル>" --body "<概要・完了条件>"
   ```

   タイトルは何をするか一目で分かる内容にし、本文には概要・背景・完了条件を記載します。

2. **Issueに対応するブランチを作成する**

   命名規則: `<type>/<issue番号>-<短い英語slug>`

   - `type` は `feature` / `fix` / `chore` / `docs` / `refactor` のいずれか
   - 例: `docs/1-add-basic-design`, `feature/12-add-login-form`

   ```sh
   git switch -c docs/1-add-basic-design main
   ```

3. **作業ブランチ上で変更・コミットする**

   - **mainブランチへの直接コミット・直接pushは禁止**です。必ず作業ブランチ上で作業してください。

4. **PRを作成する**

   ```sh
   gh pr create --title "<タイトル>" --body "Closes #<issue番号>

   <変更内容の概要>"
   ```

   本文に `Closes #<issue番号>` を含め、マージ時にIssueが自動でクローズされるようにします。

5. **マージはユーザーの承認を得てから行う**

   PRのマージ（`gh pr merge`）は共有状態への変更にあたるため、ユーザーに明示的に確認を取ってから実行してください。無断でマージしないこと。

6. **マージ確認後、mainに戻ってローカルの作業ブランチを削除する**

   PRがマージされたことを確認したら、指示を待たずに以下を行ってください。

   ```sh
   git switch main
   git pull --ff-only
   git branch -d <作業ブランチ名>
   ```

## コーディング規約

技術スタックは[基本設計書](docs/basic-design.md)の通り、バックエンドがPython / Django（Django REST Framework）、フロントエンドがVue.js、DBがMySQL。姉妹プロジェクト[RaiseTechSNS](../RaiseTechSNS)と同じインフラ構成・開発フローを踏襲しつつ、言語・フレームワークとDB（RaiseTechSNSはPostgreSQL、本プロジェクトはMySQL）が異なる分は以下のように読み替える。

- 新しい機能を実装する際は、対応する自動テストも合わせて実装する
  - フロントエンド：Vitest + Vue Testing Library でコンポーネント・ロジックのテストを書く（`npm run test`）
  - バックエンド：pytest（pytest-django）でビュー・シリアライザ・サービス層のテストを書く（`pytest` / `python manage.py test`）
  - ※具体的なテストランナー・Lintツール（pytest vs Django標準TestCase、ruff vs flake8等）はバックエンドの実装セットアップ時に確定する。確定したら本節・[run-app skill](.claude/skills/run-app/SKILL.md)・[quality-check skill](.claude/skills/quality-check/SKILL.md)のコマンドを実際のものに更新すること
- PRを作成する前に、フロントエンド（`npm run lint` / `npm run test`）・バックエンド（lint・testコマンド）を実行し、エラーが無いことを確認する
- コンポーネント・関数は単一の責務に絞る（データ取得・状態管理・画面表示を1ファイルに詰め込まない）
  - フロントエンド：APIとの通信・データ更新のロジックはcomposable（`useXxx`）に分離し、コンポーネントは受け取ったデータをどう表示するかに専念させる
  - バックエンド：ビュー（DRFの`APIView`/`ViewSet`）は薄く保ち、業務ロジックはサービス層・モデルメソッドに、入出力の検証・整形はシリアライザに分離する
- DBのテーブル定義変更は、`makemigrations`で生成したDjangoマイグレーションファイルとしてリポジトリにコミットする（マイグレーションファイルを経由しないスキーマ変更をしない）
- 一覧系エンドポイントは[基本設計書 6.9節](docs/basic-design.md#69-ページネーション方式カーソルベース)の方針に従う：タイムラインのみ`id`基準のカーソル方式（`before_id`/`after_id`）、それ以外（フォロワー一覧・コメント一覧・リクエスト一覧等）は学習規模のデータ量を前提に意図的に非ページネーション。一覧の集計値（いいね数・かきたい数・コメント数等）はループでの個別クエリではなく、Django ORMの`annotate()`でN+1を避ける（[基本設計書 6.3節](docs/basic-design.md#63-投稿api)参照）

## 動作確認のためにサーバーを起動する場合

バックエンド・フロントエンドの起動手順は `.claude/skills/run-app/SKILL.md` を参照してください。特に以下は必ず守ること。

- バックエンドは必ず **8000**、フロントエンドは必ず **5173**、DB（MySQL）は必ず **3306** で起動する。ポートが競合したときに、別のポートで起動された状態のまま「動いている」と判断してはいけません。
- ポート競合が起きた場合は、そのポートを使っているプロセスを `lsof -ti:<port> -sTCP:LISTEN | xargs -r kill` 等で必ず停止してから、既定のポートで起動し直してください。

## 例外

- ドキュメントの誤字修正など、極めて軽微でリスクのない変更であっても、GitHub側でブランチ保護（PR必須）を設定した場合はmainへの直接pushができなくなるため、上記フローに従ってください。
- 複数の関連する変更を1つのIssue・PRにまとめても構いませんが、無関係な変更を混ぜないでください。
