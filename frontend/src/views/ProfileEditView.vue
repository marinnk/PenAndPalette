<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AvatarIcon from '@/components/AvatarIcon.vue'
import { useProfileEdit } from '@/composables/useProfileEdit'

// S08 プロフィール編集画面（画面設計書252〜273行目）。S04・S06・S10と同じく単機能画面のため
// 共通ヘッダー（AppHeader.vue）は持たない
const props = defineProps<{ id: string }>()
const router = useRouter()
const auth = useAuthStore()
const {
  profile,
  bio,
  loading,
  loadError,
  submitting,
  errorMessage,
  fieldErrors,
  avatarError,
  avatarUpdating,
  load,
  save,
  uploadAvatar,
  removeAvatar,
} = useProfileEdit()

// 自分のプロフィールしか編集できない（F-8機能要件）。バックエンドはrequest.user自身しか
// 操作対象にしないため実害は無いが、他人のidで直接このURLを開いた場合はS07へ早めに戻す
const isOwnProfile = computed(() => auth.currentUser?.id === Number(props.id))

function loadIfOwnProfile(id: number) {
  if (!isOwnProfile.value) {
    router.replace({ name: 'profile', params: { id } })
    return
  }
  load(id)
}

onMounted(() => loadIfOwnProfile(Number(props.id)))
watch(
  () => props.id,
  (id) => loadIfOwnProfile(Number(id)),
)

function goToProfile() {
  router.push({ name: 'profile', params: { id: props.id } })
}

function onAvatarFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) uploadAvatar(file)
  // 同じファイルを削除後に再度選び直せるよう、inputの値をクリアしておく
  input.value = ''
}

async function handleSave() {
  if (await save()) goToProfile()
}
</script>

<template>
  <main class="form-card">
    <h1>プロフィールを編集</h1>
    <p v-if="loading" data-testid="profile-edit-loading">読み込み中...</p>
    <p v-else-if="loadError || !profile" class="field-error" data-testid="profile-edit-load-error">
      プロフィールの取得に失敗しました。
    </p>
    <form v-else @submit.prevent="handleSave">
      <div class="form-field">
        <label>アイコン画像</label>
        <div class="profile-edit-avatar-row">
          <AvatarIcon :src="profile.avatar_url" :size="64" testid="profile-edit-avatar-image" />
          <label
            class="profile-edit-avatar-picker"
            :class="{ 'profile-edit-avatar-picker-disabled': avatarUpdating }"
            data-testid="profile-edit-avatar-picker"
          >
            画像を選択
            <input
              type="file"
              accept="image/jpeg,image/png"
              class="visually-hidden"
              data-testid="profile-edit-avatar-input"
              :disabled="avatarUpdating"
              @change="onAvatarFileSelected"
            />
          </label>
          <button
            type="button"
            class="profile-edit-avatar-picker"
            data-testid="profile-edit-avatar-remove"
            :disabled="avatarUpdating || !profile.avatar_url"
            @click="removeAvatar"
          >
            削除
          </button>
        </div>
        <p v-if="avatarError" class="field-error" data-testid="profile-edit-avatar-error">
          {{ avatarError }}
        </p>
      </div>

      <div class="form-field">
        <label for="profile-edit-bio">自己紹介</label>
        <textarea
          id="profile-edit-bio"
          v-model="bio"
          maxlength="160"
          rows="3"
          data-testid="profile-edit-bio"
        ></textarea>
        <p
          v-for="message in fieldErrors.bio ?? []"
          :key="message"
          class="field-error"
          data-testid="profile-edit-bio-error"
        >
          {{ message }}
        </p>
      </div>

      <p v-if="errorMessage" class="field-error" data-testid="profile-edit-error">
        {{ errorMessage }}
      </p>

      <div class="form-actions">
        <button type="button" data-testid="profile-edit-cancel" @click="goToProfile">
          キャンセル
        </button>
        <button
          type="submit"
          class="form-submit"
          :disabled="submitting"
          data-testid="profile-edit-save"
        >
          保存
        </button>
      </div>
    </form>
  </main>
</template>
