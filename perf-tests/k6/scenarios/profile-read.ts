import http from 'k6/http';
import { check } from 'k6';

import { BASE_URL, SEED_USER_COUNT } from '../lib/config.ts';
import { getAuthHeaders, userNumberForVu } from '../lib/auth.ts';
import { resolvePopularUserId } from '../lib/users.ts';
import { buildOptions } from '../lib/options.ts';

// プロフィール表示（GET /api/users/{id}）。フォロー中数・フォロワー数の集計（with_follow_stats の
// distinct 付き Count）と「自分がフォロー中か」の Exists サブクエリのコストを、フォロワーが
// 最も多いユーザー（perf_user_0001＝499 フォロワー）に対して見る。
export const options = buildOptions({
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<600'],
});

export default function () {
  const headers = getAuthHeaders(userNumberForVu(SEED_USER_COUNT));
  const userId = resolvePopularUserId(headers);
  if (!userId) {
    return;
  }

  const res = http.get(`${BASE_URL}/api/users/${userId}`, {
    headers,
    tags: { name: 'GET /api/users/{id}' },
  });
  check(res, {
    'profile-read: status 200': (r) => r.status === 200,
  });
}
