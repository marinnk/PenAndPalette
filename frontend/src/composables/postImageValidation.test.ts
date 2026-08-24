import { describe, expect, it } from 'vitest'
import { validateNewImage } from './postImageValidation'

function makeFile(name = 'a.jpg', type = 'image/jpeg', size = 1024) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateNewImage', () => {
  it('有効な画像はnullを返す', () => {
    expect(validateNewImage(makeFile(), 0)).toBeNull()
  })

  it('既に4枚あるとエラーを返す', () => {
    expect(validateNewImage(makeFile(), 4)).toBe('画像は4枚まで添付できます。')
  })

  it('jpg/png以外の形式はエラーを返す', () => {
    expect(validateNewImage(makeFile('a.gif', 'image/gif'), 0)).toBe(
      '画像はjpgまたはpng形式のみ添付できます。',
    )
  })

  it('5MBを超える画像はエラーを返す', () => {
    expect(validateNewImage(makeFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1), 0)).toBe(
      '画像は1枚あたり5MBまでです。',
    )
  })
})
