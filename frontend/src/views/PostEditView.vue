<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PostComposeForm from '@/components/PostComposeForm.vue'
import { usePostEdit } from '@/composables/usePostEdit'
import { MAX_IMAGES } from '@/composables/postImageValidation'

// S04 投稿作成画面を編集モードで開いた場合（画面設計書169行目）
const props = defineProps<{ id: string }>()
const router = useRouter()
const {
  body,
  keepImageIds,
  keepImagePreviews,
  images,
  imagePreviews,
  loading,
  loadError,
  submitting,
  errorMessage,
  fieldErrors,
  load,
  addImage,
  removeExistingImage,
  removeNewImage,
  submit,
} = usePostEdit()

const imagePickError = ref<string | null>(null)

onMounted(() => load(Number(props.id)))
// 同じルート（/posts/:id/edit）内で別の投稿idへ遷移した場合、Vue Routerはコンポーネント
// インスタンスを使い回しonMountedが再実行されないため、idの変化を監視して再読み込みする
// （PostDetailView.vue・ProfileView.vueと同じパターン）
watch(
  () => props.id,
  (id) => load(Number(id)),
)

function onAddImage(file: File) {
  imagePickError.value = addImage(file)
}

// 表示上は既存画像→新規画像の順に結合し、どちらの削除処理を呼ぶかはインデックスで振り分ける
// （PostComposeForm側は結合済みの1つの配列としてしか画像スロットを扱わない）
function onRemoveImage(index: number) {
  if (index < keepImagePreviews.value.length) {
    removeExistingImage(index)
  } else {
    removeNewImage(index - keepImagePreviews.value.length)
  }
}

async function handleSubmit() {
  const post = await submit()
  if (post) {
    // 編集は複数画面（タイムライン・詳細・プロフィール）から開けるため、常に投稿詳細へ
    // 遷移させるのではなく、実際に遷移してきた画面へそのまま戻る。編集画面へ遷移する際に
    // 元の画面はアンマウントされ、戻った際に再マウント（onMounted）されるため、
    // タイムライン・プロフィールに戻っても編集後の内容は再取得されて反映される
    router.back()
  }
}
</script>

<template>
  <p v-if="loading" data-testid="post-edit-loading">読み込み中...</p>
  <p v-else-if="loadError" class="field-error" data-testid="post-edit-error">
    投稿が見つかりませんでした。
  </p>
  <PostComposeForm
    v-else
    mode="edit"
    :body="body"
    :image-previews="[...keepImagePreviews, ...imagePreviews]"
    :can-add-more="keepImageIds.length + images.length < MAX_IMAGES"
    :submit-disabled="body.trim().length === 0 && keepImageIds.length === 0 && images.length === 0"
    :submitting="submitting"
    :error-message="errorMessage"
    :field-errors="fieldErrors"
    :image-pick-error="imagePickError"
    @update:body="body = $event"
    @add-image="onAddImage"
    @remove-image="onRemoveImage"
    @submit="handleSubmit"
    @cancel="router.back()"
  />
</template>
