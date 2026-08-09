import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('shows only the accessible project initialization message', () => {
    const markup = renderToStaticMarkup(<App />)
    const visibleText = markup.replace(/<[^>]+>/g, '')

    expect(visibleText).toBe('Typing GamingProject initialized successfully.')
    expect(markup).toContain('aria-labelledby="project-title"')
    expect(markup).toContain('<h1 id="project-title">Typing Gaming</h1>')
  })
})
