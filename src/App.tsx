import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { M1_CONTENT } from './content/m1'
import { createBattle, transitionBattle } from './game/battle'
import type {
  BattleCommand,
  BattleEvent,
  BattleState,
  CardId,
  UnitId,
  UnitState,
} from './game/types'
import { PriorityList } from './ui/PriorityList'

const INITIAL_SEED = 20_260_827

interface AppState {
  battle: BattleState
  events: BattleEvent[]
}

const names: Record<UnitId | CardId, string> = {
  leader: M1_CONTENT.leader.name,
  blade_tail_fox: M1_CONTENT.spirits[0].name,
  iron_beak_crane: M1_CONTENT.spirits[1].name,
  clay_idol: M1_CONTENT.enemy.name,
  guiding_edge: M1_CONTENT.cards.guiding_edge.name,
  hidden_edge: M1_CONTENT.cards.hidden_edge.name,
  returning_wind: M1_CONTENT.cards.returning_wind.name,
  armor_piercing_star: M1_CONTENT.cards.armor_piercing_star.name,
  ten_thousand_blades: M1_CONTENT.cards.ten_thousand_blades.name,
  mountain_splitter: M1_CONTENT.cards.mountain_splitter.name,
}

function UnitCard({ unit, glyph, enemy = false }: { unit: UnitState; glyph: string; enemy?: boolean }) {
  const hpPercent = Math.max(0, (unit.hp / unit.maxHp) * 100)
  return (
    <article className={enemy ? 'unit-card enemy-card' : 'unit-card'}>
      <div className="unit-art" aria-hidden="true"><span>{glyph}</span></div>
      <div className="unit-copy">
        <p className="unit-title">{unit.title}</p>
        <h3>{unit.name}</h3>
        <div className="health-line" aria-label={`生元 ${unit.hp}/${unit.maxHp}`}>
          <span style={{ width: `${hpPercent}%` }} />
        </div>
        <div className="unit-stats">
          <span>生元 {unit.hp}/{unit.maxHp}</span><span>攻势 {unit.attack}</span><span>护体 {unit.defense}</span>
        </div>
        <div className="status-row">
          {unit.shield > 0 && <span className="status-chip shield">护盾 {unit.shield}</span>}
          {unit.armorBreak > 0 && <span className="status-chip break">破甲 {unit.armorBreak}</span>}
        </div>
      </div>
    </article>
  )
}

function formatEvent(event: BattleEvent) {
  const time = (event.atMs / 1_000).toFixed(1)
  switch (event.type) {
    case 'battle_started': return [`${time}s`, `劫数 ${event.seed}，斗法开始。`]
    case 'card_drawn': return [`${time}s`, `抽取「${names[event.cardId]}」。`]
    case 'card_played': return [`${time}s`, `${event.automatic ? '自动施展' : '施展'}「${names[event.cardId]}」。`]
    case 'damage': return [`${time}s`, `${names[event.sourceId]}对${names[event.targetId]}造成 ${event.amount} 伤害${event.shieldAbsorbed ? `，护盾抵消 ${event.shieldAbsorbed}` : ''}。`]
    case 'heal': return [`${time}s`, `${names[event.sourceId]}为${names[event.targetId]}恢复 ${event.amount} 生元。`]
    case 'shield': return [`${time}s`, `${names[event.sourceId]}为${names[event.targetId]}赋予 ${event.amount} 护盾。`]
    case 'status_changed': return [`${time}s`, `${event.status === 'sword_intent' ? '剑意' : `${names[event.targetId as UnitId]}的破甲`}变为 ${event.value}。`]
    case 'energy_changed': return [`${time}s`, `灵力变为 ${event.value}。`]
    case 'unit_action': return [`${time}s`, `${names[event.unitId]}发动「${event.action}」。`]
    case 'battle_ended': return [`${time}s`, event.result === 'victory' ? '泥胎崩裂，试剑告捷。' : '心脉俱损，试剑失败。']
    case 'message': return [`${time}s`, event.text]
  }
}

