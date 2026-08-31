import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { AFFIXES, COLLECTION, COLLECTION_BY_ID, CONSUMABLES, EQUIPMENT, EQUIPMENT_SLOTS, TREASURES, type CollectionCategory, type EquipmentSlot } from './content/collection'
import { PROTOTYPE_CONTENT } from './content/prototype'
import { createBattle, getCardAvailability, transitionBattle } from './game/battle'
import type { BattleCommand, BattleEvent, BattleState, BuildId, CardId, ComboId, UnitId, UnitState } from './game/types'
import { advanceStageSession, createStageSession, nextCampaignStage, setCampaignMode, settleStage, type PendingOfflineSettlement, type StageSession } from './game/campaign'
import { ESSENCE_NAMES, REROLL_ESSENCE_COST, attachOfflineSettlement, battleContentFromSave, canEquipBuild, claimOfflineSettlement, createPlayerSave, equipBuild, equipItem, loadPlayerSave, markActive, parseSave, previewReroll, resetLevel, resolveReroll, storePlayerSave, upgrade, upgradeCost, type PlayerSave } from './state/player'
import { PriorityList } from './ui/PriorityList'
import { TravelPage } from './ui/TravelPage'

const INITIAL_SEED = 20_260_827
const ASSET_ROOT = '/assets/pixel/'
const artFiles: Record<string, string> = {
  portrait_leader_01: 'portrait-leader-01.png', spirit_paper_bride: 'spirit-paper-bride.png', enemy_clay_idol: 'enemy-clay-idol.png',
  card_mountain_splitter: 'card-mountain-splitter.png', card_nine_heavens_edict: 'card-nine-heavens-edict.png', card_night_of_hundred_beasts: 'card-night-of-hundred-beasts.png',
  spirit_blade_tail_fox: 'spirit-blade-tail-fox.png', spirit_iron_beak_crane: 'spirit-iron-beak-crane.png', spirit_lantern_ghost: 'spirit-lantern-ghost.png', spirit_mountain_child: 'spirit-mountain-child.png', spirit_dream_tapir: 'spirit-dream-tapir.png',
  enemy_shadow_civet: 'enemy-shadow-civet.png', enemy_paper_child: 'enemy-paper-child.png', enemy_headless_woodcutter: 'enemy-headless-woodcutter.png', enemy_borrowed_life_crone: 'enemy-borrowed-life-crone.png', enemy_hundred_eyed_branch: 'enemy-hundred-eyed-branch.png', enemy_paper_armor_envoy: 'enemy-paper-armor-envoy.png',
  card_guiding_edge: 'card-guiding-edge.png', card_fire_talisman: 'card-fire-talisman.png', card_call_true_name: 'card-call-true-name.png',
}
const comboNames: Record<ComboId, string> = { flying_sword_seal: '飞剑镇符', spirit_edict: '灵使敕令', dual_spirit_sword: '双灵剑阵' }
const categoryNames: Record<CollectionCategory, string> = { weapon: '武器', equipment: '装备', technique: '功法', card: '术法', treasure: '法宝', consumable: '配方', spirit: '妖灵' }
const rarityNames = { common: '凡品', uncommon: '珍品', rare: '秘品', legacy: '传承' }
const slotNames: Record<EquipmentSlot, string> = { head: '头冠', robe: '法衣', feet: '足履', charm: '佩饰' }
const resourceNames = { cultivation: '修为', spiritSand: '灵砂', daoEssence: '道法精华', spiritEssence: '万灵精华', artifactEssence: '器华' }
const names: Record<string, string> = {
  leader: PROTOTYPE_CONTENT.leader.name, burn: '灼烧',
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.spirits).map((item) => [item.id, item.name])),
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.enemyDefinitions).map((item) => [item.id, item.name])),
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.cards).map((item) => [item.id, item.name])),
}

