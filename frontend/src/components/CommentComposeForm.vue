<script setup lang="ts">
import { computed } from 'vue'
import AvatarIcon from '@/components/AvatarIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { pickFileFromInput } from '@/lib/fileInput'

// S05 投稿詳細画面下部のコメント投稿フォーム（画面設計書186〜188行目）。PostComposeFormと
// 同じく純表示コンポーネントとして、状態・API呼び出しは持たずPostDetailViewから
// propsで受け取った値を描画し、操作をemitで返すだけに徹する
const props = withDefaults(
  defineProps<{
    content: string
    imagePreview: string | null
    submitting: boolean
    errorMessage?: string | null
    fieldErrors?: Record<string, string[]>
    imagePickError?: string | null
  }>(),
  { errorMessage: null, fieldErrors: () => ({}), imagePickError: null },
)
const emit = defineEmits<{
  'update:content': [value: string]
  'add-image': [file: File]
  'remove-image': []
  submit: []
}>()

const auth = useAuthStore()

// 画像エラー（クライアント側検証のimagePickError・サーバー側検証のfieldErrors.image）を
// 1本のメッセージ一覧にまとめ、テンプレート側は単一のv-forだけで両方を表示する
const imageErrors = computed(() => [
  ...(props.imagePickError ? [props.imagePickError] : []),
  ...(props.fieldErrors.image ?? []),
])
const canSubmit = computed(() => props.content.trim().length > 0 || !!props.imagePreview)

function onFileSelected(event: Event) {
  const file = pickFileFromInput(event)
  if (file) emit('add-image', file)
}

function onSubmit() {
  if (!canSubmit.value) return
  emit('submit')
}
</script>

<template>
  <form class="comment-compose-form" data-testid="comment-compose-form" @submit.prevent="onSubmit">
    <div class="comment-compose-row">
      <AvatarIcon :src="auth.currentUser?.avatar_url" :size="24" />
      <textarea
        :value="content"
        maxlength="280"
        rows="2"
        placeholder="コメントを入力"
        aria-label="コメントを入力"
        data-testid="comment-body"
        @input="emit('update:content', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <label v-if="!imagePreview" class="comment-compose-image-add" data-testid="comment-image-add">
        画像を追加
        <input
          type="file"
          accept="image/jpeg,image/png"
          class="visually-hidden"
          data-testid="comment-image-input"
          @change="onFileSelected"
        />
      </label>
    </div>

    <div v-if="imagePreview" class="comment-compose-image-preview">
      <img :src="imagePreview" alt="添付画像のプレビュー" />
      <button type="button" data-testid="comment-image-remove" @click="emit('remove-image')">
        削除
      </button>
    </div>

    <p class="post-compose-counter" data-testid="comment-body-counter">{{ content.length }}/280</p>
    <p
      v-for="message in fieldErrors.content ?? []"
      :key="message"
      class="field-error"
      data-testid="comment-body-error"
    >
      {{ message }}
    </p>
    <p
      v-for="message in imageErrors"
      :key="message"
      class="field-error"
      data-testid="comment-image-error"
    >
      {{ message }}
    </p>
    <p v-if="errorMessage" class="field-error" data-testid="comment-compose-error">
      {{ errorMessage }}
    </p>

    <div class="form-actions">
      <button
        type="submit"
        class="form-submit"
        :disabled="submitting || !canSubmit"
        data-testid="comment-compose-submit"
      >
        コメントする
      </button>
    </div>
  </form>
</template>
