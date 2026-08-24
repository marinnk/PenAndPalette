<script setup lang="ts">
// S04 投稿作成画面。自分の投稿の[編集]から開いた場合はmode="edit"で同じ画面を再利用する
// （画面設計書169行目）。純表示コンポーネントとして、状態・API呼び出しは持たず
// PostCreateView/PostEditViewからpropsで受け取った値を描画し、操作をemitで返すだけに徹する
const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    body: string
    imagePreviews: string[]
    canAddMore: boolean
    submitDisabled: boolean
    submitting: boolean
    errorMessage?: string | null
    fieldErrors: Record<string, string[]>
    imagePickError?: string | null
  }>(),
  { errorMessage: null, imagePickError: null },
)
const emit = defineEmits<{
  'update:body': [value: string]
  'add-image': [file: File]
  'remove-image': [index: number]
  submit: []
  cancel: []
}>()

const heading = props.mode === 'edit' ? '投稿を編集' : '投稿する'
const submitLabel = props.mode === 'edit' ? '保存する' : '投稿する'

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('add-image', file)
  // 同じファイルを削除後に再度選び直せるよう、inputの値をクリアしておく
  input.value = ''
}
</script>

<template>
  <main class="form-card">
    <h1>{{ heading }}</h1>
    <form @submit.prevent="emit('submit')">
      <div class="form-field">
        <label for="post-body">本文（280文字まで）</label>
        <textarea
          id="post-body"
          :value="body"
          maxlength="280"
          rows="4"
          data-testid="post-body"
          @input="emit('update:body', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <p class="post-compose-counter" data-testid="post-body-counter">{{ body.length }}/280</p>
        <p
          v-for="message in fieldErrors.body ?? []"
          :key="message"
          class="field-error"
          data-testid="post-body-error"
        >
          {{ message }}
        </p>
      </div>

      <div class="form-field">
        <label>画像（任意・0〜4枚）</label>
        <div class="post-compose-images">
          <div v-for="(preview, i) in imagePreviews" :key="preview" class="post-compose-image-slot">
            <img :src="preview" :alt="`添付画像${i + 1}`" />
            <button
              type="button"
              :data-testid="`post-image-remove-${i}`"
              @click="emit('remove-image', i)"
            >
              削除
            </button>
          </div>
          <label v-if="canAddMore" class="post-compose-image-add" data-testid="post-image-add">
            追加
            <input
              type="file"
              accept="image/jpeg,image/png"
              class="visually-hidden"
              data-testid="post-image-input"
              @change="onFileSelected"
            />
          </label>
        </div>
        <p v-if="imagePickError" class="field-error" data-testid="post-image-pick-error">
          {{ imagePickError }}
        </p>
        <p
          v-for="message in fieldErrors.images ?? []"
          :key="message"
          class="field-error"
          data-testid="post-image-error"
        >
          {{ message }}
        </p>
      </div>

      <p v-if="errorMessage" class="field-error" data-testid="post-compose-error">
        {{ errorMessage }}
      </p>
      <div class="form-actions">
        <button type="button" data-testid="post-compose-cancel" @click="emit('cancel')">
          キャンセル
        </button>
        <button
          type="submit"
          class="form-submit"
          :disabled="submitDisabled || submitting"
          data-testid="post-compose-submit"
        >
          {{ submitLabel }}
        </button>
      </div>
    </form>
  </main>
</template>
