<script setup lang="ts">
import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import PostCard from '@/components/PostCard.vue'
import type { Post } from '@/types/post'

// S06 リクエスト作成画面。PostComposeForm.vueと同じprops/emit構成の表示コンポーネントだが、
// 「参考にしてほしい投稿」欄だけは例外的にこのコンポーネント内で完結するローカルなプレビュー
// 取得（GET /api/posts/{id}）を行う。共有状態を持たない単発フェッチのため、
// 専用のcomposableを新設するほどではないと判断した
const props = withDefaults(
  defineProps<{
    toDisplayName: string
    message: string
    relatedPostId: string
    submitting: boolean
    errorMessage?: string | null
    fieldErrors: Record<string, string[]>
  }>(),
  { errorMessage: null },
)
const emit = defineEmits<{
  'update:message': [value: string]
  'update:relatedPostId': [value: string]
  submit: []
  cancel: []
}>()

const previewPost = ref<Post | null>(null)
const previewLoading = ref(false)
const previewError = ref<string | null>(null)

async function fetchPreview() {
  const raw = props.relatedPostId.trim()
  previewPost.value = null
  previewError.value = null
  if (!raw) return

  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) {
    previewError.value = '投稿IDは数値で指定してください。'
    return
  }

  previewLoading.value = true
  try {
    const { data } = await apiClient.get<Post>(`/api/posts/${id}`)
    previewPost.value = data
  } catch {
    previewError.value = '投稿が見つかりません。'
  } finally {
    previewLoading.value = false
  }
}
</script>

<template>
  <main class="form-card">
    <h1>{{ toDisplayName }} さんにリクエストする</h1>
    <form @submit.prevent="emit('submit')">
      <div class="form-field">
        <label for="request-message">どんな作品をリクエストしますか？（280文字まで）</label>
        <textarea
          id="request-message"
          :value="message"
          maxlength="280"
          rows="4"
          data-testid="request-message"
          @input="emit('update:message', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <p class="post-compose-counter" data-testid="request-message-counter">
          {{ message.length }}/280
        </p>
        <p
          v-for="msg in fieldErrors.message ?? []"
          :key="msg"
          class="field-error"
          data-testid="request-message-error"
        >
          {{ msg }}
        </p>
      </div>

      <div class="form-field">
        <label for="request-related-post-id">参考にしてほしい投稿（任意・投稿IDで指定）</label>
        <input
          id="request-related-post-id"
          type="text"
          inputmode="numeric"
          :value="relatedPostId"
          data-testid="request-related-post-id"
          @input="emit('update:relatedPostId', ($event.target as HTMLInputElement).value)"
          @blur="fetchPreview"
        />
        <p
          v-for="msg in fieldErrors.related_post_id ?? []"
          :key="msg"
          class="field-error"
          data-testid="request-related-post-id-error"
        >
          {{ msg }}
        </p>
        <p v-if="previewLoading" data-testid="request-related-post-preview-loading">
          読み込み中...
        </p>
        <p
          v-else-if="previewError"
          class="field-error"
          data-testid="request-related-post-preview-error"
        >
          {{ previewError }}
        </p>
        <PostCard
          v-else-if="previewPost"
          :post="previewPost"
          :clickable="false"
          data-testid="request-related-post-preview"
        />
      </div>

      <p v-if="errorMessage" class="field-error" data-testid="request-compose-error">
        {{ errorMessage }}
      </p>
      <div class="form-actions">
        <button type="button" data-testid="request-compose-cancel" @click="emit('cancel')">
          キャンセル
        </button>
        <button
          type="submit"
          class="form-submit"
          :disabled="message.trim().length === 0 || submitting"
          data-testid="request-compose-submit"
        >
          リクエストする
        </button>
      </div>
    </form>
  </main>
</template>
