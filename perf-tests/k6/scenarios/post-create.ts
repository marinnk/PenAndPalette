import http from 'k6/http';
import { check } from 'k6';

import { BASE_URL, SEED_USER_COUNT } from '../lib/config.ts';
import { getAuthHeaders, userNumberForVu } from '../lib/auth.ts';
import { buildOptions } from '../lib/options.ts';

// 投稿作成の書き込み負荷。小説投稿（タイトル＋本文のみ、画像なし）に絞る
// ・イラスト投稿は画像必須で S3/MinIO の可用性に依存するため対象外（perf-tests/README.md 参照）。
//
// 【注意】このシナリオは DB に投稿を書き込む。実行後は perf-tests/seed で再投入して片付ける。
export const options = buildOptions({
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<1000'],
});

export default function () {
  const headers = getAuthHeaders(userNumberForVu(SEED_USER_COUNT));

  // k6 はオブジェクト body を application/x-www-form-urlencoded で送る。
  // DRF の FormParser がフォーム値として受け取り、PostCreateSerializer が処理する。
  const res = http.post(
    `${BASE_URL}/api/posts`,
    {
      post_type: 'novel',
      title: `perf load test post ${__VU}-${__ITER}`,
      body: `perf load test body from VU ${__VU} iteration ${__ITER}. `.repeat(4),
    },
    { headers, tags: { name: 'POST /api/posts' } },
  );

  check(res, {
    'post-create: status 201': (r) => r.status === 201,
  });
}
