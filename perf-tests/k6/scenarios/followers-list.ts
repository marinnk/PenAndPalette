import http from 'k6/http';
import { check } from 'k6';

import { BASE_URL, SEED_USER_COUNT } from '../lib/config.ts';
import { getAuthHeaders, userNumberForVu } from '../lib/auth.ts';
import { resolvePopularUserId } from '../lib/users.ts';
import { buildOptions } from '../lib/options.ts';

// フォロワー一覧（GET /api/users/{id}/followers）。基本設計書 6.9節の方針で意図的に
// 非ページネーション（LIMIT なし全件取得）。フォロワーが最多のユーザー（perf_user_0001＝
// 499 フォロワー）で、全件返す設計が同時アクセス時にどう振る舞うかを見る。
export const options = buildOptions({
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<800'],
});

export default function () {
  const headers = getAuthHeaders(userNumberForVu(SEED_USER_COUNT));
  const userId = resolvePopularUserId(headers);
  if (!userId) {
    return;
  }

  const followers = http.get(`${BASE_URL}/api/users/${userId}/followers`, {
    headers,
    tags: { name: 'GET /api/users/{id}/followers' },
  });
  check(followers, {
    'followers-list: status 200': (r) => r.status === 200,
  });

  const following = http.get(`${BASE_URL}/api/users/${userId}/following`, {
    headers,
    tags: { name: 'GET /api/users/{id}/following' },
  });
  check(following, {
    'following-list: status 200': (r) => r.status === 200,
  });
}
