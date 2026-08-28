/**
 * レスポンスボディを JSON としてパースする。失敗しても例外を投げない。
 *
 * k6 は `check()` のコールバックや `export default function` 本体で例外が投げられると、
 * その場でイテレーションを打ち切る（後続のコードは実行されない）。もし `sleep()` より前で
 * JSON.parse が例外を投げると、意図した待機が発生しないまま次のイテレーションに突入し、
 * VU が待機なしでリクエストを送り続ける暴走状態になりうる。ステータスが 2xx 以外・ボディが
 * 不正な JSON の場合は undefined を返すだけにして、この事故を防ぐ。
 */
export function safeJsonParse<T>(body: string | ArrayBuffer | null): T | undefined {
  if (typeof body !== 'string' || body.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    return undefined;
  }
}
