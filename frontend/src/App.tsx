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
  fetchUniverseData, buildTimelineGraph, isForkClickable,
} from './utils/loadMasterTimeline'
import { setNebulaCenter } from './data/keyPlayers'
import { resolveCareerMilestones } from './data/careerMilestones'

/** Survives React Strict Mode remount — prevents duplicate James graph builds. */
let timelineInitDone = false

export default function App() {
  const addNode = useStore((s) => s.addNode)
  const addEdge = useStore((s) => s.addEdge)
  const nodes = useStore((s) => s.nodes)
  const npcTimelineNodes = useStore((s) => s.npcTimelineNodes)
  const completedForks = useStore((s) => s.completedForks)
  const initPlayerConstellation = useStore((s) => s.initPlayerConstellation)
  const initUniverse = useStore((s) => s.initUniverse)
  const rebuildNpcTimelines = useStore((s) => s.rebuildNpcTimelines)
  const loadStarted = useRef(false)

  useEffect(() => {
    initPlayerConstellation()
    rebuildNpcTimelines()
  }, [initPlayerConstellation, rebuildNpcTimelines])

  useEffect(() => {
    if (timelineInitDone || loadStarted.current) return
    loadStarted.current = true

    fetchUniverseData()
      .then((data) => {
        const milestones = resolveCareerMilestones(data.career_milestones)
        useStore.setState({ careerMilestones: milestones })

        if (data.world_state?.universe_id) {
          initUniverse({ ...data, career_milestones: milestones })
        } else if (data.available_forks?.length) {
          useStore.setState({ availableForks: data.available_forks })
        }

        if (useStore.getState().nodes.length === 0) {
          const centerX = buildTimelineGraph(
            data,
            useStore.getState().completedForks,
            addNode,
            addEdge,
          )
          setNebulaCenter(centerX, 1.2, 0)
        } else {
          const centerX = (useStore.getState().nodes.length * 1.5) / 2
          setNebulaCenter(centerX, 1.2, 0)
        }

        initPlayerConstellation()
        rebuildNpcTimelines()
        timelineInitDone = true

        cameraBridge.resetView?.()
      })
      .catch((err) => {
        console.error('[timeline] failed to load James timeline', err)
        initPlayerConstellation()
        rebuildNpcTimelines()
        useStore.getState().setStatusText(
          '⚠️ 时间线加载失败',
          '请确认后端已启动 (python main.py) 后刷新页面',
        )
        loadStarted.current = false
      })
  }, [addNode, addEdge, initUniverse, initPlayerConstellation, rebuildNpcTimelines])

  useEffect(() => {
    if (nodes.length === 0) return
    if (npcTimelineNodes.length === 0) {
      rebuildNpcTimelines()
    }
    useStore.setState((s) => ({
      nodes: s.nodes.map((n) =>
        n.type === 'fork'
          ? { ...n, isClickable: isForkClickable(n.id, completedForks) }
          : n,
      ),
    }))
  }, [completedForks, nodes.length, npcTimelineNodes.length, rebuildNpcTimelines])

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
