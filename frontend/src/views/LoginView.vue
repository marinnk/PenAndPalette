<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// S01 ログイン画面（docs/screen-design.md）。このコンポーネントは入力の受け渡しと画面遷移のみを担い、
// 通信・状態管理はuseAuthStoreに委ねる
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')

async function handleSubmit() {
  const success = await auth.login({ email: email.value, password: password.value })
  if (success) {
    router.push({ name: 'timeline' })
  }
}
</script>

<template>
  <main class="form-card">
    <h1>PenAndPalette</h1>
    <form @submit.prevent="handleSubmit">
      <div class="form-field">
        <label for="login-email">メールアドレス</label>
        <input id="login-email" v-model="email" type="email" required data-testid="login-email" />
      </div>
      <div class="form-field">
        <label for="login-password">パスワード</label>
        <input
          id="login-password"
          v-model="password"
          type="password"
          required
          data-testid="login-password"
        />
      </div>
      <p v-if="auth.errorMessage" class="field-error" data-testid="login-error">
        {{ auth.errorMessage }}
      </p>
      <button
        type="submit"
        class="form-submit"
        :disabled="auth.submitting"
        data-testid="login-submit"
      >
        ログイン
      </button>
    </form>
    <p class="form-footer">
      アカウントをお持ちでない方は
      <RouterLink :to="{ name: 'register' }" data-testid="login-to-register-link">
        新規登録はこちら
      </RouterLink>
    </p>
  </main>
</template>
