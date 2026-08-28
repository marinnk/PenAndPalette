#!/usr/bin/env bash
# フロントエンド画面性能監査（Lighthouse）の実行スクリプト。
#
# バックエンド API の負荷試験（perf-tests/k6/）とは別物：こちらは同時接続数ではなく、
# 1 ユーザーがページを開いたときの読み込み・描画品質（Core Web Vitals・バンドルサイズ等）を計測する。
# 監査対象は認証後のタイムライン画面（/timeline）。実装は audit.mjs を参照。
#
# 事前準備:
#   - backend（8000）・frontend（5173）・DB（3306）が起動していること
#     （.claude/skills/run-app/SKILL.md 参照）
#   - `cd backend && python manage.py seed_perf_data` を一度実行していること
#
# 実行例:
#   ./perf-tests/frontend/run.sh
#   # 本番相当の数値が欲しい場合（Vite dev は未最適化で低く出る）:
#   #   cd frontend && npm run build && npm run preview   # 別ターミナルで（既定 4173 番）
#   #   FRONTEND_URL=http://localhost:4173 ./perf-tests/frontend/run.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../results/lighthouse"
mkdir -p "$OUT_DIR"

if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "依存関係をインストールします（初回のみ）..."
  (cd "$SCRIPT_DIR" && npm install)
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
export OUT_PATH="$OUT_DIR/timeline-$TIMESTAMP"

(cd "$SCRIPT_DIR" && node audit.mjs)

# 直近 KEEP 件を残して古いレポート（.report.html/.report.json のペア）を削除する。
KEEP=5
REPORT_COUNT=$(ls -1 "$OUT_DIR"/timeline-*.report.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$REPORT_COUNT" -gt "$KEEP" ]; then
  ls -1 "$OUT_DIR"/timeline-*.report.json | sort | head -n "$((REPORT_COUNT - KEEP))" | while IFS= read -r old_json; do
    base="${old_json%.report.json}"
    rm -f "${base}.report.json" "${base}.report.html"
  done
fi
