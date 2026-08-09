import { describe, expect, it } from 'vitest'

import {
  clearImeSuppression,
  consumeImeFallback,
  createImeInputState,
  reduceImeInput,
  shouldBlockBrowserInputType,
} from './imeInput'

describe('中文 IME 正式提交', () => {
  it('组合候选和组合期间 input 都不提交', () => {
    let result = reduceImeInput(createImeInputState(), { type: 'compositionstart' })
    result = reduceImeInput(result.state, { type: 'compositionupdate', text: 'zhong' })
    result = reduceImeInput(result.state, { type: 'input', text: '中', isComposing: true })

    expect(result.committedText).toBeUndefined()
    expect(result.state.composing).toBe(true)
  })

  it('compositionend 后只由最终 input 消费一次', () => {
    let result = reduceImeInput(createImeInputState(), { type: 'compositionstart' })
    result = reduceImeInput(result.state, { type: 'compositionend', text: '中文' })
    const fallbackVersion = result.fallbackVersion
    expect(result.committedText).toBeUndefined()

    result = reduceImeInput(result.state, { type: 'input', text: '中文', isComposing: false })
    expect(result.committedText).toBe('中文')

    const fallback = consumeImeFallback(result.state, fallbackVersion!)
    const duplicate = reduceImeInput(fallback.state, { type: 'input', text: '中文', isComposing: false })
    expect(fallback.committedText).toBeUndefined()
    expect(duplicate.committedText).toBeUndefined()
  })

  it('浏览器缺少最终 input 时由微任务 fallback 提交且迟到事件不重复', () => {
    let result = reduceImeInput(createImeInputState(), { type: 'compositionstart' })
    result = reduceImeInput(result.state, { type: 'compositionend', text: '好' })
    const fallback = consumeImeFallback(result.state, result.fallbackVersion!)
    const late = reduceImeInput(fallback.state, { type: 'input', text: '好', isComposing: false })

    expect(fallback.committedText).toBe('好')
    expect(late.committedText).toBeUndefined()
  })

  it('普通英文 input 立即作为正式文本提交', () => {
    const result = reduceImeInput(createImeInputState(), {
      type: 'input',
      text: 'a',
      isComposing: false,
    })
    expect(result.committedText).toBe('a')
  })

  it('抑制窗口释放后允许合法的相同文本再次输入', () => {
    let result = reduceImeInput(createImeInputState(), { type: 'compositionstart' })
    result = reduceImeInput(result.state, { type: 'compositionend', text: '好' })
    result = reduceImeInput(result.state, { type: 'input', text: '好', isComposing: false })
    const legal = reduceImeInput(clearImeSuppression(result.state), {
      type: 'input', text: '好', isComposing: false,
    })
    expect(legal.committedText).toBe('好')
  })

  it('抑制状态遇到不同输入会清除并正常提交，之后原文本也合法', () => {
    let result = reduceImeInput(createImeInputState(), { type: 'compositionstart' })
    result = reduceImeInput(result.state, { type: 'compositionend', text: '好' })
    result = consumeImeFallback(result.state, result.fallbackVersion!)
    const different = reduceImeInput(result.state, { type: 'input', text: '！', isComposing: false })
    const sameLater = reduceImeInput(different.state, { type: 'input', text: '好', isComposing: false })

    expect(different.committedText).toBe('！')
    expect(sameLater.committedText).toBe('好')
  })

  it('阻止粘贴和拖放类型但允许普通与 composition 输入', () => {
    expect(shouldBlockBrowserInputType('insertFromPaste')).toBe(true)
    expect(shouldBlockBrowserInputType('insertFromDrop')).toBe(true)
    expect(shouldBlockBrowserInputType('insertText')).toBe(false)
    expect(shouldBlockBrowserInputType('insertCompositionText')).toBe(false)
  })
})
