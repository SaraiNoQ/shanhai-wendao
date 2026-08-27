import './App.css'

function App() {
  return (
    <main className="project-shell">
      <p className="eyebrow">炼气至筑基 · 垂直切片</p>
      <h1>山海问道</h1>
      <p className="pitch">
        东方志怪题材的放置养成、卡牌构筑与轻量肉鸽单机游戏。
      </p>

      <section aria-labelledby="status-title">
        <h2 id="status-title">当前阶段</h2>
        <p>
          项目规范和设计文档已经建立。下一步只实现一场可复现的卡桌战斗，
          用六张牌验证灵力、抽牌和自动优先级。
        </p>
      </section>
    </main>
  )
}

export default App
