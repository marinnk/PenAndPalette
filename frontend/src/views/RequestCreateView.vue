<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import RequestComposeForm from '@/components/RequestComposeForm.vue'
import { useRequestCreate } from '@/composables/useRequestCreate'
import { useRequestRelatedPostPicker } from '@/composables/useRequestRelatedPostPicker'
import { useUserLookup } from '@/composables/useUserLookup'
import { useAuthStore } from '@/stores/auth'
import type { Post } from '@/types/post'

// S06 リクエスト作成画面。宛先はprops.id（S07の[リクエストする]ボタンから固定で渡される）
const props = defineProps<{ id: string }>()
const router = useRouter()
const auth = useAuthStore()
const toUserId = Number(props.id)

const { message, relatedPostId, submitting, errorMessage, fieldErrors, submit } =
  useRequestCreate(toUserId)

// 見出し「{display_name} さんにリクエストする」用の表示名のみが必要なため、
// 投稿一覧・フォロー状態まで抱えるuseProfile()は使わず、useUserLookupで済ませる
const { user: toUser, error: loadError, load: loadToUser } = useUserLookup()
onMounted(() => loadToUser(toUserId))

const {
  selectedPost,
  pickerOpen,
  pickerTab,
  pickerLoading,
  pickerError,
  postsByTab,
  openPicker,
  closePicker,
  switchTab,
  selectPost,
  clearSelection,
} = useRequestRelatedPostPicker(auth.currentUser?.id, toUserId)
const pickerPosts = computed(() => postsByTab.value[pickerTab.value] ?? [])

function handleSelectPost(post: Post) {
  selectPost(post)
  relatedPostId.value = String(post.id)
}

function handleClearSelection() {
  clearSelection()
  relatedPostId.value = ''
}

function goToProfile() {
  router.push({ name: 'profile', params: { id: props.id } })
}

async function handleSubmit() {
  const created = await submit()
  if (created) goToProfile()
}
</script>

<template>
  <p v-if="loadError" class="field-error" data-testid="request-create-error">
    利用者が見つかりませんでした。
  </p>
  <RequestComposeForm
    v-else
    :to-display-name="toUser?.display_name ?? ''"
    :message="message"
    :submitting="submitting"
    :error-message="errorMessage"
    :field-errors="fieldErrors"
    :selected-post="selectedPost"
    :picker-open="pickerOpen"
    :picker-tab="pickerTab"
    :picker-loading="pickerLoading"
    :picker-error="pickerError"
    :picker-posts="pickerPosts"
    @update:message="message = $event"
    @submit="handleSubmit"
    @cancel="goToProfile"
    @open-picker="openPicker"
    @close-picker="closePicker"
    @switch-tab="switchTab"
    @select-post="handleSelectPost"
    @clear-selection="handleClearSelection"
  />
</template>
