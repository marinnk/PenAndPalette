<script setup lang="ts">
import PostCard from '@/components/PostCard.vue'
import type { Post } from '@/types/post'
import type { PickerTab } from '@/composables/useRequestRelatedPostPicker'

// S06 リクエスト作成画面。PostComposeForm.vueと同じprops/emit構成の純粋な表示コンポーネント。
// 「参考にしてほしい投稿」pickerの状態・データ取得はRequestCreateView.vueが
// useRequestRelatedPostPicker（composable）経由で持ち、ここはpropsで受け取って
// 表示するだけに専念する（APIとの通信はcomponentではなくcomposableに分離するという
// プロジェクトの規約に合わせるため）
withDefaults(
  defineProps<{
    toDisplayName: string
    message: string
    submitting: boolean
    errorMessage?: string | null
    fieldErrors: Record<string, string[]>
    selectedPost: Post | null
    pickerOpen: boolean
    pickerTab: PickerTab
    pickerLoading: boolean
    pickerError: string | null
    pickerPosts: Post[]
  }>(),
  { errorMessage: null },
)
const emit = defineEmits<{
  'update:message': [value: string]
  submit: []
  cancel: []
  'open-picker': []
  'close-picker': []
  'switch-tab': [tab: PickerTab]
  'select-post': [post: Post]
  'clear-selection': []
}>()
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
        <label>参考にしてほしい投稿（任意）</label>

        <div v-if="selectedPost" class="request-related-post-selected">
          <PostCard :post="selectedPost" :clickable="false" preview />
          <button
            type="button"
            data-testid="request-related-post-clear"
            @click="emit('clear-selection')"
          >
            選択を解除する
          </button>
        </div>
        <button
          v-else
          type="button"
          data-testid="request-related-post-picker-toggle"
          @click="emit('open-picker')"
        >
          投稿を選ぶ
        </button>

        <div v-if="pickerOpen" class="request-related-post-picker">
          <div class="follow-list-tabs">
            <button
              type="button"
              :aria-pressed="pickerTab === 'own'"
              data-testid="request-related-post-tab-own"
              @click="emit('switch-tab', 'own')"
            >
              自分の投稿
            </button>
            <button
              type="button"
              :aria-pressed="pickerTab === 'target'"
              data-testid="request-related-post-tab-target"
              @click="emit('switch-tab', 'target')"
            >
              {{ toDisplayName }}の投稿
            </button>
          </div>

          <p v-if="pickerLoading" data-testid="request-related-post-picker-loading">
            読み込み中...
          </p>
          <p v-else-if="pickerError" class="field-error">{{ pickerError }}</p>
          <template v-else>
            <p
              v-if="pickerPosts.length === 0"
              class="empty-state"
              data-testid="request-related-post-picker-empty"
            >
              投稿がありません。
            </p>
            <button
              v-for="post in pickerPosts"
              :key="post.id"
              type="button"
              class="request-related-post-option"
              :data-testid="`request-related-post-option-${post.id}`"
              @click="emit('select-post', post)"
            >
              <span class="request-related-post-option-body">{{ post.body || '(本文なし)' }}</span>
              <span class="request-related-post-option-date">{{
                post.created_at.slice(0, 10)
              }}</span>
            </button>
          </template>

          <button
            type="button"
            data-testid="request-related-post-picker-close"
            @click="emit('close-picker')"
          >
            閉じる
          </button>
        </div>

        <p
          v-for="msg in fieldErrors.related_post_id ?? []"
          :key="msg"
          class="field-error"
          data-testid="request-related-post-id-error"
        >
          {{ msg }}
        </p>
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
