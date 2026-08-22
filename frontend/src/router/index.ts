import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

// 画面設計書のS01〜S0x（ログイン・タイムライン等）のルートは、各機能を実装するIssueで追加する。
// 現時点ではbackendとの疎通確認用のルートのみ
export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'home', component: HomeView }],
})
