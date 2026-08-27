// performanceトラックのspecから使う、時間計測結果の記録＋しきい値検証ヘルパー。
//
// Playwrightのworkerはspecファイルごとに別プロセスになり得るため、インメモリ配列を複数specで
// 共有する方式は取らない。testInfo.attach() でテストごとにJSONを添付し、カスタムレポーター
// （perfReporter.ts）が onTestEnd で収集・onEnd で集計JSONへ書き出す。

import { expect, type TestInfo } from '@playwright/test'

export const PERF_ATTACHMENT_NAME = 'perf-timing'

export interface TimingEntry {
  journey: string
  ms: number
  threshold: number
  timestamp: string
}

/**
 * 計測結果を記録し、しきい値に対する検証も行う（超過はテスト失敗）。
 * しきい値は「劣化に気づくための目安」であって厳密な SLA ではない
 * （docs/basic-design.md 5章の非機能要件は学習用途規模を前提）。初期値は暫定のため、
 * 一度実行して得られた実測値をもとに調整すること（e2e/README.md 参照）。
 */
export async function recordTiming(
  testInfo: TestInfo,
  journey: string,
  ms: number,
  threshold: number,
) {
  const entry: TimingEntry = { journey, ms, threshold, timestamp: new Date().toISOString() }
  await testInfo.attach(PERF_ATTACHMENT_NAME, {
    body: JSON.stringify(entry),
    contentType: 'application/json',
  })
  expect(ms, `${journey}: ${ms.toFixed(0)}ms（目安 ${threshold}ms）`).toBeLessThan(threshold)
}
