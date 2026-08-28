// perf-tests/frontend/audit.mjs から参照する Lighthouse 監査対象の設定。
//
// このフロントエンドは Vue Router（history モード）でルーティングを持つが、タイムライン画面の
// パスは "/"（router の定義は name:"timeline" / path:"/"）。他の画面（投稿詳細 /posts/:id、
// プロフィール /profile/:id 等）も個別 URL を持ち、いずれもログイン済み Cookie が必要な点は同じ。
// 別画面も監査したくなったら TARGET_PATH 環境変数で audit.mjs に渡す。
module.exports = {
  targetPath: '/', // 監査対象はタイムライン画面（ログイン後の初期表示）
  reportName: 'timeline',
};
