import { describe, expect, it } from 'vitest'

import { normalizeInputText, segmentGraphemes } from './graphemes'

describe('grapheme 分割', () => {
  it('在比较前统一进行 NFC 规范化', () => {
    expect(normalizeInputText('Cafe\u0301')).toBe('Café')
  })

  it('优先按用户可见 grapheme 分割英文和中文', () => {
    expect(segmentGraphemes('Go，中国。')).toEqual(['G', 'o', '，', '中', '国', '。'])
  })

  it('缺少 Intl.Segmenter 时按 Unicode code point fallback', () => {
    expect(segmentGraphemes('A😀中', null)).toEqual(['A', '😀', '中'])
  })
})
