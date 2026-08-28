#!/usr/bin/env bash
# k6 シナリオを実行し、Lighthouse と同様に HTML レポートを perf-tests/results/k6/ に残す。
#
# 実行例:
#   ./perf-tests/k6/run.sh timeline-read           # load（既定・約3分）。レポートが生成される
#   ./perf-tests/k6/run.sh timeline-read smoke     # smoke（数秒）。動作確認用、レポートは生成されない
#
# 【注意】k6 の Web Dashboard 機能による HTML レポートは、テスト時間が短すぎると生成されない
# （集計期間・既定10秒の3倍=30秒未満だと "report generation was skipped" としてスキップ）。
# smoke モードでは常にスキップされる。レポートが欲しい場合は必ず load モード（既定）で実行する。
#
# レポート不要な動作確認は k6 を直接叩いてもよい:
#   k6 run -e MODE=smoke perf-tests/k6/scenarios/timeline-read.ts
set -euo pipefail

SCENARIO="${1:?シナリオ名を指定してください（例: timeline-read）}"
MODE="${2:-load}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIO_PATH="$SCRIPT_DIR/scenarios/$SCENARIO.ts"
if [ ! -f "$SCENARIO_PATH" ]; then
  echo "シナリオが見つかりません: $SCENARIO_PATH" >&2
  echo "利用可能: $(cd "$SCRIPT_DIR/scenarios" && ls *.ts | sed 's/\.ts$//' | tr '\n' ' ')" >&2
  exit 1
fi

OUT_DIR="$SCRIPT_DIR/../results/k6"
mkdir -p "$OUT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="$OUT_DIR/$SCENARIO-$TIMESTAMP.html"

K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="$REPORT_PATH" k6 run -e MODE="$MODE" "$SCENARIO_PATH"

if [ -f "$REPORT_PATH" ]; then
  echo "Report written to $REPORT_PATH"

  # 実行のたびにレポートが増え続けディスクを圧迫しないよう、同一シナリオについて直近 KEEP 件を
  # 残して古いものを削除する（macOS 標準の head/bash には GNU 拡張の `head -n -N` が無いため使わない）。
  KEEP=5
  REPORT_COUNT=$(ls -1 "$OUT_DIR/$SCENARIO-"*.html 2>/dev/null | wc -l | tr -d ' ')
  if [ "$REPORT_COUNT" -gt "$KEEP" ]; then
    ls -1 "$OUT_DIR/$SCENARIO-"*.html | sort | head -n "$((REPORT_COUNT - KEEP))" | while IFS= read -r old_report; do
      rm -f "$old_report"
    done
  fi
else
  echo "レポートは生成されませんでした（テスト時間が短いとスキップされます。smoke モードでは常にスキップ）"
fi
