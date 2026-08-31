import { describe, expect, it } from 'vitest'
import { CHAPTERS, STAGES, getChapterRouteSegments, getUnlockedChapters } from '../content/stages'
import { getChapterMapVisualCue } from './ChapterMapScene'

const EXPECTED_POSITIONS = [
  [[8, 78], [18, 67], [29, 73], [39, 58], [50, 64], [60, 49], [69, 54], [78, 37], [88, 43], [92, 20]],
  [[7, 55], [17, 43], [28, 50], [37, 33], [47, 41], [58, 26], [67, 37], [77, 24], [86, 33], [94, 16]],
  [[8, 22], [18, 34], [29, 27], [39, 44], [50, 37], [60, 55], [70, 48], [79, 65], [88, 58], [94, 79]],
]

describe('chapter map content', () => {
  it('defines three contiguous ten-stage chapters with the approved coordinates', () => {
    expect(CHAPTERS).toHaveLength(3)
    expect(CHAPTERS.map(({ startStage, endStage, unlockAfterStage }) => [startStage, endStage, unlockAfterStage])).toEqual([[1, 10, 0], [11, 20, 10], [21, 30, 20]])
    for (const [chapterIndex, chapter] of CHAPTERS.entries()) {
      const stages = STAGES.filter((stage) => stage.regionId === chapter.id)
      expect(stages).toHaveLength(10)
      expect(stages.map(({ mapPosition }) => [mapPosition.x, mapPosition.y])).toEqual(EXPECTED_POSITIONS[chapterIndex])
      expect(stages.every(({ mapPosition }) => mapPosition.x >= 0 && mapPosition.x <= 100 && mapPosition.y >= 0 && mapPosition.y <= 100)).toBe(true)
    }
  })

  it('keeps each chapter route linear and continuous', () => {
    for (const chapter of CHAPTERS) {
      const route = getChapterRouteSegments(chapter)
      expect(route).toHaveLength(9)
      expect(route[0].fromStage).toBe(chapter.startStage)
      expect(route.at(-1)?.toStage).toBe(chapter.endStage)
      route.forEach((segment, index) => {
        expect(segment.toStage).toBe(segment.fromStage + 1)
        expect(segment.from).toEqual(STAGES.find((stage) => stage.stageNumber === segment.fromStage)?.mapPosition)
        expect(segment.to).toEqual(STAGES.find((stage) => stage.stageNumber === segment.toStage)?.mapPosition)
        expect(segment.fromStage).toBe(chapter.startStage + index)
      })
    }
  })

  it('derives chapter unlocks at the 0/10/20 boundaries', () => {
    expect(getUnlockedChapters({ highestClearedStage: 0 }).map(({ id }) => id)).toEqual(['mist_road'])
    expect(getUnlockedChapters({ highestClearedStage: 9 }).map(({ id }) => id)).toEqual(['mist_road'])
    expect(getUnlockedChapters({ highestClearedStage: 10 }).map(({ id }) => id)).toEqual(['mist_road', 'ruined_waystation'])
    expect(getUnlockedChapters({ highestClearedStage: 19 }).map(({ id }) => id)).toEqual(['mist_road', 'ruined_waystation'])
    expect(getUnlockedChapters({ highestClearedStage: 20 }).map(({ id }) => id)).toEqual(['mist_road', 'ruined_waystation', 'huai_roots'])
  })

  it('creates deterministic Pixi map cues without random state', () => {
    const cueA = getChapterMapVisualCue(CHAPTERS[1], 15)
    const cueB = getChapterMapVisualCue(CHAPTERS[1], 15)
    expect(cueA).toEqual(cueB)
    expect(cueA.route).toHaveLength(9)
    expect(cueA.dust).toHaveLength(12)
    expect(cueA.pulseStage).toBe(15)
    expect(cueA.animated).toBe(true)
    expect(getChapterMapVisualCue(CHAPTERS[1], 5).pulseStage).toBeUndefined()
    expect(getChapterMapVisualCue(CHAPTERS[1], 15, true)).toMatchObject({ dust: [], pulseStage: 15, animated: false })
  })
})

