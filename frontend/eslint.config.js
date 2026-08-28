import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility'
import eslintConfigPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  // .vue テンプレートのアクセシビリティ（ラベル・alt・キーボード操作など）を検査する
  ...pluginVueA11y.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  eslintConfigPrettier,
  {
    languageOptions: {
      // タイムライン画面の無限スクロール・新着通知バナー・投稿画像添付等で使うブラウザ標準API
      globals: {
        window: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        Node: 'readonly',
        Event: 'readonly',
        PointerEvent: 'readonly',
        File: 'readonly',
        IntersectionObserver: 'readonly',
        IntersectionObserverEntry: 'readonly',
      },
    },
    rules: {
      // 単一責務のルールに沿って、コンポーネントを小さく保つことを促す
      'vue/multi-word-component-names': 'off',
      // 既定（nesting と for の両方を必須）は WCAG が求める以上に厳しい。
      // for/id による関連付け「または」入れ子のどちらかがあれば良しとする。
      'vuejs-accessibility/label-has-for': [
        'error',
        { required: { some: ['nesting', 'id'] }, allowChildren: false },
      ],
    },
  },
)
