export type Archetype = 'sword' | 'talisman' | 'spirit'
export type ComboId = 'flying_sword_seal' | 'spirit_edict' | 'dual_spirit_sword'
export type WeaponId = 'azure_wind_sword' | 'cinnabar_brush' | 'spirit_bell'
export type TechniqueId = 'hidden_edge_art' | 'edict_talisman_codex' | 'hundred_spirit_codex'
export type SpiritId =
  | 'blade_tail_fox'
  | 'iron_beak_crane'
  | 'paper_bride'
  | 'lantern_ghost'
  | 'mountain_child'
  | 'dream_tapir'
export type EnemyId =
  | 'shadow_civet'
  | 'withered_vine_spirit'
  | 'paper_child'
  | 'corpse_lantern_moth'
  | 'title_seeking_immortal'
  | 'clay_idol'
  | 'coin_corpse'
  | 'night_wandering_thrall'
  | 'grave_crow_flock'
  | 'headless_woodcutter'
  | 'borrowed_life_crone'
  | 'hundred_eyed_branch'
  | 'paper_armor_envoy'
export type UnitId = 'leader' | SpiritId | EnemyId
export type EnemyBehaviorId = EnemyId

export type CardId =
  | 'guiding_edge'
  | 'hidden_edge'
  | 'returning_wind'
  | 'flowing_cloud_slashes'
  | 'armor_piercing_star'
  | 'sheathe_sword'
  | 'ten_thousand_blades'
  | 'mountain_splitter'
  | 'fire_talisman'
  | 'mountain_seal'
  | 'thunder_talisman'
  | 'shadow_binding_talisman'
  | 'life_talisman'
  | 'linked_talisman_script'
  | 'urgent_edict'
  | 'nine_heavens_edict'
  | 'call_true_name'
  | 'share_spirit_breath'
  | 'fight_together'
  | 'protect_master'
  | 'spirit_tide'
  | 'borrow_spirit'
  | 'all_spirits_covenant'
  | 'night_of_hundred_beasts'

export type BuildId =
  | 'pure_sword'
  | 'pure_talisman'
  | 'pure_spirit'
  | 'flying_sword_seal'
  | 'spirit_edict'
  | 'dual_spirit_sword'

export type BattleStatus = 'active' | 'victory' | 'defeat'
export type CardTargetRule = 'current_enemy' | 'all_enemies' | 'lowest_hp_ally' | 'chosen_spirit' | 'none'

export type CardEffectId =
  | 'sword_strike'
  | 'prime_sword_intent'
  | 'sword_multi_hit'
  | 'armor_break_strike'
  | 'sword_refund'
  | 'sword_intent_barrage'
  | 'sword_finisher'
  | 'apply_marks_and_burn'
  | 'shield_and_mark'
  | 'mark_scaled_strike'
  | 'bind_shadow'
  | 'life_from_mark'
  | 'prime_talisman_discount'
  | 'detonate_marks'
  | 'storm_edict'
  | 'gain_lowest_bond'
  | 'share_spirit_breath'
  | 'spirit_basic_attacks'
  | 'protect_master'
  | 'spirit_tide'
  | 'copy_spirit_combo'
  | 'mass_spirit_bond'
  | 'spirit_combo_finisher'

export interface UnitDefinition {
  id: UnitId
  name: string
  title: string
  maxHp: number
  attack: number
  defense: number
  attackIntervalMs: number
  artKey?: string
  behaviorId?: EnemyBehaviorId
}

export interface EnemyDefinition extends UnitDefinition { id: EnemyId; behaviorId: EnemyBehaviorId }

export interface SpiritDefinition extends UnitDefinition {
  id: SpiritId
  tags: Archetype[]
}

export interface WeaponDefinition { id: WeaponId; name: string; tag: Archetype; attackIntervalMs: number }
export interface TechniqueDefinition { id: TechniqueId; name: string; tag: Archetype }

export interface CardDefinition {
  id: CardId
  name: string
  cost: number
  kind: '剑式' | '心法' | '符箓' | '敕令' | '御灵'
  tags: Archetype[]
  description: string
  effectId: CardEffectId
  targetRule: CardTargetRule
  powerPercent?: number
  hits?: number
  swordIntent?: number
  armorBreak?: number
  shield?: number
  marks?: number
  burn?: number
  heal?: number
  delayMs?: number
  artKey?: string
}

