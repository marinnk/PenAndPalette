import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import TimelineTabs from './TimelineTabs.vue'

describe('TimelineTabs', () => {
  it('modelValueに応じてactiveクラスが切り替わる', async () => {
    render(TimelineTabs, { props: { modelValue: 'all' } })

    expect(screen.getByTestId('tab-all')).toHaveClass('active')
    expect(screen.getByTestId('tab-following')).not.toHaveClass('active')
  })

  it('タブクリックでupdate:modelValueがemitされる', async () => {
    const { emitted } = render(TimelineTabs, { props: { modelValue: 'all' } })

    await fireEvent.click(screen.getByTestId('tab-following'))

    expect(emitted()['update:modelValue']).toEqual([['following']])
  })
})
