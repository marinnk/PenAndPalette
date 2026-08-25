import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import BackLink from './BackLink.vue'

const TimelineStub = { template: '<div>timeline</div>' }

function renderBackLink() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'timeline', component: TimelineStub },
      {
        path: '/back',
        name: 'back',
        component: BackLink,
        props: { to: { name: 'timeline' }, label: '← タイムラインに戻る', testid: 'back-link' },
      },
    ],
  })
  return { router }
}

describe('BackLink', () => {
  it('ラベルを表示し、クリックすると指定した遷移先へ移動する', async () => {
    const { router } = renderBackLink()
    await router.push({ name: 'back' })
    render({ template: '<RouterView />' }, { global: { plugins: [router] } })

    const link = screen.getByTestId('back-link')
    expect(link).toHaveTextContent('← タイムラインに戻る')

    await fireEvent.click(link)

    await waitFor(() => {
      expect(router.currentRoute.value.name).toBe('timeline')
    })
  })
})
