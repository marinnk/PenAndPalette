import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import { useAuthStore } from '@/stores/auth'

// 画面設計書のS04以降のルートは、各機能を実装するIssueで追加する。
// 現時点では疎通確認用のHome（将来S03タイムラインに置き換わる想定）と、
// 今回実装するS01（ログイン）・S02（新規登録）のみ
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: RegisterView },
  ],
})

// ログイン済みの利用者が/login・/registerを開いた場合はホームへ戻す軽いガードのみ設ける。
// 「未ログイン時に他画面へアクセスさせない」全画面共通のガードは、現状の/がまだ疎通確認用の
// プレースホルダーでありS03（タイムライン）ではないため、今回のスコープでは実装しない
// （次にタイムライン機能を実装する際、そちらのルートに合わせて導入する）
router.beforeEach((to) => {
  const auth = useAuthStore()
  if ((to.name === 'login' || to.name === 'register') && auth.currentUser) {
    return { name: 'home' }
  }
})
