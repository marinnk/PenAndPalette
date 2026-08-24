<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePostCreate } from '@/composables/usePostCreate'

// S04 投稿作成画面
const router = useRouter()
const {
  body,
  images,
  imagePreviews,
  submitting,
  errorMessage,
  fieldErrors,
  addImage,
  removeImage,
  submit,
} = usePostCreate()

const imagePickError = ref<string | null>(null)

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    imagePickError.value = addImage(file)
  }
  // 同じファイルを削除後に再度選び直せるよう、inputの値をクリアしておく
  input.value = ''
}

async function handleSubmit() {
  const post = await submit()
  if (post) {
    router.push({ name: 'timeline' })
  }
}
</script>

<template>
  <main class="form-card">
    <h1>投稿する</h1>
    <form @submit.prevent="handleSubmit">
      <div class="form-field">
        <label for="post-body">本文（280文字まで）</label>
        <textarea
          id="post-body"
          v-model="body"
          maxlength="280"
          rows="4"
          data-testid="post-body"
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
          <div
            v-for="(preview, i) in imagePreviews"
            :key="preview"
            class="post-compose-image-slot"
          >
            <img :src="preview" :alt="`添付画像${i + 1}`" />
            <button
              type="button"
              :data-testid="`post-image-remove-${i}`"
              @click="removeImage(i)"
            >
              削除
            </button>
          </div>
          <label v-if="images.length < 4" class="post-compose-image-add" data-testid="post-image-add">
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

      <p v-if="errorMessage" class="field-error" data-testid="post-create-error">
        {{ errorMessage }}
      </p>
      <div class="form-actions">
        <button
          type="button"
          data-testid="post-create-cancel"
          @click="router.push({ name: 'timeline' })"
        >
          キャンセル
        </button>
        <button
          type="submit"
          class="form-submit"
          :disabled="submitting || (body.trim().length === 0 && images.length === 0)"
          data-testid="post-create-submit"
        >
          投稿する
        </button>
      </div>
    </form>
  </main>
</template>
