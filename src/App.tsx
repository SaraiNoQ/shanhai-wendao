import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { PROTOTYPE_CONTENT } from './content/prototype'
import { createBattle, getEffectiveCardCost, transitionBattle } from './game/battle'
import type { BattleCommand, BattleEvent, BattleState, BuildId, CardId, ComboId, UnitId, UnitState } from './game/types'
import { PriorityList } from './ui/PriorityList'

const INITIAL_SEED = 20_260_827
const ASSET_ROOT = '/assets/pixel/'
const artFiles: Record<string, string> = {
  portrait_leader_01: 'portrait-leader-01.png',
  spirit_paper_bride: 'spirit-paper-bride.png',
  enemy_clay_idol: 'enemy-clay-idol.png',
  card_mountain_splitter: 'card-mountain-splitter.png',
  card_nine_heavens_edict: 'card-nine-heavens-edict.png',
  card_night_of_hundred_beasts: 'card-night-of-hundred-beasts.png',
}

const comboNames: Record<ComboId, string> = {
  flying_sword_seal: '飞剑镇符',
  spirit_edict: '灵使敕令',
  dual_spirit_sword: '双灵剑阵',
}

const names: Record<string, string> = {
  leader: PROTOTYPE_CONTENT.leader.name,
  burn: '灼烧',
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.spirits).map((item) => [item.id, item.name])),
  ...Object.fromEntries(PROTOTYPE_CONTENT.enemies.map((item) => [item.id, item.name])),
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.cards).map((item) => [item.id, item.name])),
}

interface AppState { battle: BattleState; events: BattleEvent[] }

function UnitCard({ unit, bond, enemy = false, selectable = false, onSelect }: { unit: UnitState; bond?: number; enemy?: boolean; selectable?: boolean; onSelect?: () => void }) {
  const hpPercent = Math.max(0, (unit.hp / unit.maxHp) * 100)
  const art = unit.artKey ? artFiles[unit.artKey] : undefined
  return (
    <article className={`unit-card ${enemy ? 'enemy-card' : ''} ${selectable ? 'is-selectable' : ''}`}>
      <div className="unit-art" aria-hidden="true">
        {art ? <img src={`${ASSET_ROOT}${art}`} alt="" /> : <span>{unit.name.at(0)}</span>}
      </div>
      <div className="unit-copy">
        <p className="unit-title">{unit.title}</p>
        <h3>{unit.name}</h3>
        <div className="health-line" aria-label={`生元 ${unit.hp}/${unit.maxHp}`}><span style={{ width: `${hpPercent}%` }} /></div>
        <div className="unit-stats"><span>生元 {unit.hp}/{unit.maxHp}</span><span>攻势 {unit.attack}</span><span>护体 {unit.defense}</span></div>
        <div className="status-row">
          {unit.shield > 0 && <span className="status-chip shield">护盾 {unit.shield}</span>}
          {unit.armorBreak > 0 && <span className="status-chip break">破甲 {unit.armorBreak}</span>}
          {unit.talismanMarks > 0 && <span className="status-chip mark">符印 {unit.talismanMarks}</span>}
          {unit.burnStacks > 0 && <span className="status-chip burn">灼烧 {unit.burnStacks}</span>}
          {bond !== undefined && <span className="status-chip bond">灵契 {bond}/3</span>}
        </div>
      </div>
      {selectable && <button type="button" className="target-hitbox" onClick={onSelect} aria-label={`选择${unit.name}为目标`} />}
    </article>
  )
}

function formatEvent(event: BattleEvent) {
  const time = (event.atMs / 1_000).toFixed(1)
  switch (event.type) {
    case 'battle_started': return [time, `切换「${PROTOTYPE_CONTENT.builds[event.buildId].name}」，斗法开始。`]
    case 'card_drawn': return [time, `抽取「${names[event.cardId]}」。`]
    case 'card_played': return [time, `${event.automatic ? '自动施展' : '施展'}「${names[event.cardId]}」。`]
    case 'damage': return [time, `${names[event.sourceId]}对${names[event.targetId]}造成 ${event.amount} 伤害${event.shieldAbsorbed ? `，护盾抵消 ${event.shieldAbsorbed}` : ''}。`]
    case 'heal': return [time, `${names[event.sourceId]}为${names[event.targetId]}恢复 ${event.amount} 生元。`]
    case 'shield': return [time, `${names[event.sourceId]}为${names[event.targetId]}赋予 ${event.amount} 护盾。`]
    case 'status_changed': {
      const labels = { sword_intent: '剑意', armor_break: '破甲', talisman_mark: '符印', burn: '灼烧', spirit_bond: '灵契', energy_discount: '减耗' }
      return [time, `${event.targetId === 'battle' ? '' : names[event.targetId]}${labels[event.status]}变为 ${event.value}。`]
    }
    case 'energy_changed': return [time, `灵力变为 ${event.value}。`]
    case 'unit_action': return [time, `${names[event.unitId]}发动「${event.action}」。`]
    case 'combo_triggered': return [time, `连携「${comboNames[event.comboId]}」触发。`]
    case 'battle_ended': return [time, event.result === 'victory' ? '泥胎崩裂，试法告捷。' : '心脉俱损，试法失败。']
    case 'message': return [time, event.text]
  }
}

