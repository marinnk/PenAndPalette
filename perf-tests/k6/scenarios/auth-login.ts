import { check } from 'k6';

import { SEED_USER_COUNT } from '../lib/config.ts';
import { performLogin, userNumberForVu } from '../lib/auth.ts';
import { buildOptions } from '../lib/options.ts';

// ログイン自体の負荷。Django のパスワードハッシュ（PBKDF2、既定の反復回数）検証コストが
// 同時ログイン時にどれだけ効くかを見る。毎イテレーション実際にログインする
// （getAuthHeaders のキャッシュは使わない）。
export const options = buildOptions({
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<1500'],
});

export default function () {
  const res = performLogin(userNumberForVu(SEED_USER_COUNT));
  check(res, {
    'login: sets access_token cookie': (r) => {
      const setCookie = r.headers['Set-Cookie'];
      return typeof setCookie === 'string' && setCookie.includes('access_token=');
    },
  });
}