interface AppState { battle: BattleState; events: BattleEvent[] }
type Page = 'travel' | 'battle' | 'loadout' | 'codex' | 'save'

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
    case 'unit_summoned': return [time, `${names[event.sourceId]}召来${names[event.unitId]}。`]
    case 'enemy_buff': return [time, `${names[event.targetId]}获得强化。`]
    case 'wave_started': return [time, `第 ${event.waveNumber} 波来袭。`]
    case 'battle_timeout': return [time, '斗法久持不下，判定失败。']
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
    <section className="preset-board"><h3>六法阵谱</h3><div className="build-strip">{Object.values(PROTOTYPE_CONTENT.builds).map((preset) => { const available = canEquipBuild(save, preset.id); return <button key={preset.id} type="button" disabled={!available} className={`${preset.id === save.loadout.buildId ? 'is-active' : ''} ${available ? '' : 'is-locked'}`} onClick={() => setSave(equipBuild(save, preset.id))}><strong>{available ? preset.name : '未解阵谱'}</strong><span>{available ? preset.subtitle : '继续游历以收集所需收藏'}</span></button> })}</div></section>
    <div className="loadout-grid">
      <section className="loadout-sheet"><h3>主修阵容</h3><dl><div><dt>武器</dt><dd>{PROTOTYPE_CONTENT.weapons[save.loadout.weaponId].name}</dd></div><div><dt>功法</dt><dd>{PROTOTYPE_CONTENT.techniques[save.loadout.techniqueId].name}</dd></div><div><dt>妖灵</dt><dd>{save.loadout.spiritIds.map((id) => PROTOTYPE_CONTENT.spirits[id].name).join(' · ')}</dd></div><div><dt>起始牌</dt><dd>{save.loadout.cardIds.map((id) => PROTOTYPE_CONTENT.cards[id].name).join(' · ')}</dd></div></dl></section>
      <section className="loadout-sheet"><h3>四象装备</h3>{EQUIPMENT_SLOTS.map((slot, index) => <label key={slot}><span>{slotNames[slot]}</span><select value={save.loadout.equipmentIds[index]} onChange={(event) => select(slot, event.target.value)}>{EQUIPMENT.filter((item) => item.slot === slot && save.ownedIds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · Lv.{save.levels[item.id]}</option>)}</select><small>{(save.equipmentAffixes[save.loadout.equipmentIds[index]] ?? []).map((id) => AFFIXES[id].name).join(' / ')}</small></label>)}</section>
      <section className="loadout-sheet"><h3>法宝与行用</h3><label><span>法宝</span><select value={save.loadout.treasureId} onChange={(event) => select('treasure', event.target.value)}>{TREASURES.filter((item) => save.ownedIds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · Lv.{save.levels[item.id]}</option>)}</select></label>{save.loadout.consumableIds.map((id, index) => <label key={index}><span>配方 {index + 1}</span><select value={id} onChange={(event) => select(`consumable_${index}` as 'consumable_0' | 'consumable_1', event.target.value)}>{CONSUMABLES.filter((item) => save.ownedIds.includes(item.id) && (!save.loadout.consumableIds.includes(item.id) || item.id === id)).map((item) => <option key={item.id} value={item.id}>{item.name} · Lv.{save.levels[item.id]}</option>)}</select></label>)}</section>
    </div>
  </main>
}

