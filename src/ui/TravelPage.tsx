import { useEffect, useState } from 'react'
import { COLLECTION_BY_ID } from '../content/collection'
import { assetUrl } from '../content/assets'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import { CHAPTERS, getChapter, getChapterForStage, getStage, type ChapterId } from '../content/stages'
import { getEntityDetail } from '../content/details'
import type { BattleReport, CampaignProgress, StageSession } from '../game/campaign'
import type { PlayerSave } from '../state/player'
import { ChapterMapScene } from './ChapterMapScene'
import './TravelPage.css'

export interface TravelPageProps {
  save: PlayerSave
  session?: StageSession
  offlineBusy: boolean
  offlineError?: string
  onSetMode: (mode: CampaignProgress['mode']) => void
  onEnterBattle: (stageNumber: number) => void
  onRetryBlocked: (stageNumber: number) => void
  onEnterTrial: () => void
  onClaimOffline: () => void
  onOpenLoadout: () => void
  onRetryOffline: () => void
}

const MODE_NAMES: Record<CampaignProgress['mode'], string> = {
  advance: '自动推进',
  farm: '稳定刷取',
  paused: '已暂停',
}

const RESOURCE_NAMES = {
  cultivation: '修为',
  spiritSand: '灵砂',
  daoEssence: '道法精华',
  spiritEssence: '万灵精华',
  artifactEssence: '器华',
} as const

const DISPLAY_NAMES: Record<string, string> = Object.fromEntries([
  ['leader', PROTOTYPE_CONTENT.leader.name],
  ...Object.values(PROTOTYPE_CONTENT.spirits).map((unit) => [unit.id, unit.name]),
  ...Object.values(PROTOTYPE_CONTENT.enemyDefinitions).map((unit) => [unit.id, unit.name]),
  ...Object.values(PROTOTYPE_CONTENT.cards).map((card) => [card.id, card.name]),
  ...Object.values(COLLECTION_BY_ID).map((item) => [item.id, item.name]),
])

