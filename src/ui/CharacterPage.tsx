import { DragDropProvider, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/react'
import { useMemo, useState } from 'react'
import { COLLECTION, COLLECTION_BY_ID, EQUIPMENT_SLOTS, type CollectionCategory, type CollectibleDefinition, type EquipmentSlot } from '../content/collection'
import { assetUrl } from '../content/assets'
import { getEntityDetail, type EntityDetail } from '../content/details'
import { type PlayerSave, previewReroll, resetLevel, resolveReroll, upgrade, upgradeCost, REROLL_ESSENCE_COST } from '../state/player'
import { applyLoadoutChange, compatibleSlotForItem, collectibleForSlot, getLoadoutSummary, reorderLoadoutPriority, swapLoadoutSlots, type LoadoutChangeResult, type LoadoutSlotId } from '../state/loadout'
import { PriorityList } from './PriorityList'
import './CharacterPage.css'

const categoryNames: Record<CollectionCategory, string> = { weapon: '武器', equipment: '装备', technique: '功法', card: '术法', treasure: '法宝', consumable: '配方', spirit: '妖灵' }
const rarityNames = { common: '凡品', uncommon: '珍品', rare: '秘品', legacy: '传承' }
const tagNames = { sword: '剑意', talisman: '符咒', spirit: '御灵' }
const comboNames = { flying_sword_seal: '飞剑镇符', spirit_edict: '灵使敕令', dual_spirit_sword: '双灵剑阵' }
const allCategories = ['all', 'weapon', 'technique', 'spirit', 'equipment', 'treasure', 'consumable', 'card'] as const

type CharacterTab = 'loadout' | 'spirits' | 'utility' | 'spells'

const characterTabs: Array<{ id: CharacterTab; label: string; eyebrow: string; categories: readonly CollectionCategory[] }> = [
  { id: 'loadout', label: '配装', eyebrow: 'FORMATION', categories: ['weapon', 'technique', 'equipment'] },
  { id: 'spirits', label: '妖灵', eyebrow: 'SPIRITS', categories: ['spirit'] },
  { id: 'utility', label: '法宝丹药', eyebrow: 'RELICS & PILLS', categories: ['treasure', 'consumable'] },
  { id: 'spells', label: '术法', eyebrow: 'SPELLBOOK', categories: ['card'] },
]

export interface CharacterCombatPreview {
  targetName?: string
  basicAttackDamage?: number
  basicAttackDps?: number
  combatPower?: number
  cardPreviews?: Record<string, { powerPercent: number; hits: number; damagePerHit: number; totalDamage: number }>
}

export interface CharacterPageProps {
  save: PlayerSave
  onSaveChange: (result: LoadoutChangeResult) => void
  readOnly?: boolean
  readOnlyReason?: string
  onEnterBattle?: () => void
  /** Optional values from the shared rules-layer preview; the page never recomputes combat formulas. */
  combatPreview?: CharacterCombatPreview
}

function displayArt(artKey: string | undefined) {
  return artKey ? assetUrl(artKey) ?? `/assets/pixel/${artKey.replaceAll('_', '-')}.png` : undefined
}

function loadoutIds(save: PlayerSave) {
  return new Set([save.loadout.weaponId, save.loadout.techniqueId, ...save.loadout.spiritIds, ...save.loadout.equipmentIds, save.loadout.treasureId, ...save.loadout.consumableIds, ...save.loadout.cardIds])
}

function currentSlotIds(save: PlayerSave, slot: LoadoutSlotId) {
  if (slot === 'weapon') return save.loadout.weaponId
  if (slot === 'technique') return save.loadout.techniqueId
  if (slot === 'treasure') return save.loadout.treasureId
  if (slot.startsWith('spirit_')) return save.loadout.spiritIds[Number(slot.at(-1))]
  if (slot.startsWith('consumable_')) return save.loadout.consumableIds[Number(slot.at(-1))]
  if (slot.startsWith('card_')) return save.loadout.cardIds[Number(slot.at(-1))]
  return save.loadout.equipmentIds[EQUIPMENT_SLOTS.indexOf(slot as EquipmentSlot)]
}

function slotItem(save: PlayerSave, slot: LoadoutSlotId) {
  return collectibleForSlot(save, slot)
}

function targetSlotFor(save: PlayerSave, id: string, preferred?: LoadoutSlotId) {
  const item = COLLECTION_BY_ID[id]
  if (!item) return undefined
  const allSlots: LoadoutSlotId[] = ['weapon', 'technique', 'head', 'robe', 'feet', 'charm', 'spirit_0', 'spirit_1', 'treasure', 'consumable_0', 'consumable_1', 'card_0', 'card_1', 'card_2', 'card_3', 'card_4', 'card_5']
  const equippedSlot = allSlots.find((slot) => currentSlotIds(save, slot) === id)
  if (equippedSlot) return equippedSlot
  if (preferred && ((item.category === 'equipment' && item.slot === preferred) || (item.category === 'card' && preferred.startsWith('card_')) || (item.category === 'spirit' && preferred.startsWith('spirit_')) || (item.category === 'consumable' && preferred.startsWith('consumable_')) || (item.category === 'weapon' && preferred === 'weapon') || (item.category === 'technique' && preferred === 'technique') || (item.category === 'treasure' && preferred === 'treasure'))) return preferred
  return compatibleSlotForItem(save, id)
}

function DetailStats({ title, stats }: { title: string; stats: EntityDetail['currentStats'] | undefined }) {
  if (!stats?.length) return null
  return <section className="character-stat-block"><h4>{title}</h4><dl>{stats.map((stat, index) => <div key={`${stat.label}-${index}`}><dt>{stat.label}</dt><dd>{stat.value}{stat.delta && <small>{stat.delta}</small>}</dd></div>)}</dl></section>
}

function DraggableItem({ item, level, selected, equipped, readOnly, onSelect }: { item: CollectibleDefinition; level: number; selected: boolean; equipped: boolean; readOnly: boolean; onSelect: () => void }) {
  const { ref, isDragging } = useDraggable({ id: `item:${item.id}`, data: { collectibleId: item.id }, disabled: readOnly })
  return <button ref={(node) => ref(node)} type="button" className={`inventory-item rarity-${item.rarity} ${selected ? 'is-selected' : ''} ${equipped ? 'is-equipped' : ''} ${isDragging ? 'is-dragging' : ''}`} onClick={onSelect} title={`${item.name}，点击查看详情，拖入兼容槽位${readOnly ? '（当前只读）' : ''}`}>
    <span className="inventory-item-art">{item.artKey ? <img src={displayArt(item.artKey)} alt="" loading="lazy" decoding="async" /> : <i aria-hidden="true">{item.name.at(0)}</i>}</span>
    <span className="inventory-item-copy"><strong>{item.name}</strong><small>{categoryNames[item.category]} · Lv.{level}</small>{equipped && <em>已装备</em>}</span>
  </button>
}

function DroppableSlot({ save, slot, label, selected, readOnly, onSelect }: { save: PlayerSave; slot: LoadoutSlotId; label: string; selected: boolean; readOnly: boolean; onSelect: () => void }) {
  const { ref: dragRef, isDragging } = useDraggable({ id: `slot:${slot}`, data: { slotId: slot }, disabled: readOnly })
  const { ref, isDropTarget } = useDroppable({ id: `slot:${slot}`, data: { slotId: slot } })
  const item = slotItem(save, slot)
  return <div className={`character-slot ${selected ? 'is-selected' : ''} ${isDropTarget ? 'is-drop-target' : ''} ${isDragging ? 'is-dragging' : ''} ${readOnly ? 'is-readonly' : ''}`}>
    <button ref={(node) => { ref(node); dragRef(node) }} type="button" onClick={onSelect} aria-label={`${label}：${item?.name ?? '空位'}`}>
      <span className="slot-label">{label}</span>
      <span className="slot-glyph">{item?.artKey ? <img src={displayArt(item.artKey)} alt="" loading="lazy" decoding="async" /> : <i aria-hidden="true">{item?.name.at(0) ?? '空'}</i>}</span>
      <strong>{item?.name ?? '空位'}</strong>
      {item && <small>Lv.{save.levels[item.id] ?? 1}</small>}
    </button>
  </div>
}

function DetailPanel({ detail, save, selectedSlot, readOnly, readOnlyReason, combatPreview, onEquip, onSaveChange, onFeedback }: { detail: EntityDetail | undefined; save: PlayerSave; selectedSlot?: LoadoutSlotId; readOnly: boolean; readOnlyReason?: string; combatPreview?: CharacterCombatPreview; onEquip: () => void; onSaveChange: (result: LoadoutChangeResult) => void; onFeedback: (message: string) => void }) {
  if (!detail) return <aside className="character-detail"><p>选择一件收藏查看详细规则。</p></aside>
  const item = COLLECTION_BY_ID[detail.id]
  const level = save.levels[detail.id] ?? 1
  const owned = save.ownedIds.includes(detail.id)
  const cost = item ? upgradeCost(item, level) : undefined
  const canPay = cost && save.resources.spiritSand >= cost.spiritSand && save.resources[cost.essenceType] >= cost.essence
  const rerollPending = save.pendingReroll?.equipmentId === detail.id ? save.pendingReroll : undefined
  const send = (next: PlayerSave, success: string) => { if (next === save) { onFeedback(readOnly ? '当前状态只读，结束后才可调整角色。' : '资源或条件不足，操作未生效。'); return }; onSaveChange({ save: next, changed: true }); onFeedback(success) }
  const upgradeReason = readOnly ? '劫境结束后可调整' : level >= 10 ? '已达等级上限' : !canPay ? '资源不足' : undefined
  const resetReason = readOnly ? '劫境结束后可调整' : level === 1 ? '当前已是 Lv.1' : undefined
  const rerollReason = readOnly ? '劫境结束后可调整' : save.resources.artifactEssence < REROLL_ESSENCE_COST ? '器华不足' : undefined
  return <aside className="character-detail">
    <div className="detail-kicker">{detail.category} · {owned ? '已收录' : '未收录'}</div>
    {detail.artKey && <div className="detail-art"><img src={displayArt(detail.artKey)} alt="" loading="lazy" decoding="async" /></div>}
    <h2>{detail.name}</h2><p className="detail-summary">{detail.summary}</p>
    <div className="detail-tags">{detail.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
    <DetailStats title="当前数值" stats={detail.currentStats} />
    <DetailStats title={level >= 10 ? '已达上限' : `下一级 · Lv.${level + 1}`} stats={detail.nextLevelStats} />
    {item?.category === 'card' && combatPreview?.cardPreviews?.[detail.id] && <section className="card-preview-readout"><h4>对当前预览敌人</h4><p>基础结算，不计剑意、符印和 Combo 增益。</p><dl><div><dt>每段伤害</dt><dd>{combatPreview.cardPreviews[detail.id].damagePerHit}</dd></div><div><dt>攻击段数</dt><dd>{combatPreview.cardPreviews[detail.id].hits}</dd></div><div><dt>总伤害</dt><dd>{combatPreview.cardPreviews[detail.id].totalDamage}</dd></div></dl></section>}
    <section className="character-mechanics"><h4>规则说明</h4>{detail.mechanics.map((entry, index) => <p key={`${entry.label}-${index}`}><strong>{entry.label}</strong>{entry.value}</p>)}</section>
    <dl className="detail-meta"><div><dt>获取来源</dt><dd>{detail.source}</dd></div><div><dt>当前等级</dt><dd>{owned ? `Lv.${level} / 10` : '尚未拥有'}</dd></div></dl>
    {item && owned && <div className="character-detail-actions">
      <button type="button" disabled={Boolean(upgradeReason)} title={upgradeReason} onClick={() => send(upgrade(save, detail.id), `「${detail.name}」已提升至 Lv.${level + 1}。`)}>{level >= 10 ? '已臻圆满' : `升级 · ${cost?.spiritSand} 灵砂 / ${cost?.essence} 精华${upgradeReason ? `（${upgradeReason}）` : ''}`}</button>
      <button type="button" disabled={Boolean(resetReason)} title={resetReason} onClick={() => send(resetLevel(save, detail.id), `「${detail.name}」已重置，资源全额返还。`)}>免费重置{resetReason ? `（${resetReason}）` : ''}</button>
      {item.category === 'equipment' && <>{rerollPending ? <div className="reroll-choice"><p>候选词条：{rerollPending.affixes.map((id) => AFFIXES_LABEL[id] ?? id).join(' · ')}</p><button type="button" disabled={readOnly} onClick={() => send(resolveReroll(save, true), '已确认新的装备词条。')}>确认重铸{readOnly ? '（劫境结束后可调整）' : ''}</button><button type="button" disabled={readOnly} onClick={() => send(resolveReroll(save, false), '已保留原装备词条。')}>保留原词条{readOnly ? '（劫境结束后可调整）' : ''}</button></div> : <button type="button" disabled={Boolean(rerollReason)} title={rerollReason} onClick={() => send(previewReroll(save, detail.id), `已生成「${detail.name}」的重铸预览。`)}>预览重铸 · {REROLL_ESSENCE_COST} 器华{rerollReason ? `（${rerollReason}）` : ''}</button>}</>}
      <button type="button" className="equip-detail-button" disabled={readOnly} title={readOnly ? '劫境结束后可调整' : undefined} onClick={onEquip}>{selectedSlot ? `装备到${SLOT_LABELS[selectedSlot] ?? '兼容槽位'}${readOnly ? '（劫境结束后可调整）' : ''}` : `装备到兼容槽位${readOnly ? '（劫境结束后可调整）' : ''}`}</button>
    </div>}
    {readOnly && <p className="readonly-note">{readOnlyReason ?? '当前状态只读：换装、升级和重铸将在本局结束后开放。'}</p>}
  </aside>
}

const SLOT_LABELS: Partial<Record<LoadoutSlotId, string>> = { weapon: '武器槽', technique: '功法槽', head: '头冠槽', robe: '法衣槽', feet: '足履槽', charm: '佩饰槽', spirit_0: '左妖灵槽', spirit_1: '右妖灵槽', treasure: '法宝槽', consumable_0: '行用槽一', consumable_1: '行用槽二' }
const AFFIXES_LABEL: Record<string, string> = { max_hp: '生元', attack: '攻势', defense: '护体', opening_energy: '开场灵力', tag_discount: '同标签减费', shield_power: '护盾增幅', spirit_combo_power: '协击增幅', mark_burst_power: '引爆增幅', sword_finisher_power: '终结增幅' }

function selectSlot(save: PlayerSave, slot: LoadoutSlotId, setSelectedSlot: (slot: LoadoutSlotId) => void, setSelectedId: (id: string) => void) {
  setSelectedSlot(slot)
  setSelectedId(currentSlotIds(save, slot))
}

function StageHeader({ eyebrow, title, tags }: { eyebrow: string; title: string; tags?: string[] }) {
  return <div className="stage-header"><div><small>{eyebrow}</small><h3>{title}</h3></div>{tags?.length ? <div className="stage-tags">{tags.map((tag) => <span key={tag}>{tagNames[tag as keyof typeof tagNames] ?? tag}</span>)}</div> : null}</div>
}

function CharacterAvatar({ summary }: { summary: ReturnType<typeof getLoadoutSummary> }) {
  return <div className="avatar-stage"><div className="mist-ring" aria-hidden="true" /><img src={assetUrl('character_cultivator_full')} alt="无名修士全身像" loading="eager" decoding="async" width="512" height="768" /><div className="avatar-caption"><strong>无名修士</strong><span>炼气试演 · {summary.leader.maxHp} 生元</span></div></div>
}

function CombatReadout({ summary, preview }: { summary: ReturnType<typeof getLoadoutSummary>; preview?: CharacterCombatPreview }) {
  const interval = `${(summary.weapon.attackIntervalMs / 1_000).toFixed(2)} 秒`
  const shown = (value: number | undefined, suffix = '') => value === undefined ? '待规则层' : `${value}${suffix}`
  const firstCard = preview?.cardPreviews?.[summary.cards[0]?.id]
  return <section className="combat-readout" aria-label="基础战斗数值"><div className="readout-heading"><div><small>RULES PREVIEW</small><h4>实战预估</h4></div><span>{preview?.targetName ? `目标：${preview.targetName}` : '当前接口未提供目标'}</span></div><div className="combat-readout-grid"><span><small>主将生元</small><strong>{summary.leader.maxHp}</strong></span><span><small>主将攻势</small><strong>{summary.leader.attack}</strong></span><span><small>主将护体</small><strong>{summary.leader.defense}</strong></span><span><small>出手间隔</small><strong>{interval}</strong></span><span><small>普攻每段</small><strong>{shown(preview?.basicAttackDamage)}</strong></span><span><small>普攻 DPS</small><strong>{shown(preview?.basicAttackDps)}</strong></span><span><small>首张牌总伤</small><strong>{shown(firstCard?.totalDamage)}</strong></span><span><small>基础战力</small><strong>{shown(preview?.combatPower)}</strong></span></div><p>当前连携：<strong className="readout-combos">{summary.activeCombos.map((combo) => comboNames[combo]).join(' · ') || '未激活'}</strong>。首张牌显示无资源增益的基础总伤；战力只用于面板比较，不计入战斗门槛或掉落。</p></section>
}

function EquipmentStage({ save, summary, readOnly, selectedSlot, onSelectSlot, preview }: { save: PlayerSave; summary: ReturnType<typeof getLoadoutSummary>; readOnly: boolean; selectedSlot: LoadoutSlotId; onSelectSlot: (slot: LoadoutSlotId) => void; preview?: CharacterCombatPreview }) {
  return <section className="character-stage equipment-stage" aria-label="主将配装">
    <StageHeader eyebrow="ACTIVE FORMATION" title={summary.buildName} tags={summary.tags} />
    <div className="equipment-grid"><div className="equipment-column equipment-column-left"><DroppableSlot save={save} slot="head" label="头冠" selected={selectedSlot === 'head'} readOnly={readOnly} onSelect={() => onSelectSlot('head')} /><DroppableSlot save={save} slot="robe" label="法衣" selected={selectedSlot === 'robe'} readOnly={readOnly} onSelect={() => onSelectSlot('robe')} /><DroppableSlot save={save} slot="feet" label="足履" selected={selectedSlot === 'feet'} readOnly={readOnly} onSelect={() => onSelectSlot('feet')} /></div><CharacterAvatar summary={summary} /><div className="equipment-column equipment-column-right"><DroppableSlot save={save} slot="weapon" label="武器" selected={selectedSlot === 'weapon'} readOnly={readOnly} onSelect={() => onSelectSlot('weapon')} /><DroppableSlot save={save} slot="technique" label="功法" selected={selectedSlot === 'technique'} readOnly={readOnly} onSelect={() => onSelectSlot('technique')} /><DroppableSlot save={save} slot="charm" label="佩饰" selected={selectedSlot === 'charm'} readOnly={readOnly} onSelect={() => onSelectSlot('charm')} /></div></div>
    <CombatReadout summary={summary} preview={preview} />
  </section>
}

function SpiritsStage({ save, summary, readOnly, selectedSlot, onSelectSlot }: { save: PlayerSave; summary: ReturnType<typeof getLoadoutSummary>; readOnly: boolean; selectedSlot: LoadoutSlotId; onSelectSlot: (slot: LoadoutSlotId) => void }) {
  return <section className="character-stage feature-stage" aria-label="妖灵管理"><StageHeader eyebrow="SPIRIT CONTRACTS" title="妖灵编阵" tags={summary.tags} /><p className="feature-intro">妖灵自动行动；灵契达到 3 点时触发协击。点击槽位查看对应的生元、攻势、护体和行动间隔。</p><div className="feature-slot-row"><DroppableSlot save={save} slot="spirit_0" label="妖灵·左" selected={selectedSlot === 'spirit_0'} readOnly={readOnly} onSelect={() => onSelectSlot('spirit_0')} /><DroppableSlot save={save} slot="spirit_1" label="妖灵·右" selected={selectedSlot === 'spirit_1'} readOnly={readOnly} onSelect={() => onSelectSlot('spirit_1')} /></div><div className="spirit-stat-grid">{summary.spirits.map((spirit, index) => <button type="button" key={spirit.id} className="spirit-stat-card" onClick={() => onSelectSlot(index === 0 ? 'spirit_0' : 'spirit_1')}><strong>{spirit.name}</strong><small>{spirit.title} · Lv.{spirit.level}</small><span>生元 {spirit.maxHp} · 攻势 {spirit.attack} · 护体 {spirit.defense}</span><span>行动间隔 {(spirit.attackIntervalMs / 1_000).toFixed(2)} 秒 · 灵契 0/3</span></button>)}</div><div className="feature-callout"><strong>协击预览</strong><span>{summary.spirits.map((spirit) => spirit.name).join(' ＋ ')}：灵契满层时共同发动一次协击。</span></div></section>
}

function UtilityStage({ save, summary, readOnly, selectedSlot, onSelectSlot }: { save: PlayerSave; summary: ReturnType<typeof getLoadoutSummary>; readOnly: boolean; selectedSlot: LoadoutSlotId; onSelectSlot: (slot: LoadoutSlotId) => void }) {
  return <section className="character-stage feature-stage" aria-label="法宝和丹药管理"><StageHeader eyebrow="RELICS & PILLS" title="法宝丹药" /><p className="feature-intro">法宝蓄能后主动发动；行用配方在游历与劫境中按规则消耗，回城补满次数。</p><div className="utility-slot-layout"><div><DroppableSlot save={save} slot="treasure" label="法宝" selected={selectedSlot === 'treasure'} readOnly={readOnly} onSelect={() => onSelectSlot('treasure')} /></div><div className="utility-consumables"><DroppableSlot save={save} slot="consumable_0" label="行用一" selected={selectedSlot === 'consumable_0'} readOnly={readOnly} onSelect={() => onSelectSlot('consumable_0')} /><DroppableSlot save={save} slot="consumable_1" label="行用二" selected={selectedSlot === 'consumable_1'} readOnly={readOnly} onSelect={() => onSelectSlot('consumable_1')} /></div></div><div className="utility-summary"><div><small>当前法宝</small><strong>{summary.treasure.name}</strong><span>Lv.{summary.treasure.level} · 蓄能 0 / 3</span></div>{summary.consumables.map((item) => <div key={item.id}><small>行用配方</small><strong>{item.name}</strong><span>Lv.{item.level} · 本局次数按规则补满</span></div>)}</div></section>
}

function SpellsStage({ save, summary, readOnly, selectedSlot, onSelectSlot, onPriorityChange, onFeedback }: { save: PlayerSave; summary: ReturnType<typeof getLoadoutSummary>; readOnly: boolean; selectedSlot: LoadoutSlotId; onSelectSlot: (slot: LoadoutSlotId) => void; onPriorityChange: (cardIds: typeof save.loadout.autoplayPriority) => void; onFeedback: (message: string) => void }) {
  return <section className="character-stage spell-stage" aria-label="术法与自动优先级"><StageHeader eyebrow="SPELLBOOK" title="术法构筑" tags={summary.tags} /><p className="feature-intro">起始牌决定每场战斗的循环；同一套顺序用于手动提示与自动出牌。拖动槽位可替换，优先级使用右侧拖拽或上下按钮调整。</p><div className="spell-slot-grid">{(['card_0', 'card_1', 'card_2', 'card_3', 'card_4', 'card_5'] as LoadoutSlotId[]).map((slot) => <DroppableSlot key={slot} save={save} slot={slot} label={`术法 ${Number(slot.at(-1)) + 1}`} selected={selectedSlot === slot} readOnly={readOnly} onSelect={() => onSelectSlot(slot)} />)}</div><div className="spell-priority"><div className="subsection-heading"><div><small>AUTOPLAY ORDER</small><h4>自动出牌次序</h4></div><span>6 张</span></div><PriorityList cardIds={save.loadout.autoplayPriority} onChange={onPriorityChange} /></div><div className="alternate-skills"><strong>备选术法</strong>{COLLECTION.filter((item) => item.category === 'card' && save.ownedIds.includes(item.id) && !save.loadout.cardIds.includes(item.id as typeof save.loadout.cardIds[number])).slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => { onSelectSlot(targetSlotFor(save, item.id) ?? 'card_0'); onFeedback(`已选中「${item.name}」，可从详情区装备到起始牌槽。`) }}>{item.name}</button>)}</div></section>
}

