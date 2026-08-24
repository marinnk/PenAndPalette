<script setup lang="ts">
import { useRouter } from 'vue-router'
import { usePostCreate } from '@/composables/usePostCreate'

// S04 投稿作成画面（今回は本文のみのスタブ。画像添付は画像対応Issueで追加する）
const router = useRouter()
const { body, submitting, errorMessage, fieldErrors, submit } = usePostCreate()

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
          :disabled="submitting || body.trim().length === 0"
          data-testid="post-create-submit"
        >
          投稿する
        </button>
      </div>
    </form>
  </main>
</template>
