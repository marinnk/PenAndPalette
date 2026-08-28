import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, SEED_USER_COUNT } from '../lib/config.ts';
import { getAuthHeaders, userNumberForVu } from '../lib/auth.ts';
import { safeJsonParse } from '../lib/json.ts';
import { buildOptions } from '../lib/options.ts';

// 高頻度な操作系：いいね/かきたいの登録・解除（冪等な POST/DELETE）とコメント作成。
// いずれも直後に with_reactions() で投稿を読み直して集計値を返す実装のため、書き込み＋
// 集計クエリのコストを見る。
//
// 【注意】コメント作成は DB に書き込む。実行後は perf-tests/seed で再投入して片付ける。
export const options = buildOptions({
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<1000'],
});

interface TimelineResponse {
  results: { id: number }[];
}

export default function () {
  const headers = getAuthHeaders(userNumberForVu(SEED_USER_COUNT));

  // 反応対象の投稿をタイムライン先頭から 1 件選ぶ
  const timeline = http.get(`${BASE_URL}/api/posts`, {
    headers,
    tags: { name: 'GET /api/posts' },
  });
  const results = safeJsonParse<TimelineResponse>(timeline.body)?.results ?? [];
  if (results.length === 0) {
    return;
  }
  const postId = results[__ITER % results.length].id;

  const like = http.post(`${BASE_URL}/api/posts/${postId}/likes`, null, {
    headers,
    tags: { name: 'POST /api/posts/{id}/likes' },
  });
  check(like, { 'like: status 200': (r) => r.status === 200 });

  const want = http.post(`${BASE_URL}/api/posts/${postId}/wants`, null, {
    headers,
    tags: { name: 'POST /api/posts/{id}/wants' },
  });
  check(want, { 'want: status 200': (r) => r.status === 200 });

  const comment = http.post(
    `${BASE_URL}/api/posts/${postId}/comments`,
    { content: `perf load test comment ${__VU}-${__ITER}` },
    { headers, tags: { name: 'POST /api/posts/{id}/comments' } },
  );
  check(comment, { 'comment: status 201': (r) => r.status === 201 });

  // 登録しっぱなしにせず解除も測る（冪等な DELETE エンドポイント）
  const unlike = http.del(`${BASE_URL}/api/posts/${postId}/likes`, null, {
    headers,
    tags: { name: 'DELETE /api/posts/{id}/likes' },
  });
  check(unlike, { 'unlike: status 200': (r) => r.status === 200 });

  const unwant = http.del(`${BASE_URL}/api/posts/${postId}/wants`, null, {
    headers,
    tags: { name: 'DELETE /api/posts/{id}/wants' },
  });
  check(unwant, { 'unwant: status 200': (r) => r.status === 200 });

  sleep(1);
}