function App() {
  const [app, setApp] = useState<AppState>(() => ({
    battle: createBattle(INITIAL_SEED),
    events: [{ type: 'battle_started', seed: INITIAL_SEED, atMs: 0 }],
  }))
  const [speed, setSpeed] = useState(1)

  const dispatch = useCallback((command: BattleCommand) => {
    setApp((current) => {
      const result = transitionBattle(current.battle, command)
      return {
        battle: result.state,
        events:
          command.type === 'restart'
            ? result.events
            : [...current.events, ...result.events].slice(-60),
      }
    })
  }, [])

  useEffect(() => {
    if (app.battle.status !== 'active') return undefined
    const timer = window.setInterval(() => dispatch({ type: 'advance', elapsedMs: 250 * speed }), 250)
    return () => window.clearInterval(timer)
  }, [app.battle.status, dispatch, speed])

  const { battle } = app

  return (
    <div className="game-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-seal" aria-hidden="true">問</span>
          <div><p>槐阴古道 · 试剑</p><h1>山海问道</h1></div>
        </div>
        <div className="battle-controls">
          <span className="seed-mark">劫数 {battle.seed}</span>
          <div className="speed-control" aria-label="战斗速度">
            {[1, 2, 4].map((value) => (
              <button key={value} type="button" className={speed === value ? 'is-active' : ''} onClick={() => setSpeed(value)}>{value}×</button>
            ))}
          </div>
          <button type="button" className={battle.autoplay ? 'autoplay is-active' : 'autoplay'} aria-pressed={battle.autoplay} onClick={() => dispatch({ type: 'set_autoplay', enabled: !battle.autoplay })}>
            {battle.autoplay ? '自动 · 开' : '自动 · 关'}
          </button>
          <button type="button" className="restart" onClick={() => dispatch({ type: 'restart' })}>重演此劫</button>
        </div>
      </header>

      <main className="battle-layout">
        <aside className="party-panel" aria-label="我方阵容">
          <div className="panel-heading"><span>壹</span><div><small>PLAYER FORMATION</small><h2>修士阵</h2></div></div>
          <UnitCard unit={battle.leader} glyph="劍" />
          <div className="spirit-grid">
            <UnitCard unit={battle.spirits[0]} glyph="狐" />
            <UnitCard unit={battle.spirits[1]} glyph="鶴" />
          </div>
        </aside>

        <section className="battle-table" aria-label="斗法牌桌">
          <div className="table-rings" aria-hidden="true" />
          <div className="enemy-zone"><p className="zone-label">槐阴异物</p><UnitCard unit={battle.enemy} glyph="傀" enemy /></div>
          <div className="battle-meter">
            <div className="intent-orb"><span>剑意</span><strong>{battle.swordIntent}</strong><small>/ {battle.swordIntentCap}</small></div>
            <div className="energy-track" aria-label={`灵力 ${battle.energy}/${battle.maxEnergy}`}>
              <div className="energy-label"><span>灵力</span><strong>{battle.energy}</strong><small>/ {battle.maxEnergy}</small></div>
              <div className="energy-pips">
                {Array.from({ length: battle.maxEnergy }, (_, index) => <i key={index} className={index < battle.energy ? 'filled' : ''} />)}
              </div>
            </div>
            <p className="time-mark">{(battle.timeMs / 1_000).toFixed(1)} 秒</p>
          </div>

          <div className="hand-zone">
            <div className="hand-heading"><span>手牌 {battle.hand.length}/4</span><span>牌库 {battle.deck.length}</span><span>弃牌 {battle.discard.length}</span></div>
            <div className="hand-cards">
              {battle.hand.map((cardId) => {
                const card = M1_CONTENT.cards[cardId]
                const disabled = battle.status !== 'active' || card.cost > battle.energy
                return (
                  <button type="button" key={cardId} className={`hand-card card-${card.cost}`} disabled={disabled} onClick={() => dispatch({ type: 'play_card', cardId })}>
                    <span className="card-cost">{card.cost}</span><span className="card-kind">{card.kind}</span><strong>{card.name}</strong>
                    <span className="card-illustration" aria-hidden="true">{card.name.at(0)}</span><span className="card-text">{card.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {battle.status !== 'active' && (
            <div className={`battle-result ${battle.status}`} role="status">
              <span>{battle.status === 'victory' ? '破' : '败'}</span><h2>{battle.status === 'victory' ? '试剑告捷' : '心脉受创'}</h2>
              <p>{battle.status === 'victory' ? '泥胎崩裂，剑意犹鸣。' : '调整牌序，再渡此劫。'}</p>
              <button type="button" onClick={() => dispatch({ type: 'restart' })}>重演此劫</button>
            </div>
          )}
        </section>

        <aside className="intel-panel">
          <section className="priority-panel">
            <div className="panel-heading compact"><span>贰</span><div><small>AUTO CAST</small><h2>出牌次序</h2></div></div>
            <p className="panel-note">拖动或使用箭头排序。自动模式会跳过灵力不足的牌。</p>
            <PriorityList cardIds={battle.autoplayPriority} onChange={(cardIds) => dispatch({ type: 'reorder_priority', cardIds })} />
          </section>
          <section className="event-panel" aria-live="polite">
            <div className="panel-heading compact"><span>叁</span><div><small>BATTLE RECORD</small><h2>斗法录</h2></div></div>
            <ol className="event-list">
              {[...app.events].reverse().slice(0, 12).map((event, index) => {
                const [time, copy] = formatEvent(event)
                return <li key={`${event.atMs}-${event.type}-${index}`}><time>{time}</time><span>{copy}</span></li>
              })}
            </ol>
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
