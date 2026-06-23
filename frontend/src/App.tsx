import { useEffect, useRef } from 'react'
import { useStore } from './store'
import ThreeCanvas from './engine/ThreeCanvas'
import ChoiceWheel from './components/ChoiceWheel'
import InputLockOverlay from './components/InputLockOverlay'
import EventNarrativePanel from './components/EventNarrativePanel'
import HexagramRadar from './components/HexagramRadar'
import SocialFeed from './components/SocialFeed'
import FateLeaderboard from './components/FateLeaderboard'
import ButterflyEffectPanel from './components/ButterflyEffectPanel'
import StatusBar from './components/StatusBar'
import PlayerColorLegend from './components/PlayerColorLegend'
import { cameraBridge } from './engine/CameraController'
import {
  fetchUniverseData, buildTimelineGraph,
} from './utils/loadMasterTimeline'
import { rehydrateParallelBranches } from './utils/rehydrateUniverse'
import { setNebulaCenter } from './data/keyPlayers'
import { resolveCareerMilestones } from './data/careerMilestones'

async function bootstrapTimeline(): Promise<void> {
  const data = await fetchUniverseData()
  const milestones = resolveCareerMilestones(data.career_milestones)
  useStore.setState({ careerMilestones: milestones })

  if (data.world_state?.universe_id) {
    useStore.getState().initUniverse({ ...data, career_milestones: milestones })
  } else if (data.available_forks?.length) {
    useStore.setState({ availableForks: data.available_forks })
  }

  if (useStore.getState().nodes.length === 0) {
    const centerX = buildTimelineGraph(
      data,
      useStore.getState().completedForks,
      useStore.getState().addNode,
      useStore.getState().addEdge,
    )
    setNebulaCenter(centerX, 1.2, 0)
  } else {
    const centerX = (useStore.getState().nodes.length * 1.5) / 2
    setNebulaCenter(centerX, 1.2, 0)
  }

  useStore.getState().initPlayerConstellation()
  useStore.getState().rebuildNpcTimelines()
  await rehydrateParallelBranches()
  useStore.getState().reconcileParallelForks()
  cameraBridge.resetView?.()
}

export default function App() {
  const nodes = useStore((s) => s.nodes)
  const npcTimelineNodes = useStore((s) => s.npcTimelineNodes)
  const completedForks = useStore((s) => s.completedForks)
  const initPlayerConstellation = useStore((s) => s.initPlayerConstellation)
  const rebuildNpcTimelines = useStore((s) => s.rebuildNpcTimelines)
  const reconcileParallelForks = useStore((s) => s.reconcileParallelForks)
  const bootstrapGen = useRef(0)

  useEffect(() => {
    initPlayerConstellation()
    rebuildNpcTimelines()
  }, [initPlayerConstellation, rebuildNpcTimelines])

  useEffect(() => {
    const gen = ++bootstrapGen.current

    bootstrapTimeline()
      .catch((err) => {
        if (gen !== bootstrapGen.current) return
        console.error('[timeline] failed to load James timeline', err)
        initPlayerConstellation()
        rebuildNpcTimelines()
        useStore.getState().setStatusText(
          '⚠️ 时间线加载失败',
          '请确认后端已启动 (python main.py) 后刷新页面',
        )
      })

    const onReset = () => {
      const resetGen = ++bootstrapGen.current
      useStore.getState().resetGraph()
      bootstrapTimeline().catch((err) => {
        if (resetGen !== bootstrapGen.current) return
        console.error('[timeline] failed to rebuild after reset', err)
      })
    }
    window.addEventListener('nba-universe-reset', onReset)
    return () => window.removeEventListener('nba-universe-reset', onReset)
  }, [initPlayerConstellation, rebuildNpcTimelines])

  useEffect(() => {
    if (nodes.length === 0) return
    if (npcTimelineNodes.length === 0) {
      rebuildNpcTimelines()
    }
    reconcileParallelForks()
  }, [completedForks, nodes.length, npcTimelineNodes.length, rebuildNpcTimelines, reconcileParallelForks])

  return (
    <>
      <ThreeCanvas />
      <InputLockOverlay />
      <ChoiceWheel />
      <EventNarrativePanel />
      <HexagramRadar />
      <SocialFeed />
      <FateLeaderboard />
      <ButterflyEffectPanel />
      <StatusBar />
      <PlayerColorLegend />
    </>
  )
}
