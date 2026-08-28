import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import ProfileTabs from './ProfileTabs.vue'

describe('ProfileTabs', () => {
  it('modelValueに応じてactiveクラスが切り替わる', () => {
    render(ProfileTabs, { props: { modelValue: 'posts' } })

    expect(screen.getByTestId('profile-tab-posts')).toHaveClass('active')
    expect(screen.getByTestId('profile-tab-bookmarks')).not.toHaveClass('active')
  })

  it('タブクリックでupdate:modelValueがemitされる', async () => {
    const { emitted } = render(ProfileTabs, { props: { modelValue: 'posts' } })

    await fireEvent.click(screen.getByTestId('profile-tab-bookmarks'))

    expect(emitted()['update:modelValue']).toEqual([['bookmarks']])
  })
})
