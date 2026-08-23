import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import NewPostBanner from './NewPostBanner.vue'

describe('NewPostBanner', () => {
  it('count=0のときは表示されない', () => {
    render(NewPostBanner, { props: { count: 0 } })

    expect(screen.queryByTestId('new-post-banner')).not.toBeInTheDocument()
  })

  it('countが1以上のとき件数付きで表示される', () => {
    render(NewPostBanner, { props: { count: 3 } })

    expect(screen.getByTestId('new-post-banner')).toHaveTextContent('3件の新しい投稿があります')
  })

  it('クリックでrevealがemitされる', async () => {
    const { emitted } = render(NewPostBanner, { props: { count: 1 } })

    await fireEvent.click(screen.getByTestId('new-post-banner'))

    expect(emitted().reveal).toHaveLength(1)
  })
})
