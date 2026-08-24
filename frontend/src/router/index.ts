import { createRouter, createWebHistory } from 'vue-router'
import TimelineView from '@/views/TimelineView.vue'
import PostCreateView from '@/views/PostCreateView.vue'
import PostDetailView from '@/views/PostDetailView.vue'
import ProfileView from '@/views/ProfileView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    // trueの画面はログイン不要（ログイン済みの場合はタイムラインへ戻す）。
    // 省略時（=ログイン必須）が既定のため、新しい画面を追加する際にガード側の
    // 修正を忘れても安全側（要ログイン）に倒れる
    guestOnly?: boolean
  }
}

// 画面設計書のS06・S08・S09・S10は、各機能を実装するIssueで追加する。
// 今回実装するのはS01（ログイン）・S02（新規登録）・S03（タイムライン）・
// S04（投稿作成、スタブ）・S05（投稿詳細、スタブ）・S07（プロフィール、スタブ）
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'timeline', component: TimelineView },
    { path: '/posts/new', name: 'post-create', component: PostCreateView },
    { path: '/posts/:id', name: 'post-detail', component: PostDetailView, props: true },
    { path: '/profile/:id', name: 'profile', component: ProfileView, props: true },
    { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
    { path: '/register', name: 'register', component: RegisterView, meta: { guestOnly: true } },
  ],
})

// 未ログイン利用者はいずれの画面も利用できない（基本設計書5章）ため、
// guestOnly以外へのアクセスは/loginへ、ログイン済みでのguestOnly画面への
// アクセスはタイムラインへ、それぞれリダイレクトする。
// isCheckingSession中はGET /api/auth/meの完了を待ってから判定する
// （待たないと、リロード直後にログイン済み利用者を誤って/loginへ弾いてしまう）
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.isCheckingSession) {
    await auth.fetchMe()
  }

  if (to.meta.guestOnly && auth.currentUser) {
    return { name: 'timeline' }
  }
  if (!to.meta.guestOnly && !auth.currentUser) {
    return { name: 'login' }
  }
})
