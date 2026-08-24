<script setup lang="ts">
import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import PostCard from '@/components/PostCard.vue'
import { useAuthStore } from '@/stores/auth'
import type { Post, PostListResponse } from '@/types/post'

// S06 リクエスト作成画面。PostComposeForm.vueと同じprops/emit構成の表示コンポーネントだが、
// 「参考にしてほしい投稿」欄だけは例外的にこのコンポーネント内で完結する（自分・相手の
// 投稿一覧を取得して選ばせる）ローカルなpicker状態を持つ。PostCard.vueが自分でuseAuthStore()を
// 呼ぶのと同じ理由で、このコンポーネントも自分でapiClient/useAuthStoreを使う
const props = withDefaults(
  defineProps<{
    toUserId: number
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

const auth = useAuthStore()

type PickerTab = 'own' | 'target'

const selectedPost = ref<Post | null>(null)
const pickerOpen = ref(false)
const pickerTab = ref<PickerTab>('own')
const pickerLoading = ref(false)
const pickerError = ref<string | null>(null)
// タブ切り替えのたびに再取得しないよう、取得済みの一覧をタブごとにキャッシュしておく
const pickerPostsByTab: Record<PickerTab, Post[] | null> = { own: null, target: null }

async function loadTab(tab: PickerTab) {
  const userId = tab === 'own' ? auth.currentUser?.id : props.toUserId
  if (!userId) return
  if (pickerPostsByTab[tab]) return

  pickerLoading.value = true
  pickerError.value = null
  try {
    const { data } = await apiClient.get<PostListResponse>('/api/posts', {
      params: { user_id: userId },
    })
    pickerPostsByTab[tab] = data.results
  } catch {
    pickerError.value = '投稿一覧の取得に失敗しました。'
  } finally {
    pickerLoading.value = false
  }
}

function openPicker() {
  pickerOpen.value = true
  loadTab(pickerTab.value)
}

function switchTab(tab: PickerTab) {
  pickerTab.value = tab
  loadTab(tab)
}

function selectPost(post: Post) {
  selectedPost.value = post
  pickerOpen.value = false
  emit('update:relatedPostId', String(post.id))
}

function clearSelection() {
  selectedPost.value = null
  emit('update:relatedPostId', '')
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
        <label>参考にしてほしい投稿（任意）</label>

        <div v-if="selectedPost" class="request-related-post-selected">
          <PostCard :post="selectedPost" :clickable="false" />
          <button type="button" data-testid="request-related-post-clear" @click="clearSelection">
            選択を解除する
          </button>
        </div>
        <button
          v-else
          type="button"
          data-testid="request-related-post-picker-toggle"
          @click="openPicker"
        >
          投稿を選ぶ
        </button>

        <div v-if="pickerOpen" class="request-related-post-picker">
          <div class="follow-list-tabs">
            <button
              type="button"
              :aria-pressed="pickerTab === 'own'"
              data-testid="request-related-post-tab-own"
              @click="switchTab('own')"
            >
              自分の投稿
            </button>
            <button
              type="button"
              :aria-pressed="pickerTab === 'target'"
              data-testid="request-related-post-tab-target"
              @click="switchTab('target')"
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
              v-if="(pickerPostsByTab[pickerTab] ?? []).length === 0"
              class="empty-state"
              data-testid="request-related-post-picker-empty"
            >
              投稿がありません。
            </p>
            <button
              v-for="post in pickerPostsByTab[pickerTab] ?? []"
              :key="post.id"
              type="button"
              class="request-related-post-option"
              :data-testid="`request-related-post-option-${post.id}`"
              @click="selectPost(post)"
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
            @click="pickerOpen = false"
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
