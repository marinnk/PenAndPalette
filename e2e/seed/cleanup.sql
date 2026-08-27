-- Playwright E2Eテストが自己登録したダミー利用者（username が e2e_ で始まる）と、
-- その利用者に紐づく投稿・コメント・いいね・かきたい・フォロー・リクエスト・
-- リフレッシュトークンをまとめて削除する。
--
-- 【重要】ローカルの使い捨てDB専用。共有環境・本番相当の環境では絶対に実行しないこと。
--
-- Django は外部キーに DB レベルの ON DELETE CASCADE を張らない（各FKの DELETE_RULE は
-- NO ACTION）。そのため子テーブルから順に明示的に削除する必要がある。
--
-- MySQL の LIKE では `_` は1文字ワイルドカードのため、`e2e\_%`（バックスラッシュでエスケープ）で
-- 「e2e_ で始まる」を厳密に表す。
--
-- 実行例（docker-compose.yml の既定値の場合）:
--   docker exec -i pen-and-palette-db mysql -uroot -proot pen_and_palette < e2e/seed/cleanup.sql

START TRANSACTION;

-- 投稿にぶら下がる子テーブル
DELETE FROM post_tags
  WHERE post_id IN (SELECT id FROM posts WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%'));
DELETE FROM post_images
  WHERE post_id IN (SELECT id FROM posts WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%'));

-- リアクション・コメント（e2e利用者が「した」もの／e2e利用者の投稿に「ついた」もの）
DELETE FROM likes
  WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%')
     OR post_id IN (SELECT id FROM posts WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%'));
DELETE FROM wants
  WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%')
     OR post_id IN (SELECT id FROM posts WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%'));
DELETE FROM comments
  WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%')
     OR post_id IN (SELECT id FROM posts WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%'));

-- リクエスト（送信者・宛先・参考投稿のいずれかが e2e 由来）
DELETE FROM requests
  WHERE from_user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%')
     OR to_user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%')
     OR related_post_id IN (SELECT id FROM posts WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%'));

-- 認証・フォロー関係
DELETE FROM refresh_tokens
  WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%');
DELETE FROM follows
  WHERE follower_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%')
     OR followee_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%');

-- 本体
DELETE FROM posts WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e\_%');
DELETE FROM users WHERE username LIKE 'e2e\_%';

COMMIT;

-- 確認用（0件になっていればOK）
SELECT COUNT(*) AS remaining_e2e_users FROM users WHERE username LIKE 'e2e\_%';
