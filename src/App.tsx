import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { COLLECTION_BY_ID } from './content/collection'
import { assetUrl, GAME_ASSETS } from './content/assets'
import { PROTOTYPE_CONTENT } from './content/prototype'
import { getStage, getStageWaveEnemies } from './content/stages'
import { createBattle, getCardAvailability, getCardId, isBattleCardInstance, transitionBattle } from './game/battle'
import { getCombatStats, getDamageBreakdown } from './game/combat-math'
import type { BattleCardInstance, BattleCardReference, BattleCommand, BattleEvent, BattleState, CardId, ComboId, UnitId, UnitState } from './game/types'
import { advanceStageSession, createStageSession, nextCampaignStage, setCampaignMode, settleStage, type PendingOfflineSettlement, type StageSession } from './game/campaign'
import { createTrial, createTrialBattle, createTrialSettlement, resolveTrialBattle, transitionTrial, type TrialCommand, type TrialRun } from './game/trial'
import { attachOfflineSettlement, attachTrialRun, attachTrialSettlement, battleContentFromSave, claimOfflineSettlement, claimTrialSettlement, createPlayerSave, loadPlayerSave, markActive, storePlayerSave, type PlayerSave } from './state/player'
import type { LoadoutChangeResult } from './state/loadout'
import { TravelPage } from './ui/TravelPage'
import type { CharacterCombatPreview } from './ui/CharacterPage'
const CharacterPage = lazy(() => import('./ui/CharacterPage').then((module) => ({ default: module.CharacterPage })))
const TrialPage = lazy(() => import('./ui/TrialPage').then((module) => ({ default: module.TrialPage })))
const BattleScene = lazy(() => import('./ui/BattleScene').then((module) => ({ default: module.BattleScene })))
const CodexPage = lazy(() => import('./ui/CodexPage').then((module) => ({ default: module.CodexPage })))
const SavePage = lazy(() => import('./ui/SavePage').then((module) => ({ default: module.SavePage })))

const INITIAL_SEED = 20_260_827
const ASSET_ROOT = '/assets/pixel/'
const artFiles = Object.fromEntries(Object.entries(GAME_ASSETS).map(([key, asset]) => [key, asset.file]))
const comboNames: Record<ComboId, string> = { flying_sword_seal: '飞剑镇符', spirit_edict: '灵使敕令', dual_spirit_sword: '双灵剑阵' }
const resourceNames = { cultivation: '修为', spiritSand: '灵砂', daoEssence: '道法精华', spiritEssence: '万灵精华', artifactEssence: '器华' }
const names: Record<string, string> = {
  leader: PROTOTYPE_CONTENT.leader.name, burn: '灼烧',
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.spirits).map((item) => [item.id, item.name])),
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.enemyDefinitions).map((item) => [item.id, item.name])),
  ...Object.fromEntries(Object.values(PROTOTYPE_CONTENT.cards).map((item) => [item.id, item.name])),
  ...Object.fromEntries(Object.values(COLLECTION_BY_ID).map((item) => [item.id, item.name])),
}

