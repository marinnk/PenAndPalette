import http from 'k6/http';

import { BASE_URL, POPULAR_USERNAME } from './config.ts';
import { safeJsonParse } from './json.ts';

interface UserSummary {
  id: number;
  username: string;
}

/**
 * 「人気ユーザー」（seed_perf_data が全員にフォローさせる perf_user_0001）の ID を、
 * ユーザー検索エンドポイント経由で 1 回だけ解決してキャッシュする。
 * profile-read / followers-list シナリオが対象ユーザーを特定するために使う。
 */
let cachedPopularUserId: number | undefined;

export function resolvePopularUserId(authHeaders: { Cookie: string }): number | undefined {
  if (cachedPopularUserId === undefined) {
    const res = http.get(`${BASE_URL}/api/users/?q=${POPULAR_USERNAME}`, {
      headers: authHeaders,
      tags: { name: 'GET /api/users/?q=' },
    });
    const results = safeJsonParse<UserSummary[]>(res.body) ?? [];
    const match = results.find((u) => u.username === POPULAR_USERNAME);
    cachedPopularUserId = match?.id;
  }
  return cachedPopularUserId;
}
