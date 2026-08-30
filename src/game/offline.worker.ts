import { simulateCampaign } from './campaign'
import type { PlayerSave } from '../state/player'

self.onmessage = (event: MessageEvent<{ save: PlayerSave; elapsedMs: number; nowMs: number }>) => {
  const { save, elapsedMs, nowMs } = event.data
  self.postMessage(simulateCampaign(save, elapsedMs, nowMs))
}
