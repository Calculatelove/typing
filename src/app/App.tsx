import DebugChasePreview from './DebugChasePreview'

function App() {
  return (
    <main className="app-shell">
      <header className="app-header" aria-labelledby="project-title">
        <h1 id="project-title">Typing Gaming</h1>
        <p>第 3 轮 · 输入系统与玩家动态速度</p>
      </header>
      <DebugChasePreview />
    </main>
  )
}

export default App
