import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import PostTypeTabs from './PostTypeTabs.vue'

describe('PostTypeTabs', () => {
  it('modelValueに応じてactiveクラスが切り替わる', () => {
    render(PostTypeTabs, { props: { modelValue: 'illustration' } })

    expect(screen.getByTestId('tab-illustration')).toHaveClass('active')
    expect(screen.getByTestId('tab-novel')).not.toHaveClass('active')
  })

  it('タブクリックでupdate:modelValueがemitされる', async () => {
    const { emitted } = render(PostTypeTabs, { props: { modelValue: 'illustration' } })

    await fireEvent.click(screen.getByTestId('tab-novel'))

    expect(emitted()['update:modelValue']).toEqual([['novel']])
  })
})
