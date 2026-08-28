import type { Options } from 'k6/options';

// 各シナリオで共通して使う実行モード（k6 の `options` を組み立てる）。
//
// - smoke: 1VU・1イテレーションのみ。シナリオ自体が壊れていないかの動作確認用。
// - load : 学習用途で「複数人が同時に使う」規模を想定したランプアップ（既定）。
//          本番相当の大規模トラフィックは想定しない（docs/basic-design.md 非機能要件を参照）。
//
// 実行例:
//   k6 run perf-tests/k6/scenarios/timeline-read.ts                 # load（既定）
//   k6 run -e MODE=smoke perf-tests/k6/scenarios/timeline-read.ts   # smoke
export function buildOptions(loadThresholds: Options['thresholds']): Options {
  const mode = __ENV.MODE || 'load';

  if (mode === 'smoke') {
    return {
      vus: 1,
      iterations: 1,
      thresholds: { http_req_failed: ['rate==0'] },
    };
  }

  return {
    stages: [
      { duration: '30s', target: 20 }, // 20VU までランプアップ
      { duration: '2m', target: 20 }, // 20VU を 2 分間維持
      { duration: '30s', target: 0 }, // クールダウン
    ],
    thresholds: loadThresholds,
  };
}
