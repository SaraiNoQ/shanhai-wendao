import { DragDropProvider } from '@dnd-kit/react'
import { isSortableOperation, useSortable } from '@dnd-kit/react/sortable'
import { PROTOTYPE_CONTENT } from '../content/prototype'
import type { CardId } from '../game/types'

interface PriorityListProps {
  cardIds: CardId[]
  onChange: (cardIds: CardId[]) => void
}

interface SortableCardProps {
  cardId: CardId
  index: number
  total: number
  onMove: (from: number, to: number) => void
}

function SortableCard({ cardId, index, total, onMove }: SortableCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: cardId,
    index,
    group: 'autoplay-priority',
  })
  const card = PROTOTYPE_CONTENT.cards[cardId]

  return (
    <li ref={(node) => ref(node)} className={isDragging ? 'priority-item is-dragging' : 'priority-item'}>
      <button
        ref={(node) => handleRef(node)}
        type="button"
        className="drag-handle"
        aria-label={`拖动${card.name}`}
        title="拖动排序"
      >
        ⠿
      </button>
      <span className="priority-number">{index + 1}</span>
      <span className="priority-name">{card.name}</span>
      <span className="priority-cost">{card.cost}</span>
      <span className="priority-buttons">
        <button
          type="button"
          aria-label={`${card.name}上移`}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`${card.name}下移`}
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
        >
          ↓
        </button>
      </span>
    </li>
  )
}

export function PriorityList({ cardIds, onChange }: PriorityListProps) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= cardIds.length || from === to) return
    const next = [...cardIds]
    const [cardId] = next.splice(from, 1)
    next.splice(to, 0, cardId)
    onChange(next)
  }

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled || !isSortableOperation(event.operation)) return
        const source = event.operation.source
        const target = event.operation.target
        if (source && target) move(source.initialIndex, target.index)
      }}
    >
      <ol className="priority-list" aria-label="自动出牌优先级">
        {cardIds.map((cardId, index) => (
          <SortableCard
            key={cardId}
            cardId={cardId}
            index={index}
            total={cardIds.length}
            onMove={move}
          />
        ))}
      </ol>
    </DragDropProvider>
  )
}
