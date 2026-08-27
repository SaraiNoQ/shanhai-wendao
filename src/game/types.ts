export type UnitId = 'leader' | 'blade_tail_fox' | 'iron_beak_crane' | 'clay_idol'
export type CardId =
  | 'guiding_edge'
  | 'hidden_edge'
  | 'returning_wind'
  | 'armor_piercing_star'
  | 'ten_thousand_blades'
  | 'mountain_splitter'

export type BattleStatus = 'active' | 'victory' | 'defeat'

export type CardEffectId =
  | 'damage_and_sword_intent'
  | 'shield_and_prime_intent'
  | 'double_hit'
  | 'damage_and_armor_break'
  | 'sword_intent_multihit'
  | 'consume_sword_intent_finisher'

export interface UnitDefinition {
  id: UnitId
  name: string
  title: string
  maxHp: number
  attack: number
  defense: number
  attackIntervalMs: number
}

export interface CardDefinition {
  id: CardId
  name: string
  cost: number
  kind: '剑式' | '心法'
  description: string
  effectId: CardEffectId
  powerPercent?: number
  hits?: number
  swordIntent?: number
  armorBreak?: number
  shield?: number
}

export interface BattleContent {
  leader: UnitDefinition
  spirits: readonly [UnitDefinition, UnitDefinition]
  enemy: UnitDefinition
  cards: Readonly<Record<CardId, CardDefinition>>
  startingDeck: readonly CardId[]
}

export interface UnitState extends UnitDefinition {
  hp: number
  shield: number
  armorBreak: number
  nextActionAtMs: number
}

export interface BattleState {
  seed: number
  rngState: number[]
  timeMs: number
  status: BattleStatus
  leader: UnitState
  spirits: [UnitState, UnitState]
  enemy: UnitState
  energy: number
  maxEnergy: number
  energyProgressMs: number
  swordIntent: number
  swordIntentCap: number
  nextSwordIntentBonus: number
  cardsPlayed: number
  deck: CardId[]
  hand: CardId[]
  discard: CardId[]
  autoplay: boolean
  autoplayPriority: CardId[]
}

export type BattleCommand =
  | { type: 'advance'; elapsedMs: number }
  | { type: 'play_card'; cardId: CardId }
  | { type: 'set_autoplay'; enabled: boolean }
  | { type: 'reorder_priority'; cardIds: CardId[] }
  | { type: 'restart'; seed?: number }

interface TimedEvent {
  atMs: number
}

export type BattleEvent = TimedEvent &
  (
    | { type: 'battle_started'; seed: number }
    | { type: 'card_drawn'; cardId: CardId }
    | { type: 'card_played'; cardId: CardId; automatic: boolean }
    | {
        type: 'damage'
        sourceId: UnitId | CardId
        targetId: UnitId
        amount: number
        shieldAbsorbed: number
      }
    | { type: 'heal'; sourceId: UnitId | CardId; targetId: UnitId; amount: number }
    | { type: 'shield'; sourceId: UnitId | CardId; targetId: UnitId; amount: number }
    | {
        type: 'status_changed'
        targetId: UnitId | 'battle'
        status: 'sword_intent' | 'armor_break'
        value: number
      }
    | { type: 'energy_changed'; value: number }
    | { type: 'unit_action'; unitId: UnitId; action: string }
    | { type: 'battle_ended'; result: Exclude<BattleStatus, 'active'> }
    | { type: 'message'; text: string }
  )

export interface BattleTransition {
  state: BattleState
  events: BattleEvent[]
}
