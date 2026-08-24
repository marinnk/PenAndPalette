// バックエンドの画像検証ルール（common/storage.pyのMAX_IMAGE_SIZE_BYTES・
// ALLOWED_CONTENT_TYPES、posts/serializers.pyのPostCreateSerializer.MAX_IMAGES）を
// クライアント側にも複製したもの（言語が異なるため実行時に1つの定義を共有することはできない）。
// 値を変更する場合は対応するバックエンド側も必ず合わせて変更すること。
// usePostCreate・usePostEditの両方で共有する
export const MAX_IMAGES = 4
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

/** 画像を1枚追加できるか検証する。currentCountは追加前の（既存を含む）合計枚数。
 * バックエンドのvalidate_image_file（common/storage.py）と同じルールをクライアント側でも
 * チェックし、送信前にその場でエラーを返せるようにする。サーバー側のfieldErrors.imagesは
 * このチェックをすり抜けたものに対する最終防衛線として残る
 */
export function validateNewImage(file: File, currentCount: number): string | null {
  if (currentCount >= MAX_IMAGES) return `画像は${MAX_IMAGES}枚まで添付できます。`
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return '画像はjpgまたはpng形式のみ添付できます。'
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) return '画像は1枚あたり5MBまでです。'
  return null
}
