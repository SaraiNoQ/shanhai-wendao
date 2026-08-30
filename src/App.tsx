import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { AFFIXES, COLLECTION, COLLECTION_BY_ID, CONSUMABLES, EQUIPMENT, EQUIPMENT_SLOTS, TREASURES, type CollectionCategory, type EquipmentSlot } from './content/collection'
import { PROTOTYPE_CONTENT } from './content/prototype'
import { createBattle, getEffectiveCardCost, transitionBattle } from './game/battle'
import type { BattleCommand, BattleEvent, BattleState, BuildId, CardId, ComboId, UnitId, UnitState } from './game/types'
import { ESSENCE_NAMES, REROLL_ESSENCE_COST, battleContentFromSave, equipBuild, equipItem, loadPlayerSave, parseSave, previewReroll, receiveCollectible, resetLevel, resolveReroll, storePlayerSave, upgrade, upgradeCost, type PlayerSave } from './state/player'
import { PriorityList } from './ui/PriorityList'

const INITIAL_SEED = 20_260_827
const ASSET_ROOT = '/assets/pixel/'
const artFiles: Record<string, string> = {
  portrait_leader_01: 'portrait-leader-01.png', spirit_paper_bride: 'spirit-paper-bride.png', enemy_clay_idol: 'enemy-clay-idol.png',
  card_mountain_splitter: 'card-mountain-splitter.png', card_nine_heavens_edict: 'card-nine-heavens-edict.png', card_night_of_hundred_beasts: 'card-night-of-hundred-beasts.png',
}
const comboNames: Record<ComboId, string> = { flying_sword_seal: '飞剑镇符', spirit_edict: '灵使敕令', dual_spirit_sword: '双灵剑阵' }
const categoryNames: Record<CollectionCategory, string> = { weapon: '武器', equipment: '装备', technique: '功法', card: '术法', treasure: '法宝', consumable: '配方', spirit: '妖灵' }
const rarityNames = { common: '凡品', uncommon: '珍品', rare: '秘品', legacy: '传承' }
const slotNames: Record<EquipmentSlot, string> = { head: '头冠', robe: '法衣', feet: '足履', charm: '佩饰' }
const resourceNames = { cultivation: '修为', spiritSand: '灵砂', daoEssence: '道法精华', spiritEssence: '万灵精华', artifactEssence: '器华' }
const names: Record<string, string> = {
  leader: PROTOTYPE_CONTENT.leader.name, burn: '灼烧',
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.spirits).map((item) => [item.id, item.name])),
  ...Object.fromEntries(PROTOTYPE_CONTENT.enemies.map((item) => [item.id, item.name])),
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.cards).map((item) => [item.id, item.name])),
}

interface AppState { battle: BattleState; events: BattleEvent[] }
type Page = 'battle' | 'loadout' | 'codex' | 'save'

