import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, SEED_USER_COUNT } from '../lib/config.ts';
import { getAuthHeaders, userNumberForVu } from '../lib/auth.ts';
import { safeJsonParse } from '../lib/json.ts';
import { buildOptions } from '../lib/options.ts';

// 最優先シナリオ。GET /api/posts は全ログインユーザーが 30 秒間隔でポーリングし、かつ
// 無限スクロールでも叩く（基本設計書 6.9〜6.10節）。id 基準カーソルページネーションと、
// いいね数・かきたい数・コメント数の annotate() 集計（N+1 回避）が効いているかを見る。
export const options = buildOptions({
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<800'],
});

interface TimelinePost {
  id: number;
}

interface TimelineResponse {
  results: TimelinePost[];
  has_more: boolean;
}

export default function () {
  const headers = getAuthHeaders(userNumberForVu(SEED_USER_COUNT));

  // 1 ページ目（ポーリング時と同じリクエスト）
  const first = http.get(`${BASE_URL}/api/posts`, {
    headers,
    tags: { name: 'GET /api/posts' },
  });
  check(first, {
    'timeline page 1: status 200': (r) => r.status === 200,
  });

  // 2 ページ目（無限スクロール）。has_more なら、最後の投稿 id を before_id として続きを取得する
  const body = safeJsonParse<TimelineResponse>(first.body);
  if (body?.has_more && body.results.length > 0) {
    const lastId = body.results[body.results.length - 1].id;
    const second = http.get(`${BASE_URL}/api/posts?before_id=${lastId}`, {
      headers,
      tags: { name: 'GET /api/posts?before_id=' },
    });
    check(second, {
      'timeline page 2: status 200': (r) => r.status === 200,
    });
  }

  // 実アプリのポーリング間隔（30 秒）よりは短いが、VU が休みなく回り続けないよう間を空ける
  sleep(1);
}