interface AppState { battle: BattleState; events: BattleEvent[] }
type Page = 'travel' | 'trial' | 'battle' | 'loadout' | 'codex' | 'save'

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
    case 'card_exhausted': return [time, `「${names[event.cardId]}」本战斗耗用。`]
    case 'treasure_used': return [time, `法宝「${event.treasureId}」发动，剩余充能 ${event.remainingCharge}。`]
    case 'consumable_used': return [time, `使用「${event.consumableId}」，剩余 ${event.remainingUses} 次。`]
    case 'damage': return [time, `${names[event.sourceId]}对${names[event.targetId]}造成 ${event.amount} 伤害${event.shieldAbsorbed ? `，护盾抵消 ${event.shieldAbsorbed}` : ''}。`]
    case 'heal': return [time, `${names[event.sourceId]}为${names[event.targetId]}恢复 ${event.amount} 生元。`]
    case 'shield': return [time, `${names[event.sourceId]}为${names[event.targetId]}赋予 ${event.amount} 护盾。`]
    case 'status_changed': { const labels = { sword_intent: '剑意', armor_break: '破甲', talisman_mark: '符印', burn: '灼烧', spirit_bond: '灵契', energy_discount: '减耗' }; return [time, `${event.targetId === 'battle' ? '' : names[event.targetId]}${labels[event.status]}变为 ${event.value}。`] }
    case 'energy_changed': return [time, `灵力变为 ${event.value}。`]
    case 'unit_action': return [time, `${names[event.unitId]}发动「${event.action}」。`]
    case 'unit_summoned': return [time, `${names[event.sourceId]}召来${names[event.unitId]}。`]
    case 'enemy_buff': return [time, `${names[event.targetId]}的${event.status === 'attack' ? '攻势' : '适应护盾'}调整为 ${event.value}。`]
    case 'wave_started': return [time, `第 ${event.waveNumber} 波来袭。`]
    case 'battle_timeout': return [time, '斗法久持不下，判定失败。']
    case 'boss_phase_changed': return [time, `槐姥进入「${event.phase === 'rooted' ? '盘根' : event.phase === 'reflection' ? '摄魄' : '槐劫'}」。`]
    case 'combo_triggered': return [time, `连携「${comboNames[event.comboId]}」触发。`]
    case 'battle_ended': return [time, event.result === 'victory' ? '泥胎崩裂，试法告捷。' : '心脉俱损，试法失败。']
    case 'message': return [time, event.text]
  }
}

function ResourceBar({ save }: { save: PlayerSave }) {
  return <div className="resource-bar">{Object.entries(save.resources).map(([key, value]) => <span key={key}><small>{resourceNames[key as keyof typeof resourceNames]}</small><strong>{value}</strong></span>)}</div>
}