export interface BuildPreset {
  id: BuildId
  name: string
  subtitle: string
  weaponId: WeaponId
  techniqueId: TechniqueId
  spiritIds: readonly [SpiritId, SpiritId]
  cardIds: readonly [CardId, CardId, CardId, CardId, CardId, CardId]
  autoplayPriority?: readonly CardId[]
}

export interface BattleContent {
  leader: Omit<UnitDefinition, 'attackIntervalMs' | 'title'>
  spirits: Readonly<Record<SpiritId, SpiritDefinition>>
  enemies: readonly EnemyDefinition[]
  enemyDefinitions: Readonly<Record<EnemyId, EnemyDefinition>>
  weapons: Readonly<Record<WeaponId, WeaponDefinition>>
  techniques: Readonly<Record<TechniqueId, TechniqueDefinition>>
  cards: Readonly<Record<CardId, CardDefinition>>
  builds: Readonly<Record<BuildId, BuildPreset>>
  defaultBuildId: BuildId
}

export interface UnitState extends UnitDefinition {
  hp: number
  shield: number
  armorBreak: number
  nextActionAtMs: number
  talismanMarks: number
  talismanExpiresAtMs: number
  burnStacks: number
  nextBurnAtMs: number
  actionCount: number
  attackBonusPercent: number
  deathEffectTriggered: boolean
  summonTriggered: boolean
}

export interface BattleState {
  seed: number
  rngState: number[]
  timeMs: number
  status: BattleStatus
  buildId: BuildId
  weaponId: WeaponId
  techniqueId: TechniqueId
  activeCombos: ComboId[]
  leader: UnitState
  spirits: [UnitState, UnitState]
  enemies: UnitState[]
  energy: number
  maxEnergy: number
  energyProgressMs: number
  swordIntent: number
  swordIntentCap: number
  nextSwordIntentBonus: number
  swordCardStreak: number
  nextFinisherDiscount: number
  talismanDiscountCharges: number
  nextEdictDiscount: number
  spiritBonds: [number, number]
  spiritComboCounts: [number, number]
  firstSpiritComboTriggered: [boolean, boolean]
  totalSpiritCombos: number
  spiritComboDamageBonus: number
  copyNextSpiritCombo: boolean
  discountedCardId?: CardId
  dualSpiritSwordReadyAtMs: number
  basicAttackCount: number
  cardsPlayed: number
  swordCardsPlayed: CardId[]
  lastPlayerCardTag?: Archetype
  sameTagStreak: number
  deck: CardId[]
  hand: CardId[]
  discard: CardId[]
  autoplay: boolean
  autoplayPriority: CardId[]
}

export type BattleCommand =
  | { type: 'advance'; elapsedMs: number }
  | { type: 'play_card'; cardId: CardId; targetId?: UnitId }
  | { type: 'set_autoplay'; enabled: boolean }
  | { type: 'reorder_priority'; cardIds: CardId[] }
  | { type: 'restart'; seed?: number; buildId?: BuildId }

interface TimedEvent { atMs: number }

export type BattleEvent = TimedEvent &
  (
    | { type: 'battle_started'; seed: number; buildId: BuildId }
    | { type: 'card_drawn'; cardId: CardId }
    | { type: 'card_played'; cardId: CardId; automatic: boolean; targetId?: UnitId }
    | { type: 'damage'; sourceId: UnitId | CardId | 'burn'; targetId: UnitId; amount: number; shieldAbsorbed: number }
    | { type: 'heal'; sourceId: UnitId | CardId; targetId: UnitId; amount: number }
    | { type: 'shield'; sourceId: UnitId | CardId; targetId: UnitId; amount: number }
    | { type: 'status_changed'; targetId: UnitId | 'battle'; status: 'sword_intent' | 'armor_break' | 'talisman_mark' | 'burn' | 'spirit_bond' | 'energy_discount'; value: number }
    | { type: 'energy_changed'; value: number }
    | { type: 'unit_action'; unitId: UnitId; action: string }
    | { type: 'unit_summoned'; unitId: EnemyId; sourceId: EnemyId }
    | { type: 'enemy_buff'; targetId: EnemyId; status: 'attack' | 'adaptation_shield'; value: number }
    | { type: 'wave_started'; waveNumber: number }
    | { type: 'battle_timeout' }
    | { type: 'combo_triggered'; comboId: ComboId }
    | { type: 'battle_ended'; result: Exclude<BattleStatus, 'active'> }
    | { type: 'message'; text: string }
  )

export interface BattleTransition { state: BattleState; events: BattleEvent[] }
