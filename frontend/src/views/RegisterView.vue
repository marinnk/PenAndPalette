<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// S02 新規登録画面（docs/screen-design.md）。display_nameの入力欄は画面設計に無く、
// 登録時にサーバー側でusernameをそのまま初期値として設定する
const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const email = ref('')
const password = ref('')

const usernameErrors = computed(() => auth.fieldErrors.username ?? [])
const emailErrors = computed(() => auth.fieldErrors.email ?? [])
const passwordErrors = computed(() => auth.fieldErrors.password ?? [])

async function handleSubmit() {
  const success = await auth.register({
    username: username.value,
    email: email.value,
    password: password.value,
  })
  if (success) {
    router.push({ name: 'home' })
  }
}
</script>

<template>
  <main class="form-card">
    <h1>新規登録</h1>
    <form @submit.prevent="handleSubmit">
      <div class="form-field">
        <label for="register-username">ユーザー名</label>
        <input
          id="register-username"
          v-model="username"
          type="text"
          required
          data-testid="register-username"
        />
        <p
          v-for="message in usernameErrors"
          :key="message"
          class="field-error"
          data-testid="register-username-error"
        >
          {{ message }}
        </p>
      </div>
      <div class="form-field">
        <label for="register-email">メールアドレス</label>
        <input
          id="register-email"
          v-model="email"
          type="email"
          required
          data-testid="register-email"
        />
        <p
          v-for="message in emailErrors"
          :key="message"
          class="field-error"
          data-testid="register-email-error"
        >
          {{ message }}
        </p>
      </div>
      <div class="form-field">
        <label for="register-password">パスワード</label>
        <input
          id="register-password"
          v-model="password"
          type="password"
          required
          data-testid="register-password"
        />
        <p
          v-for="message in passwordErrors"
          :key="message"
          class="field-error"
          data-testid="register-password-error"
        >
          {{ message }}
        </p>
      </div>
      <p v-if="auth.errorMessage" class="field-error" data-testid="register-error">
        {{ auth.errorMessage }}
      </p>
      <button
        type="submit"
        class="form-submit"
        :disabled="auth.submitting"
        data-testid="register-submit"
      >
        登録する
      </button>
    </form>
    <p class="form-footer">
      <RouterLink :to="{ name: 'login' }" data-testid="register-to-login-link">
        ログイン画面に戻る
      </RouterLink>
    </p>
  </main>
</template>