function UnitCard({ unit, bond, enemy = false, selectable = false, onSelect }: { unit: UnitState; bond?: number; enemy?: boolean; selectable?: boolean; onSelect?: () => void }) {
  const art = unit.artKey ? artFiles[unit.artKey] : undefined
  return <article className={`unit-card ${enemy ? 'enemy-card' : ''} ${selectable ? 'is-selectable' : ''}`}>
    <div className="unit-art" aria-hidden="true">{art ? <img src={`${ASSET_ROOT}${art}`} alt="" /> : <span>{unit.name.at(0)}</span>}</div>
    <div className="unit-copy"><p className="unit-title">{unit.title}</p><h3>{unit.name}</h3><div className="health-line" aria-label={`生元 ${unit.hp}/${unit.maxHp}`}><span style={{ width: `${Math.max(0, unit.hp / unit.maxHp * 100)}%` }} /></div>
      <div className="unit-stats"><span>生元 {unit.hp}/{unit.maxHp}</span><span>攻势 {unit.attack}</span><span>护体 {unit.defense}</span></div>
      <div className="status-row">{unit.shield > 0 && <span className="status-chip shield">护盾 {unit.shield}</span>}{unit.armorBreak > 0 && <span className="status-chip break">破甲 {unit.armorBreak}</span>}{unit.talismanMarks > 0 && <span className="status-chip mark">符印 {unit.talismanMarks}</span>}{unit.burnStacks > 0 && <span className="status-chip burn">灼烧 {unit.burnStacks}</span>}{bond !== undefined && <span className="status-chip bond">灵契 {bond}/3</span>}</div>
    </div>{selectable && <button type="button" className="target-hitbox" onClick={onSelect} aria-label={`选择${unit.name}为目标`} />}
  </article>
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
    case 'status_changed': { const labels = { sword_intent: '剑意', armor_break: '破甲', talisman_mark: '符印', burn: '灼烧', spirit_bond: '灵契', energy_discount: '减耗' }; return [time, `${event.targetId === 'battle' ? '' : names[event.targetId]}${labels[event.status]}变为 ${event.value}。`] }
    case 'energy_changed': return [time, `灵力变为 ${event.value}。`]
    case 'unit_action': return [time, `${names[event.unitId]}发动「${event.action}」。`]
    case 'combo_triggered': return [time, `连携「${comboNames[event.comboId]}」触发。`]
    case 'battle_ended': return [time, event.result === 'victory' ? '泥胎崩裂，试法告捷。' : '心脉俱损，试法失败。']
    case 'message': return [time, event.text]
  }
}

function ResourceBar({ save }: { save: PlayerSave }) {
  return <div className="resource-bar">{Object.entries(save.resources).map(([key, value]) => <span key={key}><small>{resourceNames[key as keyof typeof resourceNames]}</small><strong>{value}</strong></span>)}</div>
}

function LoadoutPage({ save, setSave, enterBattle }: { save: PlayerSave; setSave: (next: PlayerSave) => void; enterBattle: () => void }) {
  const select = (slot: EquipmentSlot | 'treasure' | 'consumable_0' | 'consumable_1', id: string) => setSave(equipItem(save, slot, id))
  return <main className="paper-page loadout-page">
    <header className="page-heading"><div><small>TRAVEL SATCHEL</small><h2>行囊与构筑</h2></div><button type="button" onClick={enterBattle}>携此阵试法</button></header>
    <section className="preset-board"><h3>六法阵谱</h3><div className="build-strip">{Object.values(PROTOTYPE_CONTENT.builds).map((preset) => <button key={preset.id} type="button" className={preset.id === save.loadout.buildId ? 'is-active' : ''} onClick={() => setSave(equipBuild(save, preset.id))}><strong>{preset.name}</strong><span>{preset.subtitle}</span></button>)}</div></section>
    <div className="loadout-grid">
      <section className="loadout-sheet"><h3>主修阵容</h3><dl><div><dt>武器</dt><dd>{PROTOTYPE_CONTENT.weapons[save.loadout.weaponId].name}</dd></div><div><dt>功法</dt><dd>{PROTOTYPE_CONTENT.techniques[save.loadout.techniqueId].name}</dd></div><div><dt>妖灵</dt><dd>{save.loadout.spiritIds.map((id) => PROTOTYPE_CONTENT.spirits[id].name).join(' · ')}</dd></div><div><dt>起始牌</dt><dd>{save.loadout.cardIds.map((id) => PROTOTYPE_CONTENT.cards[id].name).join(' · ')}</dd></div></dl></section>
      <section className="loadout-sheet"><h3>四象装备</h3>{EQUIPMENT_SLOTS.map((slot, index) => <label key={slot}><span>{slotNames[slot]}</span><select value={save.loadout.equipmentIds[index]} onChange={(event) => select(slot, event.target.value)}>{EQUIPMENT.filter((item) => item.slot === slot).map((item) => <option key={item.id} value={item.id}>{item.name} · Lv.{save.levels[item.id]}</option>)}</select><small>{(save.equipmentAffixes[save.loadout.equipmentIds[index]] ?? []).map((id) => AFFIXES[id].name).join(' / ')}</small></label>)}</section>
      <section className="loadout-sheet"><h3>法宝与行用</h3><label><span>法宝</span><select value={save.loadout.treasureId} onChange={(event) => select('treasure', event.target.value)}>{TREASURES.map((item) => <option key={item.id} value={item.id}>{item.name} · Lv.{save.levels[item.id]}</option>)}</select></label>{save.loadout.consumableIds.map((id, index) => <label key={index}><span>配方 {index + 1}</span><select value={id} onChange={(event) => select(`consumable_${index}` as 'consumable_0' | 'consumable_1', event.target.value)}>{CONSUMABLES.filter((item) => !save.loadout.consumableIds.includes(item.id) || item.id === id).map((item) => <option key={item.id} value={item.id}>{item.name} · Lv.{save.levels[item.id]}</option>)}</select></label>)}</section>
    </div>
  </main>
}

