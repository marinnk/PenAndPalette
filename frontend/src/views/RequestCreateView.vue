<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '@/lib/apiClient'
import RequestComposeForm from '@/components/RequestComposeForm.vue'
import { useRequestCreate } from '@/composables/useRequestCreate'
import type { Profile } from '@/types/profile'

// S06 リクエスト作成画面。宛先はprops.id（S07の[リクエストする]ボタンから固定で渡される）
const props = defineProps<{ id: string }>()
const router = useRouter()
const toUserId = Number(props.id)

const { message, relatedPostId, submitting, errorMessage, fieldErrors, submit } =
  useRequestCreate(toUserId)

// 見出し「{display_name} さんにリクエストする」用の表示名のみが必要なため、
// 投稿一覧・フォロー状態まで抱えるuseProfile()は使わず、単発のGETで済ませる
const toDisplayName = ref('')
const loadError = ref(false)

onMounted(async () => {
  try {
    const { data } = await apiClient.get<Profile>(`/api/users/${toUserId}`)
    toDisplayName.value = data.display_name
  } catch {
    loadError.value = true
  }
})

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
    :to-user-id="toUserId"
    :to-display-name="toDisplayName"
    :message="message"
    :related-post-id="relatedPostId"
    :submitting="submitting"
    :error-message="errorMessage"
    :field-errors="fieldErrors"
    @update:message="message = $event"
    @update:related-post-id="relatedPostId = $event"
    @submit="handleSubmit"
    @cancel="goToProfile"
  />
</template>