function CodexPage({ save, setSave }: { save: PlayerSave; setSave: (next: PlayerSave) => void }) {
  const [category, setCategory] = useState<CollectionCategory>('weapon')
  const items = COLLECTION.filter((item) => item.category === category)
  const [selectedId, setSelectedId] = useState(items[0].id)
  const selected = COLLECTION_BY_ID[selectedId]?.category === category ? COLLECTION_BY_ID[selectedId] : items[0]
  const level = save.levels[selected.id] ?? 1
  const owned = save.ownedIds.includes(selected.id)
  const cost = upgradeCost(selected, level)
  const pending = save.pendingReroll?.equipmentId === selected.id ? save.pendingReroll : undefined
  return <main className="paper-page codex-page">
    <header className="page-heading"><div><small>CATALOGUE OF ODDITIES</small><h2>万象图鉴</h2></div><p>{save.ownedIds.length} / {COLLECTION.length} 已收录</p></header>
    <nav className="category-tabs" aria-label="收藏类别">{(Object.keys(categoryNames) as CollectionCategory[]).map((id) => <button type="button" key={id} className={category === id ? 'is-active' : ''} onClick={() => { setCategory(id); setSelectedId(COLLECTION.find((item) => item.category === id)!.id) }}>{categoryNames[id]}<small>{COLLECTION.filter((item) => item.category === id).length}</small></button>)}</nav>
    <div className="codex-layout"><section className="collection-grid">{items.map((item) => { const itemOwned = save.ownedIds.includes(item.id); return <button type="button" key={item.id} className={`collection-card rarity-${item.rarity} ${selected.id === item.id ? 'is-active' : ''} ${itemOwned ? '' : 'is-locked'}`} onClick={() => setSelectedId(item.id)}><span>{categoryNames[item.category]} · {itemOwned ? rarityNames[item.rarity] : '未收录'}</span><i aria-hidden="true">{itemOwned ? item.name.at(0) : '？'}</i><strong>{itemOwned ? item.name : '未知收藏'}</strong><small>{itemOwned ? `Lv.${save.levels[item.id] ?? 1} / 10` : item.unlockSource}</small></button> })}</section>
      <aside className="collection-detail"><span className="rarity-mark">{categoryNames[selected.category]} · {rarityNames[selected.rarity]}</span><h3>{selected.name}</h3><div className="detail-level"><strong>Lv.{level}</strong><span>/ 10</span></div><p className="effect-copy">{selected.summary}</p><div className="tag-list">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><blockquote>{selected.lore}</blockquote><dl><div><dt>来源</dt><dd>{selected.unlockSource}</dd></div><div><dt>重复转化</dt><dd>{selected.duplicateEssence} {ESSENCE_NAMES[selected.essenceType]}</dd></div></dl>
        <div className="detail-actions">{owned ? <><button type="button" disabled={level >= 10 || save.resources.spiritSand < cost.spiritSand || save.resources[cost.essenceType] < cost.essence} onClick={() => setSave(upgrade(save, selected.id))}>{level >= 10 ? '已臻圆满' : `升级 · ${cost.spiritSand} 灵砂 / ${cost.essence} ${ESSENCE_NAMES[cost.essenceType]}`}</button><button type="button" disabled={level === 1} onClick={() => setSave(resetLevel(save, selected.id))}>免费重置</button></> : <p className="locked-note">继续游历以收录此物。</p>}</div>
        {owned && selected.category === 'equipment' && <section className="affix-box"><h4>附加词条</h4><p>{(save.equipmentAffixes[selected.id] ?? []).map((id) => `${AFFIXES[id].name} +${AFFIXES[id].value}${AFFIXES[id].suffix}`).join(' · ')}</p>{pending ? <div className="reroll-preview"><small>候选</small><p>{pending.affixes.map((id) => `${AFFIXES[id].name} +${AFFIXES[id].value}${AFFIXES[id].suffix}`).join(' · ')}</p><button type="button" onClick={() => setSave(resolveReroll(save, true))}>确认替换</button><button type="button" onClick={() => setSave(resolveReroll(save, false))}>保留旧词条</button></div> : <button type="button" disabled={save.resources.artifactEssence < REROLL_ESSENCE_COST} onClick={() => setSave(previewReroll(save, selected.id))}>预览重铸 · {REROLL_ESSENCE_COST} 器华</button>}</section>}
      </aside></div>
  </main>
}

function SavePage({ save, setSave, onNewJourney }: { save: PlayerSave; setSave: (next: PlayerSave) => void; onNewJourney: () => void }) {
  const [text, setText] = useState(() => JSON.stringify(save, null, 2))
  const [message, setMessage] = useState('当前进度已自动保存在此浏览器。')
  const [confirmNew, setConfirmNew] = useState(false)
  const importSave = () => { const parsed = parseSave(text, Date.now()); if (!parsed.success) { setMessage('导入失败：格式、版本或字段无效，当前存档未被覆盖。'); return } setSave(parsed.data); setMessage('导入成功，当前存档已替换。') }
  return <main className="paper-page save-page"><header className="page-heading"><div><small>LOCAL ARCHIVE</small><h2>设置与存档</h2></div></header><section><p>{message}</p><textarea aria-label="JSON 存档" spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} /><div className="save-actions"><button type="button" onClick={() => { setText(JSON.stringify(save, null, 2)); setMessage('已将当前存档写入文本框。') }}>导出到文本框</button><button type="button" onClick={importSave}>验证并导入</button><button type="button" className="danger-action" onClick={() => setConfirmNew(true)}>新开正式旅程</button></div>{confirmNew && <div className="new-journey-confirm" role="alertdialog" aria-labelledby="new-journey-title"><h3 id="new-journey-title">舍弃当前主存档？</h3><p>当前收藏、等级、资源与主线进度会被正式炼气开局替换。请先导出存档。</p><button type="button" onClick={() => setConfirmNew(false)}>取消</button><button type="button" className="danger-action" onClick={() => { onNewJourney(); setConfirmNew(false); setMessage('正式旅程已经开始。') }}>确认新开</button></div>}</section></main>
}