function App() {
  const [app, setApp] = useState<AppState>(() => ({
    battle: createBattle(INITIAL_SEED),
    events: [{ type: 'battle_started', seed: INITIAL_SEED, buildId: PROTOTYPE_CONTENT.defaultBuildId, atMs: 0 }],
  }))
  const [speed, setSpeed] = useState(1)
  const [targetingCard, setTargetingCard] = useState<CardId>()

  const dispatch = useCallback((command: BattleCommand) => {
    setApp((current) => {
      const result = transitionBattle(current.battle, command)
      return { battle: result.state, events: command.type === 'restart' ? result.events : [...current.events, ...result.events].slice(-80) }
    })
  }, [])

  useEffect(() => {
    if (app.battle.status !== 'active') return undefined
    const timer = window.setInterval(() => dispatch({ type: 'advance', elapsedMs: 250 * speed }), 250)
    return () => window.clearInterval(timer)
  }, [app.battle.status, dispatch, speed])

  useEffect(() => {
    if (!targetingCard) return undefined
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') setTargetingCard(undefined) }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [targetingCard])

  const { battle } = app
  const build = PROTOTYPE_CONTENT.builds[battle.buildId]
  const enemy = battle.enemies.find((unit) => unit.hp > 0) ?? battle.enemies[0]

  const chooseBuild = (buildId: BuildId) => {
    setTargetingCard(undefined)
    dispatch({ type: 'restart', buildId })
  }

  const clickCard = (cardId: CardId) => {
    const card = PROTOTYPE_CONTENT.cards[cardId]
    if (card.targetRule === 'chosen_spirit') setTargetingCard(cardId)
    else dispatch({ type: 'play_card', cardId })
  }

  const chooseSpiritTarget = (targetId: UnitId) => {
    if (!targetingCard) return
    dispatch({ type: 'play_card', cardId: targetingCard, targetId })
    setTargetingCard(undefined)
  }

  return (
    <div className="game-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-seal" aria-hidden="true">問</span><div><p>槐阴古道 · 六法试演</p><h1>山海问道</h1></div></div>
        <div className="battle-controls">
          <span className="seed-mark">劫数 {battle.seed}</span>
          <div className="speed-control" aria-label="战斗速度">{[1, 2, 4].map((value) => <button key={value} type="button" className={speed === value ? 'is-active' : ''} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
          <button type="button" className={battle.autoplay ? 'autoplay is-active' : 'autoplay'} aria-pressed={battle.autoplay} onClick={() => dispatch({ type: 'set_autoplay', enabled: !battle.autoplay })}>{battle.autoplay ? '自动 · 开' : '自动 · 关'}</button>
          <button type="button" className="restart" onClick={() => dispatch({ type: 'restart' })}>重演此劫</button>
        </div>
      </header>

      <nav className="build-strip" aria-label="快捷构筑">
        {(Object.values(PROTOTYPE_CONTENT.builds)).map((preset) => (
          <button key={preset.id} type="button" className={preset.id === battle.buildId ? 'is-active' : ''} aria-pressed={preset.id === battle.buildId} onClick={() => chooseBuild(preset.id)}>
            <strong>{preset.name}</strong><span>{preset.subtitle}</span>
          </button>
        ))}
      </nav>

      <main className="battle-layout">
        <aside className="party-panel" aria-label="我方阵容">
          <div className="panel-heading"><span>壹</span><div><small>PLAYER FORMATION</small><h2>修士阵</h2></div></div>
          <UnitCard unit={battle.leader} />
          <div className="spirit-grid">
            {battle.spirits.map((spirit, index) => <UnitCard key={spirit.id} unit={spirit} bond={battle.spiritBonds[index]} selectable={Boolean(targetingCard)} onSelect={() => chooseSpiritTarget(spirit.id)} />)}
          </div>
          {targetingCard && <p className="target-note" role="status">为「{names[targetingCard]}」选择妖灵 · Esc 取消</p>}
        </aside>

        <section className="battle-table" aria-label="斗法牌桌">
          <div className="scene-vignette" aria-hidden="true" />
          <div className="enemy-zone"><p className="zone-label">槐阴异物</p><UnitCard unit={enemy} enemy /></div>

          <div className="battle-meter">
            <div className="resource-orb sword"><span>剑意</span><strong>{battle.swordIntent}</strong><small>/ {battle.swordIntentCap}</small></div>
            <div className="energy-track" aria-label={`灵力 ${battle.energy}/${battle.maxEnergy}`}>
              <div className="energy-label"><span>灵力</span><strong>{battle.energy}</strong><small>/ {battle.maxEnergy}</small></div>
              <div className="energy-pips">{Array.from({ length: battle.maxEnergy }, (_, index) => <i key={index} className={index < battle.energy ? 'filled' : ''} />)}</div>
            </div>
            <div className="enemy-resources"><span>符印 <strong>{enemy.talismanMarks}</strong></span><span>灼烧 <strong>{enemy.burnStacks}</strong></span></div>
            <p className="time-mark">{(battle.timeMs / 1_000).toFixed(1)} 秒</p>
          </div>

          <div className="combo-row" aria-label="当前连携">{battle.activeCombos.map((id) => <span key={id}>{comboNames[id]}</span>)}</div>

          <div className="hand-zone">
            <div className="hand-heading"><span>{build.name} · {PROTOTYPE_CONTENT.weapons[build.weaponId].name}</span><span>手牌 {battle.hand.length}/4</span><span>牌库 {battle.deck.length}</span><span>弃牌 {battle.discard.length}</span></div>
            <div className="hand-cards">
              {battle.hand.map((cardId) => {
                const card = PROTOTYPE_CONTENT.cards[cardId]
                const cost = getEffectiveCardCost(battle, card)
                const art = card.artKey ? artFiles[card.artKey] : undefined
                return (
                  <button type="button" key={cardId} className={`hand-card archetype-${card.tags[0]} ${targetingCard === cardId ? 'is-targeting' : ''}`} disabled={battle.status !== 'active' || cost > battle.energy} onClick={() => clickCard(cardId)}>
                    <span className="card-cost">{cost}</span><span className="card-kind">{card.kind}</span><strong>{card.name}</strong>
                    <span className="card-illustration" aria-hidden="true">{art ? <img src={`${ASSET_ROOT}${art}`} alt="" /> : <i>{card.name.at(0)}</i>}</span>
                    <span className="card-text">{card.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {battle.status !== 'active' && <div className={`battle-result ${battle.status}`} role="status"><span>{battle.status === 'victory' ? '破' : '败'}</span><h2>{battle.status === 'victory' ? '试法告捷' : '心脉受创'}</h2><p>{battle.status === 'victory' ? `「${build.name}」已证可行。` : '调整出牌次序，再渡此劫。'}</p><button type="button" onClick={() => dispatch({ type: 'restart' })}>重演此劫</button></div>}
        </section>

        <aside className="intel-panel">
          <section className="build-summary">
            <div className="panel-heading compact"><span>贰</span><div><small>ACTIVE BUILD</small><h2>{build.name}</h2></div></div>
            <p>{PROTOTYPE_CONTENT.weapons[build.weaponId].name} · {PROTOTYPE_CONTENT.techniques[build.techniqueId].name}</p>
            <div className="combo-list">{battle.activeCombos.map((id) => <span key={id}>连携 · {comboNames[id]}</span>)}</div>
          </section>
          <section className="priority-panel">
            <div className="panel-heading compact"><span>叁</span><div><small>AUTO CAST</small><h2>出牌次序</h2></div></div>
            <p className="panel-note">拖动或使用箭头排序。自动模式会跳过灵力不足的牌。</p>
            <PriorityList cardIds={battle.autoplayPriority} onChange={(cardIds) => dispatch({ type: 'reorder_priority', cardIds })} />
          </section>
          <section className="event-panel" aria-live="polite">
            <div className="panel-heading compact"><span>肆</span><div><small>BATTLE RECORD</small><h2>斗法录</h2></div></div>
            <ol className="event-list">{[...app.events].reverse().slice(0, 10).map((event, index) => { const [time, copy] = formatEvent(event); return <li key={`${event.atMs}-${event.type}-${index}`}><time>{time}s</time><span>{copy}</span></li> })}</ol>
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