function CodexPage({ save, setSave }: { save: PlayerSave; setSave: (next: PlayerSave) => void }) {
  const [category, setCategory] = useState<CollectionCategory>('weapon')
  const items = COLLECTION.filter((item) => item.category === category)
  const [selectedId, setSelectedId] = useState(items[0].id)
  const selected = COLLECTION_BY_ID[selectedId]?.category === category ? COLLECTION_BY_ID[selectedId] : items[0]
  const level = save.levels[selected.id] ?? 1
  const cost = upgradeCost(selected, level)
  const pending = save.pendingReroll?.equipmentId === selected.id ? save.pendingReroll : undefined
  return <main className="paper-page codex-page">
    <header className="page-heading"><div><small>CATALOGUE OF ODDITIES</small><h2>万象图鉴</h2></div><p>{save.ownedIds.length} / {COLLECTION.length} 已收录</p></header>
    <nav className="category-tabs" aria-label="收藏类别">{(Object.keys(categoryNames) as CollectionCategory[]).map((id) => <button type="button" key={id} className={category === id ? 'is-active' : ''} onClick={() => { setCategory(id); setSelectedId(COLLECTION.find((item) => item.category === id)!.id) }}>{categoryNames[id]}<small>{COLLECTION.filter((item) => item.category === id).length}</small></button>)}</nav>
    <div className="codex-layout"><section className="collection-grid">{items.map((item) => <button type="button" key={item.id} className={`collection-card rarity-${item.rarity} ${selected.id === item.id ? 'is-active' : ''}`} onClick={() => setSelectedId(item.id)}><span>{categoryNames[item.category]} · {rarityNames[item.rarity]}</span><i aria-hidden="true">{item.name.at(0)}</i><strong>{item.name}</strong><small>Lv.{save.levels[item.id] ?? 1} / 10</small></button>)}</section>
      <aside className="collection-detail"><span className="rarity-mark">{categoryNames[selected.category]} · {rarityNames[selected.rarity]}</span><h3>{selected.name}</h3><div className="detail-level"><strong>Lv.{level}</strong><span>/ 10</span></div><p className="effect-copy">{selected.summary}</p><div className="tag-list">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><blockquote>{selected.lore}</blockquote><dl><div><dt>来源</dt><dd>{selected.unlockSource}</dd></div><div><dt>重复转化</dt><dd>{selected.duplicateEssence} {ESSENCE_NAMES[selected.essenceType]}</dd></div></dl>
        <div className="detail-actions"><button type="button" disabled={level >= 10 || save.resources.spiritSand < cost.spiritSand || save.resources[cost.essenceType] < cost.essence} onClick={() => setSave(upgrade(save, selected.id))}>{level >= 10 ? '已臻圆满' : `升级 · ${cost.spiritSand} 灵砂 / ${cost.essence} ${ESSENCE_NAMES[cost.essenceType]}`}</button><button type="button" disabled={level === 1} onClick={() => setSave(resetLevel(save, selected.id))}>免费重置</button><button type="button" onClick={() => setSave(receiveCollectible(save, selected.id))}>模拟重复掉落</button></div>
        {selected.category === 'equipment' && <section className="affix-box"><h4>附加词条</h4><p>{(save.equipmentAffixes[selected.id] ?? []).map((id) => `${AFFIXES[id].name} +${AFFIXES[id].value}${AFFIXES[id].suffix}`).join(' · ')}</p>{pending ? <div className="reroll-preview"><small>候选</small><p>{pending.affixes.map((id) => `${AFFIXES[id].name} +${AFFIXES[id].value}${AFFIXES[id].suffix}`).join(' · ')}</p><button type="button" onClick={() => setSave(resolveReroll(save, true))}>确认替换</button><button type="button" onClick={() => setSave(resolveReroll(save, false))}>保留旧词条</button></div> : <button type="button" disabled={save.resources.artifactEssence < REROLL_ESSENCE_COST} onClick={() => setSave(previewReroll(save, selected.id))}>预览重铸 · {REROLL_ESSENCE_COST} 器华</button>}</section>}
      </aside></div>
  </main>
}

