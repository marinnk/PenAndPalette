/** `<input type="file">`のchangeイベントから選択されたファイルを取り出す。
 * 同じファイルを削除後に再度選び直せるよう、呼び出し後にinputの値をクリアする
 * （PostComposeForm・CommentComposeFormで共通）。
 */
export function pickFileFromInput(event: Event): File | null {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  return file
}