function App() {
  const [save, setSave] = useState(loadPlayerSave)
  const [page, setPage] = useState<Page>(() => save.trialRun || save.pendingTrialSettlement ? 'trial' : 'travel')
  const [app, setApp] = useState<AppState>(() => ({ battle: createBattle(INITIAL_SEED, battleContentFromSave(save), save.loadout.buildId), events: [{ type: 'battle_started', seed: INITIAL_SEED, buildId: save.loadout.buildId, atMs: 0 }] }))
  const [campaignSession, setCampaignSession] = useState<StageSession>()
  const [visible, setVisible] = useState(() => !document.hidden)
  const [offlineBusy, setOfflineBusy] = useState(false)
  const [offlineError, setOfflineError] = useState<string>()
  const [speed, setSpeed] = useState(1)
  const [targetingCard, setTargetingCard] = useState<CardId>()
  const [targetingInstanceId, setTargetingInstanceId] = useState<string>()
  const [trialRun, setTrialRun] = useState<TrialRun | undefined>(() => save.trialRun)
  const [trialBattle, setTrialBattle] = useState<BattleState<BattleCardInstance>>()
  const [trialEvents, setTrialEvents] = useState<BattleEvent[]>([])
  const [trialError, setTrialError] = useState<string>()
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const battleContent = useMemo(() => battleContentFromSave(save), [save])
  const saveRef = useRef(save)
  const characterChangedRef = useRef(false)
  const characterRestartStageRef = useRef<number | undefined>(undefined)

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
    if (!visible || offlineBusy || campaignSession || trialRun || save.trialRun || save.pendingTrialSettlement || save.campaign.mode === 'paused' || save.campaign.pendingOfflineSettlement) return
    const timer = window.setTimeout(() => setCampaignSession(createStageSession(save, nextCampaignStage(save))), 0)
    return () => window.clearTimeout(timer)
  }, [campaignSession, offlineBusy, save, trialRun, visible])
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
    if (trialBattle) {
      setTrialBattle((current) => {
        if (!current) return current
        const result = transitionBattle(current, command, battleContent)
        setTrialEvents((events) => [...events, ...result.events])
        return result.state
      })
      return
    }
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
  }, [battleContent, campaignSession, save, trialBattle])
  useEffect(() => { if (!trialBattle || trialBattle.status !== 'active' || page !== 'battle') return; const timer = window.setInterval(() => dispatch({ type: 'advance', elapsedMs: 250 * speed }), 250); return () => window.clearInterval(timer) }, [dispatch, page, speed, trialBattle])
  useEffect(() => { if (campaignSession || trialBattle || app.battle.status !== 'active' || page !== 'battle') return; const timer = window.setInterval(() => dispatch({ type: 'advance', elapsedMs: 250 * speed }), 250); return () => window.clearInterval(timer) }, [app.battle.status, campaignSession, dispatch, page, speed, trialBattle])
  useEffect(() => { if (!targetingCard) return; const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') { setTargetingCard(undefined); setTargetingInstanceId(undefined) } }; window.addEventListener('keydown', cancel); return () => window.removeEventListener('keydown', cancel) }, [targetingCard])
  useEffect(() => { const media = window.matchMedia?.('(prefers-reduced-motion: reduce)'); if (!media) return; const onChange = () => setReducedMotion(media.matches); media.addEventListener?.('change', onChange); return () => media.removeEventListener?.('change', onChange) }, [])

  const settleFinishedBattle = () => {
    if (campaignSession && campaignSession.status !== 'active') {
      setSave((current) => markActive(settleStage(current, campaignSession), Date.now()))
      setCampaignSession(undefined)
    }
    setTargetingCard(undefined)
    setPage('travel')
  }
  const persistTrial = (next: TrialRun) => { setTrialRun(next); setSave((current) => attachTrialRun(current, next)) }
  const beginTrial = () => {
    if (save.pendingTrialSettlement && !trialRun && !save.trialRun) { setPage('trial'); return }
    const next = trialRun ?? save.trialRun ?? createTrial(save.campaign.campaignSeed + save.campaign.battleSequence * 1_009, save)
    persistTrial(next)
    setTrialError(undefined)
    setPage('trial')
  }
  const startTrialBattle = () => {
    if (!trialRun || trialRun.pending?.kind !== 'battle') return
    setTrialBattle(createTrialBattle(trialRun, save))
    setTrialEvents([])
    setTrialError(undefined)
    setPage('battle')
  }
  const settleTrialBattle = () => {
    if (!trialRun || !trialBattle || trialBattle.status === 'active') return
    const result = resolveTrialBattle(trialRun, trialBattle, trialEvents)
    setTrialBattle(undefined)
    setTrialEvents([])
    setTrialError(result.error)
    if (result.error) return
    if (result.run.status === 'active') persistTrial(result.run)
    else { setTrialRun(undefined); setSave((current) => attachTrialSettlement(current, createTrialSettlement(result.run))) }
    setPage('trial')
  }
  const applyTrialCommand = (command: TrialCommand) => {
    if (!trialRun) return
    const result = transitionTrial(trialRun, command)
    if (result.error) { setTrialError(result.error); return }
    setTrialError(undefined)
    if (result.run.status === 'active') persistTrial(result.run)
    else { setTrialRun(undefined); setSave((current) => attachTrialSettlement(current, createTrialSettlement(result.run))) }
  }
  const retreatTrial = () => {
    if (!trialRun) return
    const result = transitionTrial(trialRun, { type: 'retreat' })
    if (result.error) { setTrialError(result.error); return }
    setTrialRun(undefined)
    setSave((current) => attachTrialSettlement(current, createTrialSettlement(result.run, 'retreat')))
    setTrialError(undefined)
  }
  const claimTrial = () => { setSave((current) => claimTrialSettlement(current, Date.now())); setTrialRun(undefined); setTrialError(undefined); setPage('travel') }
  const openCharacter = () => { characterChangedRef.current = false; characterRestartStageRef.current = campaignSession?.stageNumber; if (!trialRun && !trialBattle && !save.pendingTrialSettlement) setSave((current) => setCampaignMode(current, 'paused')); setPage('loadout') }
  const handleCharacterChange = (result: LoadoutChangeResult) => {
    if (!result.changed) return
    if (!trialRun && !trialBattle && !characterChangedRef.current) { characterChangedRef.current = true; setCampaignSession(undefined) }
    setSave({ ...result.save, campaign: { ...result.save.campaign, mode: trialRun || trialBattle ? result.save.campaign.mode : 'paused' } })
  }
  const startBattle = (stageNumber = characterRestartStageRef.current ?? nextCampaignStage(save)) => { if (trialBattle) return; characterRestartStageRef.current = undefined; if (!campaignSession || campaignSession.stageNumber !== stageNumber || campaignSession.status !== 'active') setCampaignSession(createStageSession(save, stageNumber)); setSave((current) => current.campaign.mode === 'paused' ? setCampaignMode(current, 'advance') : current); setTargetingCard(undefined); setTargetingInstanceId(undefined); setPage('battle') }
  const retryBlocked = (stageNumber: number) => { if (trialBattle) return; const next = setCampaignMode(save, 'advance'); setSave(next); setCampaignSession(createStageSession(next, stageNumber)); setTargetingCard(undefined); setTargetingInstanceId(undefined); setPage('battle') }
  const changeMode = (mode: PlayerSave['campaign']['mode']) => { setCampaignSession(undefined); setSave((current) => setCampaignMode(current, mode)) }
  const navigate = (nextPage: Page) => { if (trialBattle && nextPage !== 'battle') { if (trialBattle.status !== 'active') settleTrialBattle(); return } if (nextPage === 'loadout') { openCharacter(); return } if (nextPage !== 'battle' && campaignSession && !campaignSession.battle.autoplay) dispatch({ type: 'set_autoplay', enabled: true }); if (nextPage !== 'battle' && campaignSession?.status !== 'active') settleFinishedBattle(); setPage(nextPage) }
  const newJourney = () => { const next = createPlayerSave(Date.now()); setSave(next); setCampaignSession(undefined); setTrialRun(undefined); setTrialBattle(undefined); setApp({ battle: createBattle(INITIAL_SEED, battleContentFromSave(next), next.loadout.buildId), events: [] }); setPage('travel') }
  const battle = trialBattle ?? campaignSession?.battle ?? app.battle
  const activeEvents: BattleEvent[] = trialBattle ? trialEvents : campaignSession?.events ?? app.events
  const build = battleContent.builds[battle.buildId]
  const enemy = battle.enemies.find((unit) => unit.hp > 0) ?? battle.enemies[0]
  const previewStageNumber = Math.min(30, Math.max(1, campaignSession?.stageNumber ?? nextCampaignStage(save)))
  const previewStage = getStage(previewStageNumber)
  const previewEnemy = previewStage ? getStageWaveEnemies(previewStage, 0)[0] : undefined
  const previewStats = getCombatStats(battleContent, save.loadout.buildId, previewEnemy ? { defense: previewEnemy.defense } : undefined)
  const cardPreviews = Object.fromEntries(save.loadout.cardIds.flatMap((cardId) => {
    const card = battleContent.cards[cardId]
    if (card?.powerPercent === undefined) return []
    const breakdown = getDamageBreakdown({ attack: battleContent.leader.attack, powerPercent: card.powerPercent, defense: previewEnemy?.defense ?? 0, hits: card.hits })
    return [[cardId, { powerPercent: card.powerPercent, hits: breakdown.hits, damagePerHit: breakdown.damagePerHit, totalDamage: breakdown.totalDamage }]]
  }))
  const characterPreview: CharacterCombatPreview = {
    targetName: previewEnemy?.name,
    basicAttackDamage: previewStats.basicAttack.damagePerHit,
    basicAttackDps: Number(previewStats.basicAttackDps.toFixed(1)),
    combatPower: previewStats.basePower,
    cardPreviews,
  }
  const finishBattle = trialBattle ? settleTrialBattle : settleFinishedBattle
  const battleBackgroundUrl = trialBattle ? assetUrl('bg_huaiyin_roots')! : campaignSession && campaignSession.stageNumber > 20 ? assetUrl('bg_huaiyin_roots')! : campaignSession && campaignSession.stageNumber > 10 ? assetUrl('bg_huaiyin_waystation')! : assetUrl('bg_huaiyin_road')!
  const clickCard = (cardId: CardId, instanceId?: string) => { setTargetingInstanceId(instanceId); if (battleContent.cards[cardId].targetRule === 'chosen_spirit') setTargetingCard(cardId); else dispatch({ type: 'play_card', cardId, cardInstanceId: instanceId }) }
  const chooseSpiritTarget = (targetId: UnitId) => { if (!targetingCard) return; dispatch({ type: 'play_card', cardId: targetingCard, cardInstanceId: targetingInstanceId, targetId }); setTargetingCard(undefined); setTargetingInstanceId(undefined) }

  return <div className="game-shell">
    <header className="topbar"><div className="brand-lockup"><span className="brand-seal" aria-hidden="true">問</span><div><p>槐阴古道 · 炼气试演</p><h1>山海问道</h1></div></div><nav className="main-nav" aria-label="主要页面">{([['travel', '游历'], ...(save.campaign.trialUnlocked || trialRun || save.pendingTrialSettlement ? [['trial', '劫境'] as [Page, string]] : []), ['battle', '斗法'], ['loadout', '角色'], ['codex', '图鉴'], ['save', '存档']] as [Page, string][]).map(([id, label]) => <button type="button" key={id} className={page === id ? 'is-active' : ''} onClick={() => navigate(id)}>{label}</button>)}</nav>{page === 'battle' && <div className="battle-controls"><span className="seed-mark">{trialBattle ? `劫境 · ${trialRun?.battleSequence ?? 0} 战` : campaignSession ? `第 ${campaignSession.stageNumber} 关 · ${campaignSession.waveIndex + 1} 波` : `劫数 ${battle.seed}`}</span><div className="speed-control" aria-label="战斗速度">{[1, 2, 4].map((value) => <button key={value} type="button" className={speed === value ? 'is-active' : ''} onClick={() => setSpeed(value)}>{value}×</button>)}</div><button type="button" className={battle.autoplay ? 'autoplay is-active' : 'autoplay'} onClick={() => dispatch({ type: 'set_autoplay', enabled: !battle.autoplay })}>{battle.autoplay ? '自动 · 开' : '自动 · 关'}</button><button type="button" className="restart" onClick={() => dispatch({ type: 'restart' })}>重演此关</button></div>}</header>
    <ResourceBar save={save} />
    {page === 'travel' && <TravelPage save={save} session={campaignSession} offlineBusy={offlineBusy} offlineError={offlineError} onSetMode={changeMode} onEnterBattle={startBattle} onRetryBlocked={retryBlocked} onEnterTrial={beginTrial} onClaimOffline={() => setSave((current) => claimOfflineSettlement(current, Date.now()))} onOpenLoadout={openCharacter} onRetryOffline={() => { setOfflineError(undefined); setSave((current) => markActive(current, Date.now())) }} />}
    {page === 'trial' && <Suspense fallback={<main className="paper-page"><p>正在展开劫境卷轴……</p></main>}><TrialPage save={save} run={trialRun ?? save.trialRun} pendingSettlement={save.pendingTrialSettlement} error={trialError} onStart={beginTrial} onMove={(tileId) => applyTrialCommand({ type: 'move', tileId })} onChoose={(optionId, targetCardInstanceId) => applyTrialCommand({ type: 'choose', optionId, targetCardInstanceId })} onStartBattle={startTrialBattle} onRetreat={retreatTrial} onClaim={claimTrial} /></Suspense>}
    {page === 'loadout' && <Suspense fallback={<main className="paper-page"><p>正在展开角色行囊……</p></main>}><CharacterPage save={save} combatPreview={characterPreview} readOnly={Boolean(trialRun || trialBattle || save.pendingTrialSettlement || save.campaign.pendingOfflineSettlement)} readOnlyReason={save.campaign.pendingOfflineSettlement ? '离线报告待领取，领取前暂不可调整角色。' : undefined} onSaveChange={handleCharacterChange} onEnterBattle={startBattle} /></Suspense>}
    {page === 'codex' && <Suspense fallback={<main className="paper-page"><p>正在翻阅图鉴……</p></main>}><CodexPage save={save} setSave={setSave} /></Suspense>}
    {page === 'save' && <Suspense fallback={<main className="paper-page"><p>正在打开存档卷轴……</p></main>}><SavePage save={save} setSave={(next) => { setSave(next); setCampaignSession(undefined); setTrialRun(next.trialRun); setTrialBattle(undefined); setPage(next.trialRun || next.pendingTrialSettlement ? 'trial' : 'travel') }} onNewJourney={newJourney} /></Suspense>}
    {page === 'battle' && <>
      <main className="battle-layout"><aside className="party-panel"><div className="panel-heading"><span>壹</span><div><small>PLAYER FORMATION</small><h2>修士阵</h2></div></div><UnitCard unit={battle.leader} /><div className="spirit-grid">{battle.spirits.map((spirit, index) => <UnitCard key={spirit.id} unit={spirit} bond={battle.spiritBonds[index]} selectable={Boolean(targetingCard && spirit.hp > 0)} onSelect={() => chooseSpiritTarget(spirit.id)} />)}</div>{targetingCard && <p className="target-note">为「{names[targetingCard]}」选择存活妖灵 · Esc 取消</p>}</aside>
        <section className={`battle-table ${campaignSession && campaignSession.stageNumber > 20 ? 'region-roots' : campaignSession && campaignSession.stageNumber > 10 ? 'region-waystation' : ''}`}><Suspense fallback={<div className="battle-scene-loading" role="status">正在铺开斗法场景……</div>}><BattleScene battle={battle as BattleState<BattleCardReference>} events={activeEvents} backgroundUrl={battleBackgroundUrl} reducedMotion={reducedMotion} /></Suspense><div className="scene-vignette" aria-hidden="true" /><div className={`enemy-zone ${battle.enemies.length > 1 ? 'is-group' : ''}`}><p className="zone-label">槐阴异物</p><div className="enemy-card-grid">{battle.enemies.filter((unit) => unit.hp > 0).map((unit, index) => <UnitCard key={`${unit.id}-${index}`} unit={unit} enemy />)}</div></div><div className="battle-meter"><div className="resource-orb sword"><span>剑意</span><strong>{battle.swordIntent}</strong><small>/ {battle.swordIntentCap}</small></div><div className="energy-track"><div className="energy-label"><span>灵力</span><strong>{battle.energy}</strong><small>/ {battle.maxEnergy}</small></div><div className="energy-pips">{Array.from({ length: battle.maxEnergy }, (_, index) => <i key={index} className={index < battle.energy ? 'filled' : ''} />)}</div></div><div className="enemy-resources"><span>符印 <strong>{enemy.talismanMarks}</strong></span><span>灼烧 <strong>{enemy.burnStacks}</strong></span></div><p className={`time-mark ${battle.timeMs >= 60_000 ? 'is-warning' : ''}`}>{(battle.timeMs / 1_000).toFixed(1)} 秒{battle.timeMs >= 150_000 ? ' · 30秒警告' : battle.timeMs >= 60_000 ? ' · 久战' : ''}</p><div className="battle-items">{battle.treasureId && <button type="button" disabled={battle.status !== 'active' || battle.treasureCharge < battle.treasureMaxCharge} onClick={() => dispatch({ type: 'use_treasure', treasureId: battle.treasureId })}>法宝 {battle.treasureCharge}/{battle.treasureMaxCharge}</button>}{Object.entries(battle.consumableUses).map(([id, uses], index) => <button type="button" key={id} disabled={battle.status !== 'active' || uses <= 0} onClick={() => dispatch({ type: 'use_consumable', consumableId: id, slot: index })}>{COLLECTION_BY_ID[id]?.name ?? id} {uses}</button>)}</div></div><div className="combo-row">{battle.activeCombos.map((id) => <span key={id}>{comboNames[id]}</span>)}</div>
          <div className="hand-zone"><div className="hand-heading"><span>{PROTOTYPE_CONTENT.builds[battle.buildId].name} · {battleContent.weapons[build.weaponId].name}</span><span>手牌 {battle.hand.length}/4</span><span>牌库 {battle.deck.length}</span><span>弃牌 {battle.discard.length}</span></div><div className="hand-cards">{battle.hand.map((cardRef) => { const cardId = getCardId(cardRef); const instanceId = isBattleCardInstance(cardRef) ? cardRef.instanceId : undefined; const card = battleContent.cards[cardId]; const availability = getCardAvailability(battle, card, undefined, false, cardRef); const art = card.artKey ? artFiles[card.artKey] : undefined; const unavailable = availability.reason === 'battle_ended' ? '战斗已结束' : availability.reason === 'insufficient_energy' ? '灵力不足' : availability.reason === 'no_living_spirit' ? '无存活妖灵' : undefined; const hint = availability.reason === 'target_required' ? '点击后选择妖灵' : undefined; const previewDamage = card.powerPercent === undefined || card.effectId === 'spirit_basic_attacks' || card.effectId === 'spirit_tide' ? undefined : getDamageBreakdown({ attack: battle.leader.attack, powerPercent: card.powerPercent, defense: enemy?.defense ?? 0, armorBreak: enemy?.armorBreak, hits: card.hits }); return <button type="button" key={instanceId ?? cardId} className={`hand-card archetype-${card.tags[0]} ${targetingCard === cardId && targetingInstanceId === instanceId ? 'is-targeting' : ''} ${unavailable ? 'is-unavailable' : ''}`} disabled={Boolean(unavailable)} onClick={() => clickCard(cardId, instanceId)}><span className="card-cost">{availability.cost}</span><span className="card-kind">{card.kind}</span><strong>{card.name}</strong><span className="card-illustration" aria-hidden="true">{art ? <img src={`${ASSET_ROOT}${art}`} alt="" /> : <i>{card.name.at(0)}</i>}</span><span className="card-text">{card.description}</span>{previewDamage && <span className="card-preview-value">基础伤害 {previewDamage.damagePerHit} × {previewDamage.hits} = {previewDamage.totalDamage}</span>}{(unavailable || hint) && <span className="card-unavailable">{unavailable ?? hint}</span>}</button> })}</div></div>{battle.status !== 'active' && <div className={`battle-result ${battle.status}`} role="status"><span>{battle.status === 'victory' ? '破' : '败'}</span><h2>{battle.status === 'victory' ? '试法告捷' : '心脉受创'}</h2><p>{trialBattle ? '劫境战斗已结束，返回地图结算本格。' : battle.status === 'victory' ? `「${PROTOTYPE_CONTENT.builds[battle.buildId].name}」已证可行。` : '此关未能通过，系统已记录失败原因。'}</p><div className="battle-result-actions"><button type="button" className="result-primary" onClick={finishBattle}>{trialBattle ? '返回劫境并结算' : '返回游历并结算'}</button><button type="button" onClick={() => dispatch({ type: 'restart' })}>重试本关</button></div></div>}
        </section><aside className="intel-panel"><section className="build-summary"><div className="panel-heading compact"><span>贰</span><div><small>ACTIVE BUILD</small><h2>{PROTOTYPE_CONTENT.builds[battle.buildId].name}</h2></div></div><p>{battleContent.weapons[build.weaponId].name} · {battleContent.techniques[build.techniqueId].name}</p><div className="combo-list">{battle.activeCombos.map((id) => <span key={id}>连携 · {comboNames[id]}</span>)}</div></section><section className="priority-panel"><div className="panel-heading compact"><span>叁</span><div><small>AUTO CAST</small><h2>出牌次序</h2></div></div><p className="panel-note">自动优先级已集中到角色页；斗法中保持当前规则不变。</p><ol className="priority-readonly" aria-label="当前自动出牌优先级">{battle.autoplayPriority.map((cardId, index) => <li key={cardId}><span>{index + 1}</span>{names[cardId]}</li>)}</ol><button type="button" className="open-character-button" onClick={openCharacter}>前往角色页调整</button></section><section className="event-panel" aria-live="polite"><div className="panel-heading compact"><span>肆</span><div><small>BATTLE RECORD</small><h2>斗法录</h2></div></div><ol className="event-list">{(activeEvents ?? []).slice().reverse().slice(0, 10).map((event, index) => { const [time, copy] = formatEvent(event); return <li key={`${event.atMs}-${event.type}-${index}`}><time>{time}s</time><span>{copy}</span></li> })}</ol></section></aside></main>
    </>}
  </div>
}

export default App
