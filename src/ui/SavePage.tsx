import { useState } from 'react'
import { parseSave, type PlayerSave } from '../state/player'

export function SavePage({ save, setSave, onNewJourney }: { save: PlayerSave; setSave: (next: PlayerSave) => void; onNewJourney: () => void }) {
  const [text, setText] = useState(() => JSON.stringify(save, null, 2))
  const [message, setMessage] = useState('当前进度已自动保存在此浏览器。')
  const [confirmNew, setConfirmNew] = useState(false)
  const importSave = () => { const parsed = parseSave(text, Date.now()); if (!parsed.success) { setMessage('导入失败：格式、版本或字段无效，当前存档未被覆盖。'); return }; setSave(parsed.data); setMessage('导入成功，当前存档已替换。') }
  return <main className="paper-page save-page"><header className="page-heading"><div><small>LOCAL ARCHIVE</small><h2>设置与存档</h2></div></header><section><p>{message}</p><textarea aria-label="JSON 存档" spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} /><div className="save-actions"><button type="button" onClick={() => { setText(JSON.stringify(save, null, 2)); setMessage('已将当前存档写入文本框。') }}>导出到文本框</button><button type="button" onClick={importSave}>验证并导入</button><button type="button" className="danger-action" onClick={() => setConfirmNew(true)}>新开正式旅程</button></div>{confirmNew && <div className="new-journey-confirm" role="alertdialog" aria-labelledby="new-journey-title"><h3 id="new-journey-title">舍弃当前主存档？</h3><p>当前收藏、等级、资源与主线进度会被正式炼气开局替换。请先导出存档。</p><button type="button" onClick={() => setConfirmNew(false)}>取消</button><button type="button" className="danger-action" onClick={() => { onNewJourney(); setConfirmNew(false); setMessage('正式旅程已经开始。') }}>确认新开</button></div>}</section></main>
}
