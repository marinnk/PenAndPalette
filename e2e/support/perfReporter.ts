// performanceトラックの計測結果（perfTiming.ts の recordTiming が添付したJSON）を集めて、
// e2e/results/performance/ にサマリーJSONとして書き出すカスタムレポーター。
//
// Playwrightは「レポーターをプロジェクトごとに切り替える」仕組みを持たないため、このレポーターは
// 全プロジェクトに対して登録した上で、テストの所属プロジェクトが 'performance' のものだけを
// 対象にする（onTestEnd 内でフィルタする）。

import fs from 'node:fs'
import path from 'node:path'
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { PERF_ATTACHMENT_NAME, type TimingEntry } from './perfTiming'

export default class PerfReporter implements Reporter {
  private readonly entries: TimingEntry[] = []

  onTestEnd(test: TestCase, result: TestResult): void {
    if (test.parent.project()?.name !== 'performance') return

    for (const attachment of result.attachments) {
      if (attachment.name !== PERF_ATTACHMENT_NAME || !attachment.body) continue
      try {
        this.entries.push(JSON.parse(attachment.body.toString('utf-8')) as TimingEntry)
      } catch {
        // 添付データが壊れている場合は無視する（レポート生成自体は継続する）
      }
    }
  }

  onEnd(_result: FullResult): void {
    if (this.entries.length === 0) return

    const outDir = path.join(process.cwd(), 'results', 'performance')
    fs.mkdirSync(outDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const outPath = path.join(outDir, `performance-${timestamp}.json`)
    fs.writeFileSync(outPath, JSON.stringify(this.entries, null, 2))

    console.log(`\nPerformance summary written to ${path.relative(process.cwd(), outPath)}`)
    for (const entry of this.entries) {
      const status = entry.ms > entry.threshold ? '✗ EXCEEDED' : '✓'
      console.log(`  ${status} ${entry.journey}: ${entry.ms.toFixed(0)}ms (目安 ${entry.threshold}ms)`)
    }
  }
}
