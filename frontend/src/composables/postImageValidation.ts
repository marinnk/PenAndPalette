import type { PostType } from '@/types/post'

// バックエンドの画像検証ルール（common/storage.pyのMAX_IMAGE_SIZE_BYTES・
// ALLOWED_CONTENT_TYPES、posts/serializers.pyの各種MAX_*定数）を
// クライアント側にも複製したもの（言語が異なるため実行時に1つの定義を共有することはできない）。
// 値を変更する場合は対応するバックエンド側も必ず合わせて変更すること。
// usePostCreate・usePostEditの両方で共有する
// = posts/serializers.py MAX_ILLUSTRATION_IMAGES（旧MAX_POST_IMAGES）
export const MAX_ILLUSTRATION_IMAGES = 4
// = posts/serializers.py MAX_NOVEL_IMAGES（小説投稿のカバー画像は1枚まで）
export const MAX_NOVEL_IMAGES = 1
// = posts/serializers.py MAX_ILLUSTRATION_BODY_LENGTH
export const MAX_ILLUSTRATION_BODY_LENGTH = 280
// = posts/serializers.py MAX_NOVEL_BODY_LENGTH
export const MAX_NOVEL_BODY_LENGTH = 4000
// = posts/serializers.py MAX_TITLE_LENGTH
export const MAX_TITLE_LENGTH = 100
// = posts/serializers.py MAX_POST_TAGS
export const MAX_POST_TAGS = 5
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

/** 投稿種別ごとの画像枚数上限を返す（イラスト:4枚／小説:カバー1枚） */
export function maxImagesForType(postType: PostType): number {
  return postType === 'novel' ? MAX_NOVEL_IMAGES : MAX_ILLUSTRATION_IMAGES
}

/** 投稿種別ごとの本文文字数上限を返す（イラスト:280文字／小説:4000文字） */
export function maxBodyLengthForType(postType: PostType): number {
  return postType === 'novel' ? MAX_NOVEL_BODY_LENGTH : MAX_ILLUSTRATION_BODY_LENGTH
}

/** validateNewImage・validateAvatarFile・validateCommentImageに共通の、形式（jpg/png）・
 * サイズ（5MB）チェック。バックエンドのvalidate_image_file（common/storage.py）と同じルール
 */
export function checkImageFormatAndSize(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return '画像はjpgまたはpng形式のみ添付できます。'
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) return '画像は1枚あたり5MBまでです。'
  return null
}

/** 画像を1枚追加できるか検証する。currentCountは追加前の（既存を含む）合計枚数。
 * postTypeによってイラスト（4枚まで）／小説（カバー1枚まで）で上限が変わる。
 * クライアント側でチェックし、送信前にその場でエラーを返せるようにする。サーバー側の
 * fieldErrors.imagesは、このチェックをすり抜けたものに対する最終防衛線として残る
 */
export function validateNewImage(
  file: File,
  currentCount: number,
  postType: PostType,
): string | null {
  const max = maxImagesForType(postType)
  if (currentCount >= max) return `画像は${max}枚まで添付できます。`
  return checkImageFormatAndSize(file)
}

/** アイコン画像を検証する。投稿画像と違い常に1枚を選び直す（置き換える）だけのため、
 * validateNewImageと違い選択済み枚数のチェックは不要。useProfileEditで使う
 */
export function validateAvatarFile(file: File): string | null {
  return checkImageFormatAndSize(file)
}

/** コメント画像を検証する。アイコンと同じく常に1枚を選び直すだけなので、
 * 選択済み枚数のチェックは不要。useCommentsで使う
 */
export function validateCommentImage(file: File): string | null {
  return checkImageFormatAndSize(file)
}