function displayName(id: string) { return DISPLAY_NAMES[id] ?? id }
function readableReason(reason: string | undefined) {
  if (!reason) return undefined
  return Object.entries(DISPLAY_NAMES).reduce((text, [id, name]) => text.replaceAll(id, name), reason)
}
function stageLabel(stageNumber: number) { return String(stageNumber).padStart(2, '0') }
function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1_000)
  if (totalSeconds < 60) return `${totalSeconds} 秒`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`
}
function total(entries: Record<string, number>) { return Object.values(entries).reduce((sum, value) => sum + value, 0) }
function topEntries(entries: Record<string, number>) { return Object.entries(entries).sort(([, a], [, b]) => b - a).slice(0, 3) }
function ContributionList({ label, entries, unit }: { label: string; entries: Record<string, number>; unit: string }) {
  const rows = topEntries(entries)
  return <div className="travel-contribution">
    <div className="travel-contribution-heading"><span>{label}</span><strong>{total(entries)}{unit}</strong></div>
    {rows.length ? <ul>{rows.map(([id, value]) => <li key={id}><span>{displayName(id)}</span><strong>{value}{unit}</strong></li>)}</ul> : <p className="travel-empty">暂无记录</p>}
  </div>
}

function EnemyPreview({ enemyId, unit }: { enemyId: string; unit?: { name: string; title: string; maxHp: number; hp?: number; attack: number; defense: number; artKey?: string } }) {
  const name = unit?.name ?? displayName(enemyId)
  const artKey = unit?.artKey
  const file = artKey ? assetUrl(artKey) : undefined
  return <li className="travel-enemy">
    <div className="travel-enemy-art" aria-hidden="true"><span>{name.slice(0, 1)}</span>{file && <img src={file} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</div>
    <div className="travel-enemy-copy"><strong>{name}</strong><small>{unit?.title ?? '古道异物'}</small><span>{unit?.hp !== undefined ? `生元 ${unit.hp}/${unit.maxHp}` : `生元 ${unit?.maxHp ?? '未探'}`} · 攻势 {unit?.attack ?? '—'}</span></div>
  </li>
}

function LatestReport({ report }: { report?: BattleReport }) {
  if (!report) return <section className="travel-card travel-report-card"><header><div><small>LAST RECORD</small><h2>最近战报</h2></div><span className="travel-status muted">尚无战报</span></header><p className="travel-empty travel-report-empty">踏上第一段古道后，战报会在此留下。</p></section>
  return <section className="travel-card travel-report-card"><header><div><small>LAST RECORD</small><h2>最近战报</h2></div><span className={`travel-status ${report.result}`}>{report.result === 'victory' ? '告捷' : '败退'}</span></header>
    <div className="travel-report-meta"><span>持续 {formatDuration(report.durationMs)}</span><span>{readableReason(report.failureReason) ?? '战斗完成'}</span></div>
    <div className="travel-report-grid"><ContributionList label="伤害" entries={report.damageBySource} unit="" /><ContributionList label="治疗" entries={report.healingBySource} unit="" /><ContributionList label="护盾" entries={report.shieldBySource} unit="" /></div>
  </section>
}

export function TravelPage({ save, session, offlineBusy, offlineError, onSetMode, onEnterBattle, onRetryBlocked, onEnterTrial, onClaimOffline, onOpenLoadout, onRetryOffline }: TravelPageProps) {
  const { campaign } = save
  const activeStage = session?.stageNumber ?? (campaign.mode === 'farm' ? Math.max(1, campaign.stableStage) : Math.min(30, campaign.highestClearedStage + 1))
  const [selectedStageNumber, setSelectedStageNumber] = useState<number>()
  const [chapterId, setChapterId] = useState<ChapterId>(() => getChapterForStage(activeStage).id)
  const [chapterPinned, setChapterPinned] = useState(false)
  const [dismissedOfflineReportId, setDismissedOfflineReportId] = useState<string>()
  const pending = campaign.pendingOfflineSettlement
  const pendingReportId = pending?.reportId
  const offlineOpen = Boolean(pendingReportId && dismissedOfflineReportId !== pendingReportId)

  useEffect(() => {
    if (!offlineOpen || !pendingReportId) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setDismissedOfflineReportId(pendingReportId) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [offlineOpen, pendingReportId])

  const activeChapter = getChapterForStage(activeStage)
  const requestedChapter = getChapter(chapterId)
  const chapter = !chapterPinned ? activeChapter : campaign.highestClearedStage >= requestedChapter.unlockAfterStage ? requestedChapter : activeChapter
  const selectedInChapter = selectedStageNumber !== undefined && selectedStageNumber >= chapter.startStage && selectedStageNumber <= chapter.endStage
  const selectedStage = getStage(selectedInChapter ? selectedStageNumber : activeStage >= chapter.startStage && activeStage <= chapter.endStage ? activeStage : chapter.startStage)
  const currentStage = getStage(activeStage)
  const selectedIsCurrent = selectedStage.stageNumber === currentStage.stageNumber
  const currentWaveIndex = selectedIsCurrent && session ? Math.min(session.waveIndex, currentStage.waves.length - 1) : 0
  const currentWave = selectedStage.waves[selectedIsCurrent ? currentWaveIndex : 0]
  const battleEnemies = selectedIsCurrent && session ? session.battle.enemies : []
  const stageDetail = getEntityDetail(selectedStage.id, save)
  const sessionIsCurrent = selectedIsCurrent && session?.stageNumber === currentStage.stageNumber
  const blocked = campaign.lastFailure
  const farmHint = !blocked && campaign.mode === 'farm' && campaign.stableStage > 0 ? { stageNumber: Math.min(30, campaign.stableStage + 1), fallbackStage: campaign.stableStage } : undefined
  const controlsLocked = offlineBusy || Boolean(pending)
  const battleWarning = sessionIsCurrent && session && session.battle.timeMs >= 60_000 ? session.battle.timeMs >= 150_000 ? '输出不足，再过 30 秒将判定本波失败。' : '久战未决，建议接管斗法或调整构筑。' : undefined

  return <main className="travel-page" aria-labelledby="travel-page-title">
    <header className="travel-heading">
      <div><span className="travel-kicker">THE WANDERING REGISTER · 槐阴古道</span><h1 id="travel-page-title">游历</h1><p>沿着旧驿留下的墨线前行，修为与传闻会替你记住每一步。</p></div>
      <div className="travel-heading-stats" aria-label="游历进度"><div><small>最高通关</small><strong>{stageLabel(campaign.highestClearedStage)} <i>/ 30</i></strong></div><div><small>稳定关</small><strong>{campaign.stableStage ? stageLabel(campaign.stableStage) : '—'}</strong></div><span className={`travel-mode mode-${campaign.mode}`}>{pending ? '等待领取' : offlineBusy ? '正在推演' : MODE_NAMES[campaign.mode]}</span></div>
    </header>

    {blocked && <section className="travel-blocker" role="alert"><div><strong>推进受阻：第 {stageLabel(blocked.stageNumber)} 关未能通过</strong><p>{readableReason(blocked.reason)} 已转至第 {blocked.fallbackStage ? stageLabel(blocked.fallbackStage) : '01'} 关稳定刷取；稳定关不会自动跳到下一关。</p></div><div className="travel-blocker-actions"><button type="button" disabled={controlsLocked} onClick={onOpenLoadout}>调整构筑</button><button type="button" disabled={controlsLocked} onClick={() => onRetryBlocked(blocked.stageNumber)}>重新挑战</button></div></section>}
    {farmHint && <section className="travel-blocker travel-farm-hint" role="status"><div><strong>当前正在刷取第 {stageLabel(farmHint.fallbackStage)} 关稳定关</strong><p>稳定刷取不会自动进入下一关；准备好后可继续推进第 {stageLabel(farmHint.stageNumber)} 关。</p></div><div className="travel-blocker-actions"><button type="button" disabled={controlsLocked} onClick={() => onRetryBlocked(farmHint.stageNumber)}>继续推进</button></div></section>}
    {offlineBusy && <p className="travel-state-banner" role="status" aria-live="polite">正在推演离线游历，推进与模式切换暂时锁定……</p>}
    {offlineError && <p className="travel-state-banner is-error" role="alert">{offlineError} <button type="button" onClick={onRetryOffline}>我知道了</button></p>}
    {pending && <p className="travel-state-banner is-pending" role="status">离线报告待领取，领取前游历暂停。可先查看报告，再确认结算。</p>}

    <div className="travel-overview">
      <ChapterMapScene chapter={chapter} highestClearedStage={campaign.highestClearedStage} activeStage={activeStage} selectedStage={selectedStage.stageNumber} onSelectStage={setSelectedStageNumber} onChapterChange={(nextId) => { const next = CHAPTERS.find((candidate) => candidate.id === nextId); if (next) { setChapterPinned(true); setChapterId(next.id); setSelectedStageNumber(next.startStage) } }} />

      <aside className="travel-sidebar" aria-label="游历情报">
        <section className="travel-card travel-current-card"><header><div><small>{selectedIsCurrent ? 'CURRENT ROUTE' : 'INSPECTING NODE'}</small><h2>{selectedIsCurrent ? '正在游历' : '关卡情报'}</h2></div><span className={`travel-status ${pending ? 'paused' : campaign.mode}`}>{pending ? '等待领取' : offlineBusy ? '正在推演' : MODE_NAMES[campaign.mode]}</span></header><div className="travel-stage-title"><span>{stageLabel(selectedStage.stageNumber)}</span><div><h3>{selectedStage.name}</h3><p>{selectedStage.regionId === 'mist_road' ? '雾路' : selectedStage.regionId === 'ruined_waystation' ? '废驿' : '槐根深处'} · 推荐 {selectedStage.recommendedTags.map((tag) => tag === 'sword' ? '剑意' : tag === 'talisman' ? '符咒' : '御灵').join(' / ')}{selectedIsCurrent ? '' : ` · 当前推进第 ${stageLabel(currentStage.stageNumber)} 关`}</p></div></div><div className="travel-stage-facts"><span><small>波次</small><strong>{selectedIsCurrent && session ? currentWaveIndex + 1 : 1} <i>/ {selectedStage.waves.length}</i></strong></span><span><small>稳定关</small><strong>{campaign.stableStage ? stageLabel(campaign.stableStage) : '待定'}</strong></span><span><small>境界</small><strong>{selectedStage.isRealmGate ? '劫境门' : '炼气'}</strong></span></div>{stageDetail && <div className="travel-stage-rules">{stageDetail.mechanics.map((entry, index) => <p key={`${entry.label}-${index}`}><strong>{entry.label}</strong>{entry.value}</p>)}</div>}{battleWarning && <p className="travel-battle-warning" role="status">{battleWarning}</p>}<div className="travel-action-row"><button type="button" className="travel-action-primary" disabled={controlsLocked} onClick={() => onEnterBattle(currentStage.stageNumber)}>{sessionIsCurrent ? '接管斗法' : selectedIsCurrent ? '进入当前关' : `回到第 ${stageLabel(currentStage.stageNumber)} 关`}</button>{campaign.mode === 'paused' ? <button type="button" disabled={controlsLocked} onClick={() => onSetMode('advance')}>继续推进</button> : <button type="button" disabled={controlsLocked} onClick={() => onSetMode('paused')}>暂停推进</button>}<button type="button" disabled={controlsLocked || !campaign.stableStage} className={campaign.mode === 'farm' ? 'is-selected' : ''} onClick={() => onSetMode('farm')}>刷稳定关</button></div>{campaign.trialUnlocked && <div className="travel-gate-note"><img src="/assets/pixel/boss-ancient-huai-matriarch.png" alt="千年槐姥剪影" /><p>槐阴劫境已解锁：千年槐姥仍在根下等待。</p><button type="button" disabled={controlsLocked} onClick={onEnterTrial}>进入槐阴劫境</button></div>}</section>

        <section className="travel-card travel-wave-card"><header><div><small>ENCOUNTER PREVIEW</small><h2>此处异物</h2></div><span className="travel-wave-label">第 {currentWaveIndex + 1} 波</span></header><ul className="travel-enemy-list">{currentWave.map((enemyId, index) => <EnemyPreview key={`${enemyId}-${index}`} enemyId={enemyId} unit={battleEnemies[index]} />)}</ul><p className="travel-wave-note">{sessionIsCurrent ? `已运行 ${formatDuration(session.battle.timeMs)}，实时战况可接管。` : selectedIsCurrent ? '选择进入斗法可暂时接管自动出牌。' : '此节点仅供查看，不会改变当前推进关。'}</p></section>

        <LatestReport report={campaign.latestReport} />
        {pending && <button type="button" className="travel-pending-button" onClick={() => setDismissedOfflineReportId(undefined)}><span>卷轴待阅</span><strong>离线报告已就绪</strong><small>点击预览并领取修为、灵砂与新收藏</small></button>}
      </aside>
    </div>

    {pending && offlineOpen && <div className="travel-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDismissedOfflineReportId(pending.reportId) }}><section className="travel-offline-modal" role="dialog" aria-modal="true" aria-labelledby="offline-report-title" tabIndex={-1}><button type="button" className="travel-modal-close" aria-label="关闭离线报告" onClick={() => setDismissedOfflineReportId(pending.reportId)}>×</button><span className="travel-modal-seal" aria-hidden="true">归</span><small className="travel-kicker">RETURNING FROM THE MIST</small><h2 id="offline-report-title">离线游历报告</h2><p className="travel-modal-lead">这段时间，古道替你走过了 {formatDuration(pending.durationMs)}。</p><div className="travel-offline-stats"><div><small>完成战斗</small><strong>{pending.battles}</strong><span>场</span></div><div><small>推进关卡</small><strong>{pending.clearedStages.length}</strong><span>段</span></div><div><small>抵达</small><strong>{stageLabel(pending.result.highestClearedStage)}</strong><span>/ 30</span></div></div>{pending.failedStage && <p className="travel-offline-warning">在第 {stageLabel(pending.failedStage)} 关停步：{readableReason(pending.firstFailureReason) ?? '战力不足，已转入稳定刷取。'}</p>}<div className="travel-offline-columns"><section><h3>带回的资源</h3><ul className="travel-reward-list">{(Object.entries(pending.resourceDelta) as [keyof typeof RESOURCE_NAMES, number][]).filter(([, value]) => value !== 0).map(([key, value]) => <li key={key}><span>{RESOURCE_NAMES[key]}</span><strong>+{value}</strong></li>)}</ul>{pending.newOwnedIds.length > 0 && <><h3>新入图鉴</h3><ul className="travel-new-items">{pending.newOwnedIds.map((id) => <li key={id}>{displayName(id)}</li>)}</ul></>}</section><section><h3>主要贡献</h3><ContributionList label="伤害" entries={pending.contribution.damageBySource} unit="" /><ContributionList label="治疗" entries={pending.contribution.healingBySource} unit="" /><ContributionList label="护盾" entries={pending.contribution.shieldBySource} unit="" /></section></div><div className="travel-modal-actions"><button type="button" onClick={() => setDismissedOfflineReportId(pending.reportId)}>稍后领取</button><button type="button" className="travel-action-primary" onClick={() => { onClaimOffline(); setDismissedOfflineReportId(pending.reportId) }}>确认领取</button></div></section></div>}
  </main>
}