export function CharacterPage({ save, onSaveChange, readOnly = false, readOnlyReason, onEnterBattle, combatPreview }: CharacterPageProps) {
  const summary = useMemo(() => getLoadoutSummary(save), [save])
  const [selectedId, setSelectedId] = useState<string>(save.loadout.weaponId)
  const [selectedSlot, setSelectedSlot] = useState<LoadoutSlotId>('weapon')
  const [activeTab, setActiveTab] = useState<CharacterTab>('loadout')
  const [category, setCategory] = useState<typeof allCategories[number]>('all')
  const [tagFilter, setTagFilter] = useState<'all' | 'sword' | 'talisman' | 'spirit'>('all')
  const [rarityFilter, setRarityFilter] = useState<'all' | CollectibleDefinition['rarity']>('all')
  const [equippedOnly, setEquippedOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [feedback, setFeedback] = useState('点击收藏查看精确规则；拖入对应槽位即可装备。')
  const equipped = useMemo(() => loadoutIds(save), [save])
  const detail = getEntityDetail(selectedId, save)
  const tab = characterTabs.find((item) => item.id === activeTab) ?? characterTabs[0]
  const visibleCategory = tab.categories.includes(category as CollectionCategory) ? category : 'all'
  const ownedCount = tab.categories.reduce((count, itemCategory) => count + COLLECTION.filter((item) => item.category === itemCategory && save.ownedIds.includes(item.id)).length, 0)
  const items = useMemo(() => COLLECTION.filter((item) => save.ownedIds.includes(item.id) && (visibleCategory === 'all' ? tab.categories.includes(item.category) : item.category === visibleCategory) && (tagFilter === 'all' || item.tags.includes(tagFilter)) && (rarityFilter === 'all' || item.rarity === rarityFilter) && (!equippedOnly || equipped.has(item.id)) && (!query.trim() || `${item.name} ${item.summary} ${item.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))), [equipped, equippedOnly, query, rarityFilter, save.ownedIds, tab.categories, tagFilter, visibleCategory])

  const selectItem = (id: string) => {
    setSelectedId(id)
    const slot = targetSlotFor(save, id)
    if (slot) setSelectedSlot(slot)
  }

  const emitLoadout = (result: LoadoutChangeResult, oldId?: string, newId = selectedId) => {
    if (!result.changed) { setFeedback(result.error ?? '配置没有变化。'); return }
    onSaveChange(result)
    setSelectedId(newId)
    setFeedback(oldId ? `已将「${COLLECTION_BY_ID[oldId]?.name ?? oldId}」替换为「${COLLECTION_BY_ID[newId]?.name ?? newId}」。` : '配装已更新，战斗会使用新的规则。')
  }

  const equipSelected = (slot = targetSlotFor(save, selectedId, selectedSlot)) => {
    if (!slot) { setFeedback('没有兼容槽位。'); return }
    const oldId = currentSlotIds(save, slot)
    emitLoadout(applyLoadoutChange(save, slot, selectedId), oldId, selectedId)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return
    if (readOnly) { setFeedback('当前状态只读，换装将在本局结束后开放。'); return }
    const source = String(event.operation.source?.id ?? '')
    const target = String(event.operation.target?.id ?? '')
    if (!target.startsWith('slot:')) return
    const slot = target.slice(5) as LoadoutSlotId
    if (source.startsWith('slot:')) {
      const sourceSlot = source.slice(5) as LoadoutSlotId
      const result = swapLoadoutSlots(save, sourceSlot, slot)
      if (!result.changed) setFeedback(result.error ?? '槽位没有变化。')
      else { onSaveChange(result); setFeedback(`已交换${SLOT_LABELS[sourceSlot] ?? '槽位'}与${SLOT_LABELS[slot] ?? '槽位'}。`) }
      return
    }
    if (!source.startsWith('item:')) return
    const id = source.slice(5)
    const oldId = currentSlotIds(save, slot)
    emitLoadout(applyLoadoutChange(save, slot, id), oldId, id)
  }

  const onSelectSlot = (slot: LoadoutSlotId) => selectSlot(save, slot, setSelectedSlot, setSelectedId)
  const lockedMessage = readOnlyReason ?? '当前状态只读；劫境或待领取报告结束后可调整配装。'
  const categoryOptions = ['all', ...tab.categories] as Array<typeof allCategories[number]>
  return <main className="paper-page character-page">
    <header className="page-heading character-heading"><div><small>CHARACTER · LOADOUT · INVENTORY</small><h2>角色与行囊</h2></div><div className="character-heading-actions"><span className="build-badge">{summary.buildName}</span><button type="button" disabled={readOnly} title={readOnly ? lockedMessage : undefined} onClick={() => onEnterBattle?.()}>{readOnly ? '当前不可试法' : '携此阵试法'}</button></div></header>
    <p className="character-guide" role="note"><span aria-hidden="true">✦</span>{readOnly ? lockedMessage : '角色页集中管理真实槽位；点击物品查看规则，拖入兼容槽位装备。'}<button type="button" aria-label="关闭操作提示" onClick={(event) => { event.currentTarget.parentElement?.remove() }}>×</button></p>
    <nav className="character-tabs" aria-label="角色管理分页" role="tablist">{characterTabs.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={activeTab === entry.id} className={activeTab === entry.id ? 'is-active' : ''} onClick={() => { setActiveTab(entry.id); setCategory('all'); const first = COLLECTION.find((item) => entry.categories.includes(item.category) && save.ownedIds.includes(item.id)); if (first) selectItem(first.id) }}><small>{entry.eyebrow}</small><strong>{entry.label}</strong><span>{entry.id === 'loadout' ? '六主槽' : entry.id === 'spirits' ? '双妖灵' : entry.id === 'utility' ? '法宝 · 行用' : '六张起始牌'}</span></button>)}</nav>
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="character-layout">
        <DetailPanel detail={detail} save={save} selectedSlot={selectedSlot} readOnly={readOnly} readOnlyReason={lockedMessage} combatPreview={combatPreview} onEquip={() => equipSelected()} onSaveChange={onSaveChange} onFeedback={setFeedback} />
        {activeTab === 'loadout' && <EquipmentStage save={save} summary={summary} readOnly={readOnly} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} preview={combatPreview} />}
        {activeTab === 'spirits' && <SpiritsStage save={save} summary={summary} readOnly={readOnly} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} />}
        {activeTab === 'utility' && <UtilityStage save={save} summary={summary} readOnly={readOnly} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} />}
        {activeTab === 'spells' && <SpellsStage save={save} summary={summary} readOnly={readOnly} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} onPriorityChange={(cardIds) => { if (readOnly) { setFeedback('当前状态只读，优先级将在本局结束后开放。'); return }; const result = reorderLoadoutPriority(save, cardIds); if (result.changed) { onSaveChange(result); setFeedback('自动出牌优先级已保存。') } else setFeedback(result.error ?? '优先级没有变化。') }} onFeedback={setFeedback} />}
        <aside className="character-inventory"><div className="inventory-heading"><div><small>COLLECTION STORAGE</small><h3>{tab.label}背包</h3></div><strong>{items.length}<small> / {ownedCount}</small></strong></div><div className="inventory-filters"><input aria-label="搜索收藏" placeholder="搜索名称、效果或标签" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="标签筛选" value={tagFilter} onChange={(event) => setTagFilter(event.target.value as typeof tagFilter)}><option value="all">全部标签</option><option value="sword">剑意</option><option value="talisman">符咒</option><option value="spirit">御灵</option></select><select aria-label="稀有度筛选" value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as typeof rarityFilter)}><option value="all">全部稀有度</option>{Object.entries(rarityNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div><div className="inventory-category-tabs">{categoryOptions.map((id) => <button type="button" key={id} className={visibleCategory === id ? 'is-active' : ''} onClick={() => setCategory(id)}>{id === 'all' ? '全部' : categoryNames[id as CollectionCategory]}<small>{id === 'all' ? ownedCount : COLLECTION.filter((item) => item.category === id && save.ownedIds.includes(item.id)).length}</small></button>)}</div><label className="equipped-filter"><input type="checkbox" checked={equippedOnly} onChange={(event) => setEquippedOnly(event.target.checked)} />只看已装备</label><div className="inventory-grid">{items.length ? items.map((item) => <DraggableItem key={item.id} item={item} level={save.levels[item.id] ?? 1} selected={selectedId === item.id} equipped={equipped.has(item.id)} readOnly={readOnly} onSelect={() => selectItem(item.id)} />) : <p className="empty-inventory">没有符合筛选条件的已拥有收藏。</p>}</div><p className="inventory-feedback" role="status" aria-live="polite">{feedback}</p></aside>
      </div>
    </DragDropProvider>
  </main>
}
