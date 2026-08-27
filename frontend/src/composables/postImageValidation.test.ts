import { describe, expect, it } from 'vitest'
import { maxBodyLengthForType, maxImagesForType, validateNewImage } from './postImageValidation'

function makeFile(name = 'a.jpg', type = 'image/jpeg', size = 1024) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('maxImagesForType', () => {
  it('イラストは4枚まで', () => {
    expect(maxImagesForType('illustration')).toBe(4)
  })

  it('小説（カバー画像）は1枚まで', () => {
    expect(maxImagesForType('novel')).toBe(1)
  })
})

describe('maxBodyLengthForType', () => {
  it('イラストは280文字まで', () => {
    expect(maxBodyLengthForType('illustration')).toBe(280)
  })

  it('小説は4000文字まで', () => {
    expect(maxBodyLengthForType('novel')).toBe(4000)
  })
})

describe('validateNewImage', () => {
  it('有効な画像はnullを返す', () => {
    expect(validateNewImage(makeFile(), 0, 'illustration')).toBeNull()
  })

  it('イラストは既に4枚あるとエラーを返す', () => {
    expect(validateNewImage(makeFile(), 4, 'illustration')).toBe('画像は4枚まで添付できます。')
  })

  it('小説は既に1枚（カバー画像）あるとエラーを返す', () => {
    expect(validateNewImage(makeFile(), 1, 'novel')).toBe('画像は1枚まで添付できます。')
  })

  it('jpg/png以外の形式はエラーを返す', () => {
    expect(validateNewImage(makeFile('a.gif', 'image/gif'), 0, 'illustration')).toBe(
      '画像はjpgまたはpng形式のみ添付できます。',
    )
  })

  it('5MBを超える画像はエラーを返す', () => {
    expect(
      validateNewImage(makeFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1), 0, 'illustration'),
    ).toBe('画像は1枚あたり5MBまでです。')
  })
})
