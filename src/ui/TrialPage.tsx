import { useMemo, useState } from 'react'
import { TRIAL_EVENTS_BY_ID, TRIAL_TILE_DEFINITIONS, type TrialTileKind } from '../content/trial'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import { canChooseTrialEvent, trialPendingOptions, type TrialRun, type TrialSettlement } from '../game/trial'
import type { PlayerSave } from '../state/player'
import './TrialPage.css'

interface TrialPageProps {
  save: PlayerSave
  run?: TrialRun
  pendingSettlement?: TrialSettlement
  error?: string
  onStart: () => void
  onMove: (tileId: string) => void
  onChoose: (optionId: string, targetCardInstanceId?: string) => void
  onStartBattle: () => void
  onRetreat: () => void
  onClaim: () => void
}

const KIND_NAMES: Record<TrialTileKind | 'start', string> = { combat: '战', elite: '精', event: '谈', training: '修', merchant: '商', chest: '箱', camp: '营', boss: '劫', start: '起' }

function tileLabel(tile: TrialRun['grid'][number]) { return tile.kind === 'start' ? '起点' : TRIAL_TILE_DEFINITIONS[tile.kind]?.name ?? tile.kind }

export function TrialPage({ save, run, pendingSettlement, error, onStart, onMove, onChoose, onStartBattle, onRetreat, onClaim }: TrialPageProps) {
  const [selectedTileId, setSelectedTileId] = useState<string>()
  const selected = run?.grid.find((tile) => tile.id === selectedTileId)
  const pendingOptions = run ? trialPendingOptions(run) : []
  const event = run?.pending?.kind === 'event' ? TRIAL_EVENTS_BY_ID[run.pending.eventId] : undefined
  const cards = useMemo(() => run?.cardInstances ?? [], [run?.cardInstances])
  if (!run) return <main className="trial-page trial-empty-page"><section className="trial-intro"><span className="trial-seal">劫</span><small>REALM BREAKTHROUGH</small><h1>槐阴劫境</h1><p>{pendingSettlement ? '上一次劫境已经结束，结算卷轴正在等你落印。' : '第 30 关之后，槐根下的路只为愿意承担因果的人打开。'}</p>{pendingSettlement ? <><h2>{pendingSettlement.result === 'success' ? '槐根退让' : '劫火熄灭'}</h2><ul className="trial-settlement-rewards">{pendingSettlement.rewards.map((reward) => <li key={reward.id}>{reward.resource ?? reward.kind}<strong>{reward.amount ? `+${reward.amount}` : '已保留'}</strong></li>)}</ul><button type="button" className="trial-primary" onClick={onClaim}>确认领取</button></> : <button type="button" className="trial-primary" onClick={onStart}>开劫入境</button>}</section></main>

  const pendingLabel = run.pending?.kind === 'battle' ? '斗法' : run.pending?.kind === 'event' ? '怪谈' : run.pending ? TRIAL_TILE_DEFINITIONS[run.grid.find((tile) => tile.id === run.pending?.tileId)?.kind as TrialTileKind]?.name : ''
  return <main className="trial-page" aria-labelledby="trial-title">
    <header className="trial-heading"><div><small>REALM BREAKTHROUGH · 7×7 山河图</small><h1 id="trial-title">槐阴劫境</h1><p>行炁有限，劫印开门；每一步都把你带向槐姥的根。</p></div><div className="trial-header-stats"><span><small>行炁</small><strong>{run.actionPoints}<i>/22</i></strong></span><span><small>劫印</small><strong>{run.trialSeals}<i>/2</i></strong></span><span><small>劫尘</small><strong>{run.runCurrency}</strong></span><button type="button" onClick={onRetreat}>撤退</button></div></header>
    {error && <p className="trial-banner is-error" role="alert">{error}</p>}
    {run.pending && <section className="trial-pending-banner" role="status"><div><small>当前待处理 · {pendingLabel}</small><strong>{run.pending.kind === 'event' ? event?.title : run.pending.kind === 'battle' ? (run.pending.boss ? '千年槐姥' : run.pending.elite ? '精英遭遇' : '战斗遭遇') : pendingLabel}</strong></div>{run.pending.kind === 'battle' && <button type="button" className="trial-primary" onClick={onStartBattle}>进入斗法</button>}</section>}
    <div className="trial-layout"><section className="trial-map" aria-label="槐阴劫境地图"><div className="trial-map-grid">{run.grid.map((tile) => { const visible = run.revealedTileIds.includes(tile.id); const current = run.positionTileId === tile.id; const selectedState = selectedTileId === tile.id; return <button key={tile.id} type="button" aria-label={`${visible ? tileLabel(tile) : '迷雾'}${current ? '，当前位置' : ''}`} aria-pressed={selectedState} disabled={!visible || Boolean(run.pending) || (!current && Math.abs(tile.x - (run.grid.find((item) => item.id === run.positionTileId)?.x ?? 0)) + Math.abs(tile.y - (run.grid.find((item) => item.id === run.positionTileId)?.y ?? 0)) !== 1)} className={`trial-tile kind-${tile.kind} ${visible ? 'is-visible' : 'is-hidden'} ${current ? 'is-current' : ''} ${tile.resolved ? 'is-resolved' : ''} ${selectedState ? 'is-selected' : ''}`} style={{ gridColumn: tile.x + 1, gridRow: tile.y + 1 }} onClick={() => { setSelectedTileId(tile.id); if (!current) onMove(tile.id) }}><span>{visible ? KIND_NAMES[tile.kind] : '·'}</span>{visible && tile.kind !== 'start' && <small>{tile.resolved ? '已探' : tile.kind === 'boss' ? `${run.trialSeals}/2` : '未探'}</small>}</button> })}</div><div className="trial-map-legend">{(['combat', 'elite', 'event', 'training', 'merchant', 'chest', 'camp', 'boss'] as TrialTileKind[]).map((kind) => <span key={kind}><i className={`kind-${kind}`} />{KIND_NAMES[kind]} {TRIAL_TILE_DEFINITIONS[kind].name}</span>)}</div></section>
      <aside className="trial-sidebar"><section className="trial-card trial-status-card"><header><div><small>RUN STATUS</small><h2>{run.status === 'active' ? '劫中行' : run.status === 'success' ? '渡劫成功' : run.status === 'retreat' ? '已撤退' : '劫中败退'}</h2></div><span className="trial-run-id">{run.runId}</span></header><dl><div><dt>当前格</dt><dd>{tileLabel(run.grid.find((tile) => tile.id === run.positionTileId)!)}</dd></div><div><dt>临时牌</dt><dd>{run.cardInstances.length} / 12</dd></div><div><dt>法宝</dt><dd>{run.treasureCharge} / 3</dd></div></dl>{selected && <p className="trial-selected-copy">已选：{tileLabel(selected)}。{selected.kind === 'boss' && run.trialSeals < 2 ? '还缺劫印，首领门暂不可开启。' : selected.kind !== 'start' && !run.pending ? '点击相邻格即可移动。' : ''}</p>}</section>
        {event && <section className="trial-card trial-event-card"><small>TALE FRAGMENT</small><h2>{event.title}</h2><p>{event.body}</p><div className="trial-choice-list">{event.choices.map((choice) => { const copies = choice.outcomes.some((outcome) => outcome.kind === 'copy_temporary_card'); const upgrades = choice.outcomes.some((outcome) => outcome.kind === 'upgrade_temporary_card'); const target = cards.find((card) => run.temporaryCardInstanceIds.includes(card.instanceId) && (!upgrades || !card.upgraded))?.instanceId; return <button key={choice.id} type="button" disabled={!canChooseTrialEvent(run, event.id, choice.id) || ((copies || upgrades) && !target)} onClick={() => onChoose(choice.id, target)}><strong>{choice.label}</strong><span>{choice.description}</span></button> })}</div></section>}
        {run.pending?.kind === 'card_reward' && <section className="trial-card"><small>REWARD CHOICE</small><h2>战后取舍</h2><div className="trial-choice-list">{pendingOptions.map((option) => <button key={option.id} type="button" onClick={() => onChoose(option.id, option.instanceId)}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div></section>}
        {run.pending && ['training', 'merchant', 'chest', 'camp'].includes(run.pending.kind) && <section className="trial-card"><small>INTERACTION</small><h2>{pendingLabel}</h2><div className="trial-choice-list">{pendingOptions.map((option) => <button key={option.id} type="button" onClick={() => onChoose(option.id, option.instanceId ?? run.temporaryCardInstanceIds[0])}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div></section>}
        <section className="trial-card trial-deck-card"><small>TEMPORARY DECK</small><h2>本局牌组 · {run.cardInstances.length}/12</h2><ul>{run.cardInstances.map((card) => <li key={card.instanceId}><span>{PROTOTYPE_CONTENT.cards[card.cardId]?.name ?? card.cardId}</span>{card.upgraded && <em>减耗</em>}{run.temporaryCardInstanceIds.includes(card.instanceId) && <small>临时</small>}</li>)}</ul></section>
        {pendingSettlement && <section className="trial-card trial-settlement-card" role="dialog" aria-modal="true"><span className={`trial-settlement-mark ${pendingSettlement.result === 'success' ? 'is-success' : ''}`}>{pendingSettlement.result === 'success' ? '成' : '退'}</span><small>TRIAL SETTLEMENT</small><h2>{pendingSettlement.result === 'success' ? '槐根退让' : pendingSettlement.result === 'retreat' ? '留得一线生机' : '劫火熄灭'}</h2><p>本局完成 {pendingSettlement.report.battles} 场斗法，耗时 {Math.floor(pendingSettlement.report.durationMs / 1_000)} 秒。</p><ul className="trial-settlement-rewards">{pendingSettlement.rewards.map((reward) => <li key={reward.id}>{reward.resource ?? reward.kind}<strong>{reward.amount ? `+${reward.amount}` : '已保留'}</strong></li>)}</ul><button type="button" className="trial-primary" onClick={onClaim}>确认领取</button></section>}
      </aside></div>
    <footer className="trial-footer"><span>本局种子：{run.seed}</span><span>已发现志怪：{run.discoveredLoreIds.length}</span><span>当前配装：{save.loadout.buildId}</span></footer>
  </main>
}
