import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('shows the project initialization message', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('<h1>Typing Gaming</h1>')
    expect(markup).toContain('<p>Project initialized successfully.</p>')
  })
})
