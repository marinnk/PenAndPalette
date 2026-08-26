// バックエンドの画像検証ルール（common/storage.pyのMAX_IMAGE_SIZE_BYTES・
// ALLOWED_CONTENT_TYPES、posts/serializers.pyのPostCreateSerializer.MAX_IMAGES）を
// クライアント側にも複製したもの（言語が異なるため実行時に1つの定義を共有することはできない）。
// 値を変更する場合は対応するバックエンド側も必ず合わせて変更すること。
// usePostCreate・usePostEditの両方で共有する
export const MAX_IMAGES = 4
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

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
 * クライアント側でチェックし、送信前にその場でエラーを返せるようにする。サーバー側の
 * fieldErrors.imagesは、このチェックをすり抜けたものに対する最終防衛線として残る
 */
export function validateNewImage(file: File, currentCount: number): string | null {
  if (currentCount >= MAX_IMAGES) return `画像は${MAX_IMAGES}枚まで添付できます。`
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
