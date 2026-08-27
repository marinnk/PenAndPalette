// 画像アップロード／バリデーション系のシナリオで使う、固定のテスト用ファイル。
//
// 有効な画像（jpg/png、数百バイト）と不正なファイル（.txt）は小さいためリポジトリにコミットする。
// 5MB超の巨大ファイルはコミットせず、必要なテストがその場でBufferを動的生成する
// （oversizedImageFile 参照）。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures-files')

export const VALID_JPG = path.join(FIXTURES_DIR, 'valid-small.jpg')
export const VALID_PNG = path.join(FIXTURES_DIR, 'valid-small.png')
export const INVALID_TXT = path.join(FIXTURES_DIR, 'invalid.txt')

/** APIヘルパー（support/api.ts）が multipart のパートに載せるためにファイルの中身を読む。 */
export function readFixture(fixturePath: string): Buffer {
  return fs.readFileSync(fixturePath)
}

// frontend/src/composables/postImageValidation.ts の MAX_IMAGE_SIZE_BYTES（5MB）を
// 1バイトだけ超えるダミーファイル。クライアント側検証はサイズしか見ないため中身は0埋めで十分。
export function oversizedImageFile(): { name: string; mimeType: string; buffer: Buffer } {
  const FIVE_MB = 5 * 1024 * 1024
  return {
    name: 'oversized.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(FIVE_MB + 1, 0),
  }
}
