import http from 'k6/http';
import { check } from 'k6';

import { BASE_URL, SEED_USER_COUNT } from '../lib/config.ts';
import { getAuthHeaders, userNumberForVu } from '../lib/auth.ts';
import { buildOptions } from '../lib/options.ts';

// 届いたリクエスト一覧（GET /api/requests/received）。フォロワー一覧と同じく意図的な
// 非ページネーション。ヘッダーの通知バッジが画面遷移のたびに叩くエンドポイントのため、
// 実アクセス頻度は高い。seed_perf_data はリクエストを投入しないので通常は空配列が返る
// （空でも集計・シリアライズの経路は通る）。
export const options = buildOptions({
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<500'],
});

export default function () {
  const headers = getAuthHeaders(userNumberForVu(SEED_USER_COUNT));

  const res = http.get(`${BASE_URL}/api/requests/received`, {
    headers,
    tags: { name: 'GET /api/requests/received' },
  });
  check(res, {
    'requests-list: status 200': (r) => r.status === 200,
  });
}
