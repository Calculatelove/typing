import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('呈现可访问的临时追逐调试预览', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('<h1 id="project-title">Typing Gaming</h1>')
    expect(markup).toContain('闭环追逐调试预览')
    expect(markup).toContain('<canvas')
    expect(markup).toContain('aria-label="地图与车辆自动追逐画面"')
    expect(markup).toContain('有向领先距离')
    expect(markup).not.toContain('textarea')
  })
})
