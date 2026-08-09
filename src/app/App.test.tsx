import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('呈现可访问的临时追逐调试预览', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('<h1 id="project-title">Typing Gaming</h1>')
    expect(markup).toContain('输入与动态速度调试')
    expect(markup).toContain('<canvas')
    expect(markup).toContain('aria-label="地图与车辆自动追逐画面"')
    expect(markup).toContain('有向领先距离')
    expect(markup).toContain('>跟随小偷</button>')
    expect(markup).toContain('>跟随警察</button>')
    expect(markup).toContain('>全图 Debug</button>')
    expect(markup).toContain('aria-pressed="true">跟随小偷</button>')
    expect(markup).toContain('<textarea')
    expect(markup).toContain('aria-label="打字输入入口"')
    expect(markup).toContain('>English</button>')
    expect(markup).toContain('>中文</button>')
    expect(markup).toContain('准备中')
    expect(markup).toContain('Recent performance')
    expect(markup).toContain('Target speed')
    expect(markup).toContain('Actual speed')
    expect(markup).toContain('Combo')
    expect(markup).toContain('Idle state')
    expect(markup).toContain('Error penalty')
  })
})