function SavePage({ save, setSave }: { save: PlayerSave; setSave: (next: PlayerSave) => void }) {
  const [text, setText] = useState(() => JSON.stringify(save, null, 2))
  const [message, setMessage] = useState('当前进度已自动保存在此浏览器。')
  const importSave = () => { const parsed = parseSave(text); if (!parsed.success) { setMessage('导入失败：格式、版本或字段无效，当前存档未被覆盖。'); return } setSave(parsed.data); setMessage('导入成功，当前存档已替换。') }
  return <main className="paper-page save-page"><header className="page-heading"><div><small>LOCAL ARCHIVE</small><h2>设置与存档</h2></div></header><section><p>{message}</p><textarea aria-label="JSON 存档" spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} /><div className="save-actions"><button type="button" onClick={() => { setText(JSON.stringify(save, null, 2)); setMessage('已将当前存档写入文本框。') }}>导出到文本框</button><button type="button" onClick={importSave}>验证并导入</button></div></section></main>
}

function App() {
  const [save, setSave] = useState(loadPlayerSave)
  const [page, setPage] = useState<Page>('battle')
  const [app, setApp] = useState<AppState>(() => ({ battle: createBattle(INITIAL_SEED, battleContentFromSave(save), save.loadout.buildId), events: [{ type: 'battle_started', seed: INITIAL_SEED, buildId: save.loadout.buildId, atMs: 0 }] }))
  const [speed, setSpeed] = useState(1)
  const [targetingCard, setTargetingCard] = useState<CardId>()
  const battleContent = useMemo(() => battleContentFromSave(save), [save])

  useEffect(() => storePlayerSave(save), [save])
  const dispatch = useCallback((command: BattleCommand) => setApp((current) => { const result = transitionBattle(current.battle, command, battleContent); return { battle: result.state, events: command.type === 'restart' ? result.events : [...current.events, ...result.events].slice(-80) } }), [battleContent])
  useEffect(() => { if (app.battle.status !== 'active' || page !== 'battle') return; const timer = window.setInterval(() => dispatch({ type: 'advance', elapsedMs: 250 * speed }), 250); return () => window.clearInterval(timer) }, [app.battle.status, dispatch, page, speed])
  useEffect(() => { if (!targetingCard) return; const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') setTargetingCard(undefined) }; window.addEventListener('keydown', cancel); return () => window.removeEventListener('keydown', cancel) }, [targetingCard])

  const startBattle = () => { const content = battleContentFromSave(save); const battle = createBattle(INITIAL_SEED, content, save.loadout.buildId); setApp({ battle, events: [{ type: 'battle_started', seed: INITIAL_SEED, buildId: battle.buildId, atMs: 0 }] }); setTargetingCard(undefined); setPage('battle') }
  const chooseBuild = (buildId: BuildId) => { const next = equipBuild(save, buildId); setSave(next); const battle = createBattle(INITIAL_SEED, battleContentFromSave(next), buildId); setApp({ battle, events: [{ type: 'battle_started', seed: INITIAL_SEED, buildId, atMs: 0 }] }); setTargetingCard(undefined) }
  const { battle } = app
  const build = battleContent.builds[battle.buildId]
  const enemy = battle.enemies.find((unit) => unit.hp > 0) ?? battle.enemies[0]
  const clickCard = (cardId: CardId) => battleContent.cards[cardId].targetRule === 'chosen_spirit' ? setTargetingCard(cardId) : dispatch({ type: 'play_card', cardId })
  const chooseSpiritTarget = (targetId: UnitId) => { if (!targetingCard) return; dispatch({ type: 'play_card', cardId: targetingCard, targetId }); setTargetingCard(undefined) }

  return <div className="game-shell">
    <header className="topbar"><div className="brand-lockup"><span className="brand-seal" aria-hidden="true">問</span><div><p>槐阴古道 · 炼气试演</p><h1>山海问道</h1></div></div><nav className="main-nav" aria-label="主要页面">{([['battle', '斗法'], ['loadout', '行囊'], ['codex', '图鉴'], ['save', '存档']] as [Page, string][]).map(([id, label]) => <button type="button" key={id} className={page === id ? 'is-active' : ''} onClick={() => setPage(id)}>{label}</button>)}</nav>{page === 'battle' && <div className="battle-controls"><span className="seed-mark">劫数 {battle.seed}</span><div className="speed-control" aria-label="战斗速度">{[1, 2, 4].map((value) => <button key={value} type="button" className={speed === value ? 'is-active' : ''} onClick={() => setSpeed(value)}>{value}×</button>)}</div><button type="button" className={battle.autoplay ? 'autoplay is-active' : 'autoplay'} onClick={() => dispatch({ type: 'set_autoplay', enabled: !battle.autoplay })}>{battle.autoplay ? '自动 · 开' : '自动 · 关'}</button><button type="button" className="restart" onClick={() => dispatch({ type: 'restart' })}>重演此劫</button></div>}</header>
    <ResourceBar save={save} />
    {page === 'loadout' && <LoadoutPage save={save} setSave={setSave} enterBattle={startBattle} />}
    {page === 'codex' && <CodexPage save={save} setSave={setSave} />}
    {page === 'save' && <SavePage save={save} setSave={setSave} />}
    {page === 'battle' && <>
      <nav className="build-strip" aria-label="快捷构筑">{Object.values(PROTOTYPE_CONTENT.builds).map((preset) => <button key={preset.id} type="button" className={preset.id === battle.buildId ? 'is-active' : ''} onClick={() => chooseBuild(preset.id)}><strong>{preset.name}</strong><span>{preset.subtitle}</span></button>)}</nav>
      <main className="battle-layout"><aside className="party-panel"><div className="panel-heading"><span>壹</span><div><small>PLAYER FORMATION</small><h2>修士阵</h2></div></div><UnitCard unit={battle.leader} /><div className="spirit-grid">{battle.spirits.map((spirit, index) => <UnitCard key={spirit.id} unit={spirit} bond={battle.spiritBonds[index]} selectable={Boolean(targetingCard)} onSelect={() => chooseSpiritTarget(spirit.id)} />)}</div>{targetingCard && <p className="target-note">为「{names[targetingCard]}」选择妖灵 · Esc 取消</p>}</aside>
        <section className="battle-table"><div className="scene-vignette" aria-hidden="true" /><div className="enemy-zone"><p className="zone-label">槐阴异物</p><UnitCard unit={enemy} enemy /></div><div className="battle-meter"><div className="resource-orb sword"><span>剑意</span><strong>{battle.swordIntent}</strong><small>/ {battle.swordIntentCap}</small></div><div className="energy-track"><div className="energy-label"><span>灵力</span><strong>{battle.energy}</strong><small>/ {battle.maxEnergy}</small></div><div className="energy-pips">{Array.from({ length: battle.maxEnergy }, (_, index) => <i key={index} className={index < battle.energy ? 'filled' : ''} />)}</div></div><div className="enemy-resources"><span>符印 <strong>{enemy.talismanMarks}</strong></span><span>灼烧 <strong>{enemy.burnStacks}</strong></span></div><p className="time-mark">{(battle.timeMs / 1_000).toFixed(1)} 秒</p></div><div className="combo-row">{battle.activeCombos.map((id) => <span key={id}>{comboNames[id]}</span>)}</div>
          <div className="hand-zone"><div className="hand-heading"><span>{PROTOTYPE_CONTENT.builds[battle.buildId].name} · {battleContent.weapons[build.weaponId].name}</span><span>手牌 {battle.hand.length}/4</span><span>牌库 {battle.deck.length}</span><span>弃牌 {battle.discard.length}</span></div><div className="hand-cards">{battle.hand.map((cardId) => { const card = battleContent.cards[cardId]; const cost = getEffectiveCardCost(battle, card); const art = card.artKey ? artFiles[card.artKey] : undefined; return <button type="button" key={cardId} className={`hand-card archetype-${card.tags[0]} ${targetingCard === cardId ? 'is-targeting' : ''}`} disabled={battle.status !== 'active' || cost > battle.energy} onClick={() => clickCard(cardId)}><span className="card-cost">{cost}</span><span className="card-kind">{card.kind}</span><strong>{card.name}</strong><span className="card-illustration" aria-hidden="true">{art ? <img src={`${ASSET_ROOT}${art}`} alt="" /> : <i>{card.name.at(0)}</i>}</span><span className="card-text">{card.description}</span></button> })}</div></div>{battle.status !== 'active' && <div className={`battle-result ${battle.status}`} role="status"><span>{battle.status === 'victory' ? '破' : '败'}</span><h2>{battle.status === 'victory' ? '试法告捷' : '心脉受创'}</h2><p>{battle.status === 'victory' ? `「${PROTOTYPE_CONTENT.builds[battle.buildId].name}」已证可行。` : '调整出牌次序，再渡此劫。'}</p><button type="button" onClick={() => dispatch({ type: 'restart' })}>重演此劫</button></div>}
        </section><aside className="intel-panel"><section className="build-summary"><div className="panel-heading compact"><span>贰</span><div><small>ACTIVE BUILD</small><h2>{PROTOTYPE_CONTENT.builds[battle.buildId].name}</h2></div></div><p>{battleContent.weapons[build.weaponId].name} · {battleContent.techniques[build.techniqueId].name}</p><div className="combo-list">{battle.activeCombos.map((id) => <span key={id}>连携 · {comboNames[id]}</span>)}</div></section><section className="priority-panel"><div className="panel-heading compact"><span>叁</span><div><small>AUTO CAST</small><h2>出牌次序</h2></div></div><p className="panel-note">拖动或使用箭头排序。自动模式会跳过灵力不足的牌。</p><PriorityList cardIds={battle.autoplayPriority} onChange={(cardIds) => { dispatch({ type: 'reorder_priority', cardIds }); setSave((current) => ({ ...current, loadout: { ...current.loadout, autoplayPriority: cardIds } })) }} /></section><section className="event-panel" aria-live="polite"><div className="panel-heading compact"><span>肆</span><div><small>BATTLE RECORD</small><h2>斗法录</h2></div></div><ol className="event-list">{[...app.events].reverse().slice(0, 10).map((event, index) => { const [time, copy] = formatEvent(event); return <li key={`${event.atMs}-${event.type}-${index}`}><time>{time}s</time><span>{copy}</span></li> })}</ol></section></aside></main>
    </>}
  </div>
}

export default App
