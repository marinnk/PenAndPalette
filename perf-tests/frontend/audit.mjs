// Lighthouse で認証後のタイムライン画面を監査する。
//
// フロント（:5173）とバックエンド API（:8000）が別オリジンのため、`lighthouse --extra-headers`
// で Cookie を注入する方式（RaiseTechSNS のやり方）は、クロスオリジンの XHR（withCredentials）
// に Cookie が正しく乗らず認証に失敗する。そのため Puppeteer で実ブラウザに本物の Cookie を
// セットしてから Lighthouse をそのページ上で走らせる。
//
// puppeteer-core・chrome-launcher はいずれも lighthouse の依存として既に入っている。
//
// 使い方（perf-tests/frontend/run.sh から呼ばれる。単体実行も可）:
//   node perf-tests/frontend/audit.mjs
//   BASE_URL=... FRONTEND_URL=... TARGET_PATH=/timeline OUT_PATH=/abs/path/timeline-<ts> node audit.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import lighthouse from 'lighthouse';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// タイムライン画面のパスは "/"（router で name:"timeline" だが path は "/"）。
const TARGET_PATH = process.env.TARGET_PATH || '/';
const EMAIL = process.env.EMAIL || 'perf_user_0001@example.com';
const PASSWORD = process.env.PASSWORD || 'Passw0rd!';
const OUT_PATH = process.env.OUT_PATH || `perf-tests/results/lighthouse/timeline-${timestamp()}`;

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

// 1. API に直接ログインして Set-Cookie を得る
const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!loginRes.ok) {
  console.error(
    `ログインに失敗しました（${loginRes.status}）。backend が起動しているか、` +
      `\`python manage.py seed_perf_data\` を実行済みか確認してください。`,
  );
  process.exit(1);
}
const cookies = loginRes.headers.getSetCookie().map((raw) => {
  const [pair] = raw.split(';');
  const eq = pair.indexOf('=');
  // Cookie はポートを区別しないため domain は 'localhost' でフロント・バックエンド双方に送られる
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: 'localhost', path: '/' };
});
if (cookies.length === 0) {
  console.error('認証 Cookie を取得できませんでした。');
  process.exit(1);
}

// 2. 実ブラウザに本物の Cookie をセットしてから Lighthouse を走らせる
const browser = await puppeteer.launch({
  headless: true,
  executablePath: Launcher.getFirstInstallation(),
  args: ['--no-sandbox'],
});
try {
  await browser.setCookie(...cookies);
  const page = await browser.newPage();

  const url = `${FRONTEND_URL}${TARGET_PATH}`;
  console.log(`Running Lighthouse against ${url} (authenticated) ...`);
  const runnerResult = await lighthouse(
    url,
    { output: ['html', 'json'], onlyCategories: ['performance'], logLevel: 'error' },
    undefined,
    page,
  );

  const [html, json] = runnerResult.report;
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(`${OUT_PATH}.report.html`, html);
  writeFileSync(`${OUT_PATH}.report.json`, json);

  const score = runnerResult.lhr.categories.performance.score;
  console.log(`Report written to ${OUT_PATH}.report.html`);
  console.log(`Performance score: ${score === null ? 'n/a' : Math.round(score * 100)}`);
} finally {
  await browser.close();
}
