import http from 'k6/http';
import { check } from 'k6';

import { BASE_URL, SEED_USER_PASSWORD, seedEmail } from './config.ts';

/**
 * seed_perf_data で投入したダミーユーザーとして、毎回実際にログインリクエストを送る。
 * auth-login.ts のようにログイン自体の負荷を測りたいシナリオで使う
 * （他のシナリオは代わりに `getAuthHeaders` を使う）。
 */
export function performLogin(userNumber: number) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: seedEmail(userNumber), password: SEED_USER_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /api/auth/login' } },
  );
  check(res, { 'login: status is 200': (r) => r.status === 200 });
  return res;
}

let cachedAuthHeader: { Cookie: string } | undefined;

/**
 * ログイン済みユーザーとして API を呼ぶための Cookie ヘッダーを返す。VU ごとに一度だけ
 * 実際にログインし、以降は結果をキャッシュして使い回す。
 *
 * 【重要】k6（v2.2.0 で確認）は、ドキュメント上「per-VU の Cookie jar はイテレーションを
 * またいで持続する」とされているが、実際には次のイテレーション開始時に jar が空になり
 * Cookie が送られなくなる現象がある。そのため自動送信の jar には頼らず、ログイン時の
 * Set-Cookie から access_token の値だけを明示的に取り出し、呼び出し側が全リクエストの
 * `headers` に付与する方式にしている。
 */
export function getAuthHeaders(userNumber: number): { Cookie: string } {
  if (!cachedAuthHeader) {
    const res = performLogin(userNumber);
    const token = extractCookieValue(res.headers['Set-Cookie'], 'access_token');
    cachedAuthHeader = { Cookie: token ? `access_token=${token}` : '' };
  }
  return cachedAuthHeader;
}

function extractCookieValue(setCookieHeader: string | undefined, name: string): string | undefined {
  if (!setCookieHeader) {
    return undefined;
  }
  // Set-Cookie が複数（access_token・refresh_token）ある場合、k6 は "," 区切りで 1 つの
  // 文字列に結合するが、Expires 属性の値自体に "," が含まれるため単純に "," 分割できない。
  // トークン値は JWT（英数字・-_. のみ）のため、";" か "," の手前までを値として取り出せば安全。
  const match = setCookieHeader.match(new RegExp(`${name}=([^;,]+)`));
  return match?.[1];
}

/**
 * VU ごとに 1〜seedUserCount の範囲で異なるユーザー番号を割り当てる。
 * 同じ VU は実行中ずっと同じユーザーとしてログインする。
 */
export function userNumberForVu(seedUserCount: number): number {
  return ((__VU - 1) % seedUserCount) + 1;
}