function App() {
  const [save, setSave] = useState(loadPlayerSave)
  const [page, setPage] = useState<Page>('travel')
  const [app, setApp] = useState<AppState>(() => ({ battle: createBattle(INITIAL_SEED, battleContentFromSave(save), save.loadout.buildId), events: [{ type: 'battle_started', seed: INITIAL_SEED, buildId: save.loadout.buildId, atMs: 0 }] }))
  const [campaignSession, setCampaignSession] = useState<StageSession>()
  const [visible, setVisible] = useState(() => !document.hidden)
  const [offlineBusy, setOfflineBusy] = useState(false)
  const [offlineError, setOfflineError] = useState<string>()
  const [speed, setSpeed] = useState(1)
  const [targetingCard, setTargetingCard] = useState<CardId>()
  const battleContent = useMemo(() => battleContentFromSave(save), [save])
  const saveRef = useRef(save)

  useEffect(() => { saveRef.current = save; storePlayerSave(save) }, [save])
  useEffect(() => {
    let activeWorker: Worker | undefined
    let retryCount = 0
    const runOffline = (current: PlayerSave, elapsedMs: number, nowMs: number) => {
      setOfflineBusy(true)
      setOfflineError(undefined)
      activeWorker?.terminate()
      activeWorker = new Worker(new URL('./game/offline.worker.ts', import.meta.url), { type: 'module' })
      const sourceTimestamp = current.campaign.lastActiveAtMs
      activeWorker.onmessage = (event: MessageEvent<PendingOfflineSettlement | undefined>) => {
        setSave((latest) => latest.campaign.lastActiveAtMs !== sourceTimestamp || latest.campaign.pendingOfflineSettlement ? latest : event.data ? attachOfflineSettlement(latest, event.data, nowMs) : markActive(latest, nowMs))
        setOfflineBusy(false)
        activeWorker?.terminate()
      }
      activeWorker.onerror = () => {
        activeWorker?.terminate()
        if (retryCount < 1) {
          retryCount += 1
          runOffline(current, elapsedMs, nowMs)
          return
        }
        setOfflineBusy(false)
        setOfflineError('离线推演失败，已从现在继续在线推进。')
        setSave((latest) => latest.campaign.lastActiveAtMs === sourceTimestamp ? markActive(latest, Date.now()) : latest)
      }
      activeWorker.postMessage({ save: current, elapsedMs, nowMs })
    }
    const resume = () => {
      const nowMs = Date.now()
      const current = saveRef.current
      const elapsedMs = Math.max(0, nowMs - current.campaign.lastActiveAtMs)
      retryCount = 0
      if (current.campaign.pendingOfflineSettlement || current.campaign.mode === 'paused' || elapsedMs < 250) { setOfflineError(undefined); setSave((value) => markActive(value, nowMs)); return }
      runOffline(current, elapsedMs, nowMs)
    }
    resume()
    const onVisibility = () => { const nextVisible = !document.hidden; setVisible(nextVisible); if (nextVisible) resume(); else setSave((current) => markActive(current, Date.now())) }
    const onPageHide = () => setSave((current) => markActive(current, Date.now()))
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => { activeWorker?.terminate(); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', onPageHide) }
  }, [])
  useEffect(() => {
    if (!visible || offlineBusy || campaignSession || save.campaign.mode === 'paused' || save.campaign.pendingOfflineSettlement) return
    const timer = window.setTimeout(() => setCampaignSession(createStageSession(save, nextCampaignStage(save))), 0)
    return () => window.clearTimeout(timer)
  }, [campaignSession, offlineBusy, save, visible])
  useEffect(() => {
    if (!visible || !campaignSession || campaignSession.status !== 'active' || save.campaign.mode === 'paused') return
    const timer = window.setInterval(() => setCampaignSession((current) => current ? advanceStageSession(current, 250 * speed, save) : current), 250)
    return () => window.clearInterval(timer)
  }, [campaignSession, save, speed, visible])
  useEffect(() => {
    if (!campaignSession || campaignSession.status === 'active' || page === 'battle') return
    const finished = campaignSession
    const timer = window.setTimeout(() => { setSave((current) => markActive(settleStage(current, finished), Date.now())); setCampaignSession(undefined) }, 0)
    return () => window.clearTimeout(timer)
  }, [campaignSession, page])
  const dispatch = useCallback((command: BattleCommand) => {
    if (campaignSession) {
      setCampaignSession((current) => {
        if (!current) return current
        if (command.type === 'restart') return createStageSession(save, current.stageNumber)
        const result = transitionBattle(current.battle, command, battleContent)
        return { ...current, battle: result.state, events: [...current.events, ...result.events] }
      })
      return
    }
    setApp((current) => { const result = transitionBattle(current.battle, command, battleContent); return { battle: result.state, events: command.type === 'restart' ? result.events : [...current.events, ...result.events].slice(-80) } })
  }, [battleContent, campaignSession, save])
  useEffect(() => { if (campaignSession || app.battle.status !== 'active' || page !== 'battle') return; const timer = window.setInterval(() => dispatch({ type: 'advance', elapsedMs: 250 * speed }), 250); return () => window.clearInterval(timer) }, [app.battle.status, campaignSession, dispatch, page, speed])
  useEffect(() => { if (!targetingCard) return; const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') setTargetingCard(undefined) }; window.addEventListener('keydown', cancel); return () => window.removeEventListener('keydown', cancel) }, [targetingCard])

  const settleFinishedBattle = () => {
    if (campaignSession && campaignSession.status !== 'active') {
      setSave((current) => markActive(settleStage(current, campaignSession), Date.now()))
      setCampaignSession(undefined)
    }
    setTargetingCard(undefined)
    setPage('travel')
  }
  const startBattle = (stageNumber = nextCampaignStage(save)) => { if (!campaignSession || campaignSession.stageNumber !== stageNumber || campaignSession.status !== 'active') setCampaignSession(createStageSession(save, stageNumber)); setTargetingCard(undefined); setPage('battle') }
  const retryBlocked = (stageNumber: number) => { const next = setCampaignMode(save, 'advance'); setSave(next); setCampaignSession(createStageSession(next, stageNumber)); setTargetingCard(undefined); setPage('battle') }
  const chooseBuild = (buildId: BuildId) => { const next = equipBuild(save, buildId); if (next === save) return; setSave(next); if (campaignSession) setCampaignSession(createStageSession(next, campaignSession.stageNumber)); else { const battle = createBattle(INITIAL_SEED, battleContentFromSave(next), buildId); setApp({ battle, events: [{ type: 'battle_started', seed: INITIAL_SEED, buildId, atMs: 0 }] }) } setTargetingCard(undefined) }
  const changeMode = (mode: PlayerSave['campaign']['mode']) => { setCampaignSession(undefined); setSave((current) => setCampaignMode(current, mode)) }
  const navigate = (nextPage: Page) => { if (nextPage !== 'battle' && campaignSession && !campaignSession.battle.autoplay) dispatch({ type: 'set_autoplay', enabled: true }); if (nextPage !== 'battle' && campaignSession?.status !== 'active') settleFinishedBattle(); setPage(nextPage) }
  const newJourney = () => { const next = createPlayerSave(Date.now()); setSave(next); setCampaignSession(undefined); setApp({ battle: createBattle(INITIAL_SEED, battleContentFromSave(next), next.loadout.buildId), events: [] }); setPage('travel') }
  const battle = campaignSession?.battle ?? app.battle
  const activeEvents = campaignSession?.events ?? app.events
  const build = battleContent.builds[battle.buildId]
  const enemy = battle.enemies.find((unit) => unit.hp > 0) ?? battle.enemies[0]
  const clickCard = (cardId: CardId) => battleContent.cards[cardId].targetRule === 'chosen_spirit' ? setTargetingCard(cardId) : dispatch({ type: 'play_card', cardId })
  const chooseSpiritTarget = (targetId: UnitId) => { if (!targetingCard) return; dispatch({ type: 'play_card', cardId: targetingCard, targetId }); setTargetingCard(undefined) }

  return <div className="game-shell">
    <header className="topbar"><div className="brand-lockup"><span className="brand-seal" aria-hidden="true">問</span><div><p>槐阴古道 · 炼气试演</p><h1>山海问道</h1></div></div><nav className="main-nav" aria-label="主要页面">{([['travel', '游历'], ['battle', '斗法'], ['loadout', '行囊'], ['codex', '图鉴'], ['save', '存档']] as [Page, string][]).map(([id, label]) => <button type="button" key={id} className={page === id ? 'is-active' : ''} onClick={() => navigate(id)}>{label}</button>)}</nav>{page === 'battle' && <div className="battle-controls"><span className="seed-mark">{campaignSession ? `第 ${campaignSession.stageNumber} 关 · ${campaignSession.waveIndex + 1} 波` : `劫数 ${battle.seed}`}</span><div className="speed-control" aria-label="战斗速度">{[1, 2, 4].map((value) => <button key={value} type="button" className={speed === value ? 'is-active' : ''} onClick={() => setSpeed(value)}>{value}×</button>)}</div><button type="button" className={battle.autoplay ? 'autoplay is-active' : 'autoplay'} onClick={() => dispatch({ type: 'set_autoplay', enabled: !battle.autoplay })}>{battle.autoplay ? '自动 · 开' : '自动 · 关'}</button><button type="button" className="restart" onClick={() => dispatch({ type: 'restart' })}>重演此关</button></div>}</header>
    <ResourceBar save={save} />
    {page === 'travel' && <TravelPage save={save} session={campaignSession} offlineBusy={offlineBusy} offlineError={offlineError} onSetMode={changeMode} onEnterBattle={startBattle} onRetryBlocked={retryBlocked} onClaimOffline={() => setSave((current) => claimOfflineSettlement(current, Date.now()))} onOpenLoadout={() => setPage('loadout')} onRetryOffline={() => { setOfflineError(undefined); setSave((current) => markActive(current, Date.now())) }} />}
    {page === 'loadout' && <LoadoutPage save={save} setSave={setSave} enterBattle={startBattle} />}
    {page === 'codex' && <CodexPage save={save} setSave={setSave} />}
    {page === 'save' && <SavePage save={save} setSave={(next) => { setSave(next); setCampaignSession(undefined); setPage('travel') }} onNewJourney={newJourney} />}
    {page === 'battle' && <>
      <nav className="build-strip" aria-label="快捷构筑">{Object.values(PROTOTYPE_CONTENT.builds).map((preset) => { const available = canEquipBuild(save, preset.id); return <button key={preset.id} type="button" disabled={!available} className={`${preset.id === battle.buildId ? 'is-active' : ''} ${available ? '' : 'is-locked'}`} onClick={() => chooseBuild(preset.id)}><strong>{available ? preset.name : '未解阵谱'}</strong><span>{available ? preset.subtitle : '继续游历以解锁'}</span></button> })}</nav>
      <main className="battle-layout"><aside className="party-panel"><div className="panel-heading"><span>壹</span><div><small>PLAYER FORMATION</small><h2>修士阵</h2></div></div><UnitCard unit={battle.leader} /><div className="spirit-grid">{battle.spirits.map((spirit, index) => <UnitCard key={spirit.id} unit={spirit} bond={battle.spiritBonds[index]} selectable={Boolean(targetingCard && spirit.hp > 0)} onSelect={() => chooseSpiritTarget(spirit.id)} />)}</div>{targetingCard && <p className="target-note">为「{names[targetingCard]}」选择存活妖灵 · Esc 取消</p>}</aside>
        <section className={`battle-table ${campaignSession && campaignSession.stageNumber > 20 ? 'region-roots' : campaignSession && campaignSession.stageNumber > 10 ? 'region-waystation' : ''}`}><div className="scene-vignette" aria-hidden="true" /><div className={`enemy-zone ${battle.enemies.length > 1 ? 'is-group' : ''}`}><p className="zone-label">槐阴异物</p><div className="enemy-card-grid">{battle.enemies.filter((unit) => unit.hp > 0).map((unit, index) => <UnitCard key={`${unit.id}-${index}`} unit={unit} enemy />)}</div></div><div className="battle-meter"><div className="resource-orb sword"><span>剑意</span><strong>{battle.swordIntent}</strong><small>/ {battle.swordIntentCap}</small></div><div className="energy-track"><div className="energy-label"><span>灵力</span><strong>{battle.energy}</strong><small>/ {battle.maxEnergy}</small></div><div className="energy-pips">{Array.from({ length: battle.maxEnergy }, (_, index) => <i key={index} className={index < battle.energy ? 'filled' : ''} />)}</div></div><div className="enemy-resources"><span>符印 <strong>{enemy.talismanMarks}</strong></span><span>灼烧 <strong>{enemy.burnStacks}</strong></span></div><p className={`time-mark ${battle.timeMs >= 60_000 ? 'is-warning' : ''}`}>{(battle.timeMs / 1_000).toFixed(1)} 秒{battle.timeMs >= 150_000 ? ' · 30秒警告' : battle.timeMs >= 60_000 ? ' · 久战' : ''}</p></div><div className="combo-row">{battle.activeCombos.map((id) => <span key={id}>{comboNames[id]}</span>)}</div>
          <div className="hand-zone"><div className="hand-heading"><span>{PROTOTYPE_CONTENT.builds[battle.buildId].name} · {battleContent.weapons[build.weaponId].name}</span><span>手牌 {battle.hand.length}/4</span><span>牌库 {battle.deck.length}</span><span>弃牌 {battle.discard.length}</span></div><div className="hand-cards">{battle.hand.map((cardId) => { const card = battleContent.cards[cardId]; const availability = getCardAvailability(battle, card); const art = card.artKey ? artFiles[card.artKey] : undefined; const unavailable = availability.reason === 'battle_ended' ? '战斗已结束' : availability.reason === 'insufficient_energy' ? '灵力不足' : availability.reason === 'no_living_spirit' ? '无存活妖灵' : undefined; const hint = availability.reason === 'target_required' ? '点击后选择妖灵' : undefined; return <button type="button" key={cardId} className={`hand-card archetype-${card.tags[0]} ${targetingCard === cardId ? 'is-targeting' : ''} ${unavailable ? 'is-unavailable' : ''}`} disabled={Boolean(unavailable)} onClick={() => clickCard(cardId)}><span className="card-cost">{availability.cost}</span><span className="card-kind">{card.kind}</span><strong>{card.name}</strong><span className="card-illustration" aria-hidden="true">{art ? <img src={`${ASSET_ROOT}${art}`} alt="" /> : <i>{card.name.at(0)}</i>}</span><span className="card-text">{card.description}</span>{(unavailable || hint) && <span className="card-unavailable">{unavailable ?? hint}</span>}</button> })}</div></div>{battle.status !== 'active' && <div className={`battle-result ${battle.status}`} role="status"><span>{battle.status === 'victory' ? '破' : '败'}</span><h2>{battle.status === 'victory' ? '试法告捷' : '心脉受创'}</h2><p>{battle.status === 'victory' ? `「${PROTOTYPE_CONTENT.builds[battle.buildId].name}」已证可行。` : '此关未能通过，系统已记录失败原因。'}</p><div className="battle-result-actions"><button type="button" className="result-primary" onClick={settleFinishedBattle}>返回游历并结算</button><button type="button" onClick={() => dispatch({ type: 'restart' })}>重试本关</button></div></div>}
        </section><aside className="intel-panel"><section className="build-summary"><div className="panel-heading compact"><span>贰</span><div><small>ACTIVE BUILD</small><h2>{PROTOTYPE_CONTENT.builds[battle.buildId].name}</h2></div></div><p>{battleContent.weapons[build.weaponId].name} · {battleContent.techniques[build.techniqueId].name}</p><div className="combo-list">{battle.activeCombos.map((id) => <span key={id}>连携 · {comboNames[id]}</span>)}</div></section><section className="priority-panel"><div className="panel-heading compact"><span>叁</span><div><small>AUTO CAST</small><h2>出牌次序</h2></div></div><p className="panel-note">拖动或使用箭头排序。自动模式会跳过灵力不足的牌。</p><PriorityList cardIds={battle.autoplayPriority} onChange={(cardIds) => { dispatch({ type: 'reorder_priority', cardIds }); setSave((current) => ({ ...current, loadout: { ...current.loadout, autoplayPriority: cardIds } })) }} /></section><section className="event-panel" aria-live="polite"><div className="panel-heading compact"><span>肆</span><div><small>BATTLE RECORD</small><h2>斗法录</h2></div></div><ol className="event-list">{[...activeEvents].reverse().slice(0, 10).map((event, index) => { const [time, copy] = formatEvent(event); return <li key={`${event.atMs}-${event.type}-${index}`}><time>{time}s</time><span>{copy}</span></li> })}</ol></section></aside></main>
    </>}
  </div>
}

export default App
