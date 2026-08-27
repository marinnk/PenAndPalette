#!/usr/bin/env bash
# E2Eテスト（scenarios / performance）を実行し、レポートを e2e/results/ に残す。
#
# 実行例:
#   ./e2e/run.sh scenarios
#   ./e2e/run.sh performance
#   ./e2e/run.sh scenarios post-novel.spec.ts   # 特定specのみ
#
# 事前準備: backend（8000）・frontend（5173）・DB（3306）が起動していること。
# 画像アップロードを伴うシナリオ（イラスト投稿・コメント画像・アイコン）は MinIO（9000）も必要。
# 起動手順は .claude/skills/run-app/SKILL.md を参照。
set -euo pipefail

TRACK="${1:?トラックを指定してください（scenarios / performance）}"
SPEC_FILTER="${2:-}"

if [ "$TRACK" != "scenarios" ] && [ "$TRACK" != "performance" ]; then
  echo "トラックは scenarios / performance のいずれかを指定してください: $TRACK" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- ヘルスチェック（run-app スキルと同じ curl パターン） ---
echo "Checking backend (8000)..."
if ! curl -sS -f -o /dev/null http://localhost:8000/api/health; then
  echo "backend（8000）が応答しません。.claude/skills/run-app/SKILL.md の手順で起動してください。" >&2
  exit 1
fi
echo "Checking frontend (5173)..."
if ! curl -sS -f -o /dev/null "${E2E_BASE_URL:-http://localhost:5173}/"; then
  echo "frontend（5173）が応答しません。.claude/skills/run-app/SKILL.md の手順で起動してください。" >&2
  exit 1
fi

# --- 実行 ---
if [ -n "$SPEC_FILTER" ]; then
  npx playwright test --project="$TRACK" "$TRACK/$SPEC_FILTER"
else
  npx playwright test --project="$TRACK"
fi

# --- レポートの保存＋ローテーション（直近5件。perf-tests/k6/run.sh と同じ方式） ---
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="results/$TRACK"
mkdir -p "$OUT_DIR"
if [ -d "playwright-report" ]; then
  cp -R playwright-report "$OUT_DIR/$TRACK-$TIMESTAMP"
  echo "Report copied to e2e/$OUT_DIR/$TRACK-$TIMESTAMP/index.html"
fi

KEEP=5
REPORT_COUNT=$(ls -1d "$OUT_DIR/$TRACK-"*/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$REPORT_COUNT" -gt "$KEEP" ]; then
  ls -1d "$OUT_DIR/$TRACK-"*/ | sort | head -n "$((REPORT_COUNT - KEEP))" | while IFS= read -r old; do
    rm -rf "$old"
  done
fi

echo ""
echo "e2e_ プレフィックスの登録利用者が DB に残っています。不要になったら手動でクリーンアップしてください:"
echo "  docker exec -i pen-and-palette-db mysql -uroot -proot pen_and_palette < e2e/seed/cleanup.sql"
