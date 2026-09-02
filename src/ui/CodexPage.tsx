import { useState } from 'react'
import { COLLECTION, COLLECTION_BY_ID, type CollectionCategory, type CollectibleDefinition } from '../content/collection'
import { assetOrientation, assetUrl } from '../content/assets'
import { FORGE_NODES } from '../content/forging'
import { getEntityDetail } from '../content/details'
import { LORE_ENTRIES } from '../content/lore'
import { ESSENCE_NAMES, markLoreRead, type PlayerSave } from '../state/player'
import { getForgeTier } from '../state/forging'

const categoryNames: Record<CollectionCategory, string> = { weapon: '武器', equipment: '装备', technique: '功法', card: '术法', treasure: '法宝', consumable: '配方', spirit: '妖灵' }
const rarityNames = { common: '凡品', uncommon: '珍品', rare: '秘品', legacy: '传承' }

function levelCap(item: CollectibleDefinition, save: PlayerSave) {
  return item.id in FORGE_NODES && getForgeTier(save, item.id) === 2 ? 20 : 10
}

function artClass(artKey: string) {
  return `is-${assetOrientation(artKey) ?? 'square'}`
}

function ArtImage({ artKey, alt, className = '', loading = 'lazy' }: { artKey: string; alt: string; className?: string; loading?: 'lazy' | 'eager' }) {
  const src = assetUrl(artKey)
  if (!src) return null
  return <img className={`${className} ${artClass(artKey)}`.trim()} src={src} alt={alt} loading={loading} decoding="async" />
}

function CollectionCard({ item, owned, active, level, cap, onSelect }: { item: CollectibleDefinition; owned: boolean; active: boolean; level: number; cap: number; onSelect: () => void }) {
  return <button type="button" className={`collection-card rarity-${item.rarity} ${active ? 'is-active' : ''} ${owned ? '' : 'is-locked'}`} onClick={onSelect}>
    <span>{categoryNames[item.category]} · {owned ? rarityNames[item.rarity] : '未收录'}</span>
    <span className={`collection-card-art ${owned ? artClass(item.artKey) : 'is-placeholder'}`} aria-hidden="true">
      {owned ? <ArtImage artKey={item.artKey} alt="" /> : <i>？</i>}
    </span>
    <strong>{owned ? item.name : '未知收藏'}</strong>
    <small>{owned ? `Lv.${level} / ${cap}` : item.unlockSource}</small>
  </button>
}

function LoreCard({ entry, discovered, read, onRead }: { entry: (typeof LORE_ENTRIES)[number]; discovered: boolean; read: boolean; onRead: () => void }) {
  return <button type="button" className={`lore-card ${discovered ? 'is-discovered' : 'is-locked'} ${read ? '' : 'is-unread'}`} onClick={() => discovered && onRead()}>
    <span>{entry.kind === 'enemy' ? entry.rank === 'boss' ? '首领' : entry.rank === 'elite' ? '精英' : '异物' : '怪谈'}</span>
    {discovered && <div className={`lore-card-art ${artClass(entry.artKey)}`} aria-hidden="true"><ArtImage artKey={entry.artKey} alt="" /></div>}
    <strong>{discovered ? entry.name : '未识之物'}</strong>
    <small>{discovered ? entry.title : '在古道中相遇后解锁'}</small>
    <p>{discovered ? entry.lore : '墨雾遮住了这段记载。'}</p>
    {discovered && !read && <em>新发现 · 点击阅览</em>}
  </button>
}

function LoreView({ save, setSave, setView }: { save: PlayerSave; setSave: (next: PlayerSave) => void; setView: (view: 'collection' | 'lore') => void }) {
  return <main className="paper-page codex-page">
    <header className="page-heading"><div><small>BESTIARY & TALES</small><h2>志怪录</h2></div><p>{save.discoveredLoreIds.length} / {LORE_ENTRIES.length} 已发现</p></header>
    <nav className="category-tabs codex-view-tabs" aria-label="图鉴视图"><button type="button" className="is-active" onClick={() => setView('lore')}>志怪录</button><button type="button" onClick={() => setView('collection')}>万象图鉴</button></nav>
    <section className="lore-grid">{LORE_ENTRIES.map((entry) => <LoreCard key={entry.id} entry={entry} discovered={save.discoveredLoreIds.includes(entry.id)} read={save.readLoreIds.includes(entry.id)} onRead={() => setSave(markLoreRead(save, entry.id))} />)}</section>
  </main>
}

