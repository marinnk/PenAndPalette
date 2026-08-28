## perf-tests/seed

k6 負荷試験・Lighthouse 監査で使うダミーデータの投入について。

RaiseTechSNS は SQL スクリプト（`seed.sql` + `psql`）だが、PenAndPalette は Django の管理コマンドで
投入する。パスワードのハッシュ化・外部キーの連鎖削除を Django に任せられ、SQL を DB 方言に
依存させずに済むため。実体は
[backend/core/management/commands/seed_perf_data.py](../../backend/core/management/commands/seed_perf_data.py)。

### 注意事項

- **ローカルの使い捨て DB 専用。** 共有環境・本番相当の環境では実行しないこと
- パスワードが固定（`Passw0rd!`）のダミーアカウントを大量に作成する
- `username` が `perf_user_` で始まる既存データを削除してから再投入するため、複数回実行しても
  件数は増え続けない（k6 の `post-create` / `reactions` が作ったデータもここでリセットされる）

### 実行方法

```sh
cd backend
source .venv/bin/activate
python manage.py seed_perf_data                      # 既定: 500 ユーザー / 1 人 20 投稿
python manage.py seed_perf_data --users 200 --posts-per-user 10
```

DB（`docker compose up -d db`）が起動し、`python manage.py migrate` 済みであること。

### 投入されるデータ（既定値）

- **ユーザー 500 件**（`perf_user_0001`〜`perf_user_0500`、パスワードは全員 `Passw0rd!`、
  ログイン識別子はメール `perf_user_XXXX@example.com`）
- **投稿 10,000 件**（1 ユーザー 20 件、小説・イラストを半々。イラスト投稿は本来 1〜4 枚の画像が
  必須だが、S3/MinIO への依存を避けるため画像は付けない — DB 制約には抵触しない）
- **投稿タグ**（各投稿に 0〜3 個、`migrate` で入る固定タグから）
- **フォロー**: 各ユーザーが直後 10 人をフォロー（wrap-around）。加えて `perf_user_0001` に
  残り全員（499 人）をフォロワーとして付与 — 非ページネーションのフォロワー一覧・プロフィールの
  フォロワー数集計の負荷試験対象
- **いいね / かきたい**: 投稿ごとに 0〜19 人 / 0〜9 人
- **コメント**: 投稿ごとに 0〜4 件

`--seed` で乱数シードを固定しているため、同じ引数なら毎回同じ分布になる。
