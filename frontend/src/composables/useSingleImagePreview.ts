import { onUnmounted, ref } from 'vue'

/** 1枚だけの画像プレビューURLを管理する小さなヘルパー。CommentListItemのインライン編集の
 * ように、コンポーネント側でURL.createObjectURL等のブラウザAPIに直接触れさせたくない場合に
 * 使う（本プロジェクトのESLint設定は.vueのscript内でグローバルURLを許可していないため、
 * usePostCreate・usePostEditと同じくブラウザAPI呼び出しは.ts側に閉じ込める）
 */
export function useSingleImagePreview() {
  const preview = ref<string | null>(null)

  function setFile(file: File) {
    if (preview.value) URL.revokeObjectURL(preview.value)
    preview.value = URL.createObjectURL(file)
  }

  function clear() {
    if (preview.value) URL.revokeObjectURL(preview.value)
    preview.value = null
  }

  onUnmounted(clear)

  return { preview, setFile, clear }
}
