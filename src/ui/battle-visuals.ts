import type { BattleCardReference, BattleEvent, BattleState, UnitId } from '../game/types'

export type BattleVisualCue = {
  key: string
  kind: 'hit' | 'heal' | 'shield' | 'card' | 'status' | 'buff' | 'combo' | 'summon' | 'wave' | 'phase' | 'end'
  sourceId?: string
  targetId?: UnitId
  amount?: number
}

export function battleEventsToVisualCues(events: readonly BattleEvent[]): BattleVisualCue[] {
  return events.flatMap((event, index): BattleVisualCue[] => {
    if (event.type === 'damage') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'hit', sourceId: event.sourceId, targetId: event.targetId, amount: event.amount + event.shieldAbsorbed }]
    if (event.type === 'heal') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'heal', sourceId: event.sourceId, targetId: event.targetId, amount: event.amount }]
    if (event.type === 'shield') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'shield', sourceId: event.sourceId, targetId: event.targetId, amount: event.amount }]
    if (event.type === 'card_played') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'card', sourceId: event.cardId }]
    if (event.type === 'unit_summoned') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'summon', sourceId: event.sourceId, targetId: event.unitId }]
    if (event.type === 'boss_phase_changed') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'phase' }]
    if (event.type === 'status_changed') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'status', targetId: event.targetId === 'battle' ? undefined : event.targetId, amount: event.value }]
    if (event.type === 'enemy_buff') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'buff', targetId: event.targetId, amount: event.value }]
    if (event.type === 'combo_triggered') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'combo', sourceId: event.comboId }]
    if (event.type === 'wave_started') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'wave' }]
    if (event.type === 'battle_ended' || event.type === 'battle_timeout') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'end' }]
    return []
  })
}

export interface BattleUnitVisual {
  key: string
  unitId: UnitId
  side: 'ally' | 'enemy'
  index: number
  x: number
  y: number
  scale: number
}

export function getBattleUnitLayout(battle: BattleState<BattleCardReference>): BattleUnitVisual[] {
  const enemyScale = battle.enemies.length > 1 ? 0.2 : 0.28
  const bossScale = battle.enemies.some((enemy) => enemy.id === 'ancient_huai_matriarch') ? 0.3 : enemyScale
  const allies = [battle.leader, ...battle.spirits].map((unit, index) => ({ key: `ally:${index}:${unit.id}`, unitId: unit.id, side: 'ally' as const, index, x: index === 0 ? 0.12 : 0.34, y: index === 0 ? 0.62 : index === 1 ? 0.32 : 0.78, scale: index === 0 ? 0.42 : 0.25 }))
  const enemyX = battle.enemies.length === 1 ? [0.79] : battle.enemies.length === 2 ? [0.74, 0.92] : [0.66, 0.80, 0.94]
  const enemies = battle.enemies.map((unit, index) => ({ key: `enemy:${index}:${unit.id}`, unitId: unit.id, side: 'enemy' as const, index, x: enemyX[index % enemyX.length], y: 0.3 + Math.floor(index / 3) * 0.24, scale: unit.id === 'ancient_huai_matriarch' ? bossScale : enemyScale }))
  return [...allies, ...enemies]
}
