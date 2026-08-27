import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import TimelineFilter from './TimelineFilter.vue'

const TAGS = [
  { id: 3, name: 'ファンタジー' },
  { id: 4, name: 'SF' },
]

function renderFilter(modelValue: number | null = null) {
  return render(TimelineFilter, { props: { tags: TAGS, modelValue } })
}

describe('TimelineFilter', () => {
  it('初期状態ではタグ一覧を畳んでいる', () => {
    renderFilter()

    expect(screen.queryByTestId('filter-body')).not.toBeInTheDocument()
  })

  it('トグルを押すとタグ一覧を表示順で開く', async () => {
    renderFilter()

    await fireEvent.click(screen.getByTestId('filter-toggle'))

    expect(screen.getByTestId('filter-tag-3')).toHaveTextContent('#ファンタジー')
    expect(screen.getByTestId('filter-tag-4')).toHaveTextContent('#SF')
  })

  it('未選択のタグを押すとそのidをemitする', async () => {
    const { emitted } = renderFilter(null)

    await fireEvent.click(screen.getByTestId('filter-toggle'))
    await fireEvent.click(screen.getByTestId('filter-tag-3'))

    expect(emitted()['update:modelValue']).toEqual([[3]])
  })

  it('選択中のタグを押すと解除（null）をemitする', async () => {
    const { emitted } = renderFilter(3)

    await fireEvent.click(screen.getByTestId('filter-toggle'))
    await fireEvent.click(screen.getByTestId('filter-tag-3'))

    expect(emitted()['update:modelValue']).toEqual([[null]])
  })

  it('選択中はトグルにタグ名を出し、そのチップをactiveにする', async () => {
    renderFilter(4)

    expect(screen.getByTestId('filter-toggle')).toHaveTextContent('絞り込み：#SF')

    await fireEvent.click(screen.getByTestId('filter-toggle'))
    expect(screen.getByTestId('filter-tag-4')).toHaveClass('active')
    expect(screen.getByTestId('filter-tag-4')).toHaveAttribute('aria-pressed', 'true')
  })
})