export function CodexPage({ save, setSave }: { save: PlayerSave; setSave: (next: PlayerSave) => void }) {
  const [view, setView] = useState<'collection' | 'lore'>('collection')
  const [category, setCategory] = useState<CollectionCategory>('weapon')
  const items = COLLECTION.filter((item) => item.category === category)
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? COLLECTION[0].id)
  if (view === 'lore') return <LoreView save={save} setSave={setSave} setView={setView} />

  const selected = COLLECTION_BY_ID[selectedId]?.category === category ? COLLECTION_BY_ID[selectedId] : items[0]
  const owned = save.ownedIds.includes(selected.id)
  const selectedCap = levelCap(selected, save)
  const selectedLevel = save.levels[selected.id] ?? 1
  const detail = getEntityDetail(selected.id, save)
  return <main className="paper-page codex-page">
    <header className="page-heading"><div><small>CATALOGUE OF ODDITIES</small><h2>万象图鉴</h2></div><p>{save.ownedIds.length} / {COLLECTION.length} 已收录</p></header>
    <nav className="category-tabs codex-view-tabs" aria-label="图鉴视图"><button type="button" className="is-active" onClick={() => setView('collection')}>万象图鉴</button><button type="button" onClick={() => setView('lore')}>志怪录 <small>{save.discoveredLoreIds.length}/{LORE_ENTRIES.length}</small></button></nav>
    <nav className="category-tabs" aria-label="收藏类别">{(Object.keys(categoryNames) as CollectionCategory[]).map((id) => <button type="button" key={id} className={category === id ? 'is-active' : ''} onClick={() => { setCategory(id); setSelectedId(COLLECTION.find((item) => item.category === id)!.id) }}>{categoryNames[id]}<small>{COLLECTION.filter((item) => item.category === id).length}</small></button>)}</nav>
    <div className="codex-layout">
      <section className="collection-grid">{items.map((item) => { const itemOwned = save.ownedIds.includes(item.id); return <CollectionCard key={item.id} item={item} owned={itemOwned} active={selected.id === item.id} level={save.levels[item.id] ?? 1} cap={levelCap(item, save)} onSelect={() => setSelectedId(item.id)} /> })}</section>
      <aside className={`collection-detail ${owned ? '' : 'is-locked'}`}>
        <span className="rarity-mark">{categoryNames[selected.category]} · {rarityNames[selected.rarity]}</span>
        {owned ? <div className={`collection-detail-art ${artClass(selected.artKey)}`}><ArtImage artKey={selected.artKey} alt="" /></div> : <div className="collection-detail-art is-locked-placeholder" aria-hidden="true">？</div>}
        <h3>{selected.name}</h3>
        <div className="detail-level"><strong>{owned ? `Lv.${selectedLevel}` : '未收录'}</strong><span>{owned ? `/ ${selectedCap}` : ''}</span></div>
        <p className="effect-copy">{owned ? selected.summary : '继续游历以收录此物；详细规则将在获得后展开。'}</p>
        <div className="tag-list">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        {owned && detail?.currentStats.length ? <dl className="detail-facts">{detail.currentStats.map((stat, index) => <div key={`${stat.label}-${index}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl> : null}
        {owned && detail?.nextLevelStats?.length ? <section className="detail-rules"><h4>下一级预览</h4>{detail.nextLevelStats.map((entry, index) => <p key={`${entry.label}-${index}`}><strong>{entry.label}</strong>{entry.value}{entry.delta ? `（${entry.delta}）` : ''}</p>)}</section> : null}
        {owned && detail?.mechanics.length ? <section className="detail-rules"><h4>规则说明</h4>{detail.mechanics.map((entry, index) => <p key={`${entry.label}-${index}`}><strong>{entry.label}</strong>{entry.value}</p>)}</section> : null}
        <blockquote>{selected.lore}</blockquote>
        <dl><div><dt>来源</dt><dd>{selected.unlockSource}</dd></div><div><dt>重复转化</dt><dd>{selected.duplicateEssence} {ESSENCE_NAMES[selected.essenceType]}</dd></div></dl>
        <p className="locked-note">升级、重置、重铸和装备操作已集中到“角色”页面。</p>
      </aside>
    </div>
  </main>
}
