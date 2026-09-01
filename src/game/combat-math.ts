import type { BattleContent, BuildId, UnitDefinition } from './types'

export interface DamageBreakdownInput {
  attack: number
  powerPercent: number
  defense: number
  armorBreak?: number
  hits?: number
}

export interface DamageBreakdown {
  attack: number
  powerPercent: number
  hits: number
  effectiveDefense: number
  damagePerHit: number
  totalDamage: number
}

/** The one damage formula shared by battle resolution and preview UI. */
export function getDamageBreakdown(input: DamageBreakdownInput): DamageBreakdown {
  const armorBreak = Math.max(0, input.armorBreak ?? 0)
  const hits = Math.max(1, Math.floor(input.hits ?? 1))
  const effectiveDefense = Math.max(0, input.defense - Math.floor(input.defense * armorBreak * 5 / 100))
  const damagePerHit = Math.max(1, Math.floor(input.attack * input.powerPercent / (100 + effectiveDefense)))
  return { attack: input.attack, powerPercent: input.powerPercent, hits, effectiveDefense, damagePerHit, totalDamage: damagePerHit * hits }
}

export interface CombatantStats {
  maxHp: number
  attack: number
  defense: number
  attackIntervalMs: number
  effectiveHp: number
  unarmoredDps: number
}

export interface CombatStats {
  leader: CombatantStats
  spirits: [CombatantStats, CombatantStats]
  teamEffectiveHp: number
  teamUnarmoredDps: number
  basicAttack: DamageBreakdown
  basicAttackDps: number
  basePower: number
}

export interface CombatPreviewTarget {
  defense: number
  armorBreak?: number
}

function combatant(unit: Pick<UnitDefinition, 'maxHp' | 'attack' | 'defense'>, attackIntervalMs: number): CombatantStats {
  const effectiveHp = Math.floor(unit.maxHp * (100 + unit.defense) / 100)
  const unarmoredDps = unit.attack * 1_000 / attackIntervalMs
  return { maxHp: unit.maxHp, attack: unit.attack, defense: unit.defense, attackIntervalMs, effectiveHp, unarmoredDps }
}

export function getBasePower(units: readonly Pick<CombatantStats, 'maxHp' | 'attack' | 'defense' | 'attackIntervalMs'>[]): number {
  return Math.floor(units.reduce((total, unit) => total + Math.floor(unit.maxHp * (100 + unit.defense) / 100) + unit.attack * 10_000 / unit.attackIntervalMs, 0))
}

/** Derives the readable combat panel from the same content used to create a battle. */
export function getCombatStats(content: BattleContent, buildId: BuildId = content.defaultBuildId, target: CombatPreviewTarget = { defense: 0 }): CombatStats {
  const build = content.builds[buildId]
  const weapon = content.weapons[build.weaponId]
  const leader = combatant(content.leader, weapon.attackIntervalMs)
  const spirits = build.spiritIds.map((id) => combatant(content.spirits[id], content.spirits[id].attackIntervalMs)) as [CombatantStats, CombatantStats]
  const units = [leader, ...spirits]
  const basicAttackPower = typeof weapon.effectParams?.basicAttackPowerPercent === 'number' ? weapon.effectParams.basicAttackPowerPercent : 100
  const basicAttack = getDamageBreakdown({ attack: leader.attack, powerPercent: basicAttackPower, defense: target.defense, armorBreak: target.armorBreak })
  const teamEffectiveHp = units.reduce((total, unit) => total + unit.effectiveHp, 0)
  const teamUnarmoredDps = units.reduce((total, unit) => total + unit.unarmoredDps, 0)
  return { leader, spirits, teamEffectiveHp, teamUnarmoredDps, basicAttack, basicAttackDps: basicAttack.totalDamage * 1_000 / leader.attackIntervalMs, basePower: getBasePower(units) }
}

export const getCombatSnapshot = getCombatStats
