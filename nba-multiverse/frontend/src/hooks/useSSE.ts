import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'
import { particleBridge } from '../engine/ParticleSystem'
import { cameraBridge } from '../engine/CameraController'
import { shockwaveBridge } from '../engine/ShockwaveSystem'
import { resolveEventImpacts, resolveCareerEvents, playerNameZh } from '../utils/inferPlayerImpact'
import { computeChoiceRipple, computeChoiceCareerRipple } from '../utils/choiceButterfly'
import { isForkClickable } from '../utils/loadMasterTimeline'
import {
  getBackendMode, generateStreamUrl, streamCustomBranch,
  recordChoiceIfAvailable,
} from '../utils/apiClient'
import type {
  TimelineEventPayload, StatUpdatePayload, SocialPostPayload,
  GraphNode, SocialPost, RPGSixDimensions, ChoiceData, PlayerFateDelta,
} from '../types'

const DIMENSION_MAP: Record<string, keyof RPGSixDimensions> = {
  championships: 'championships',
  legacy: 'legacy',
  media_favor: 'mediaFavor',
  fan_reputation: 'fanReputation',
  cap_health: 'capHealth',
  physical_toll: 'physicalToll',
}

function mapDimension(snake: string): keyof RPGSixDimensions {
  return DIMENSION_MAP[snake] ?? (snake as keyof RPGSixDimensions)
}

const FORK_ORDER = ['evt_lebron_2010', 'evt_lebron_2014', 'evt_lebron_2017', 'evt_lebron_2018']

export function useSSE() {
  const esRef = useRef<EventSource | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const nodeCounter = useRef(0)
  const triedLegacyRef = useRef(false)

  const addNode = useStore((s) => s.addNode)
  const addEdge = useStore((s) => s.addEdge)
  const setMasterBrightness = useStore((s) => s.setMasterBrightness)
  const hideMasterTailAfterFork = useStore((s) => s.hideMasterTailAfterFork)
  const applyStatDelta = useStore((s) => s.applyStatDelta)
  const pushPost = useStore((s) => s.pushPost)
  const pushNarrative = useStore((s) => s.pushNarrative)
  const applyPlayerImpacts = useStore((s) => s.applyPlayerImpacts)
  const addRippleEdges = useStore((s) => s.addRippleEdges)
  const setPulsingPlayers = useStore((s) => s.setPulsingPlayers)
  const setPhase = useStore((s) => s.setPhase)
  const setInputLocked = useStore((s) => s.setInputLocked)
  const setStatusText = useStore((s) => s.setStatusText)
  const setActiveBranchId = useStore((s) => s.setActiveBranchId)
  const setActiveTeamColor = useStore((s) => s.setActiveTeamColor)
  const clearNarrative = useStore((s) => s.clearNarrative)
  const setActiveChoiceLabel = useStore((s) => s.setActiveChoiceLabel)
  const pushPlayerCareerEvents = useStore((s) => s.pushPlayerCareerEvents)
  const takeSnapshot = useStore((s) => s.takeSnapshot)
  const triggerRollback = useStore((s) => s.triggerRollback)
  const recordJamesChoice = useStore((s) => s.recordJamesChoice)
  const markForkCompleted = useStore((s) => s.markForkCompleted)
  const refreshAvailableForks = useStore((s) => s.refreshAvailableForks)
  const syncWorldStateToBackend = useStore((s) => s.syncWorldStateToBackend)
  const appendNpcParallelFromImpact = useStore((s) => s.appendNpcParallelFromImpact)
  const markNpcParallelLatest = useStore((s) => s.markNpcParallelLatest)
  const getForkLabel = useStore((s) => s.getForkLabel)
  const setHighlightedForkId = useStore((s) => s.setHighlightedForkId)

  function dispatchPlayerRipple(
    sourceId: string,
    sourcePos: THREE.Vector3,
    impacts: PlayerFateDelta[],
    teamColor: string,
    meta: { source: 'choice' | 'event'; eventTitle?: string; forkId?: string; forkLabel?: string },
  ) {
    if (impacts.length === 0) return

    applyPlayerImpacts(impacts, meta)
    const playerIds = impacts.map((i) => i.playerId)
    addRippleEdges(sourceId, playerIds, teamColor)

    const stars = useStore.getState().playerStars
    const targets = playerIds
      .map((id) => {
        const star = stars.find((s) => s.id === id)
        return star
          ? new THREE.Vector3(star.position.x, star.position.y, star.position.z)
          : null
      })
      .filter((v): v is THREE.Vector3 => v !== null)

    shockwaveBridge.ripple?.(sourcePos, targets, teamColor)

    const sorted = [...impacts].sort((a, b) => {
      const swingA = Math.abs(a.legacy) + Math.abs(a.ringChance) + Math.abs(a.mediaHeat) + Math.abs(a.teamFit)
      const swingB = Math.abs(b.legacy) + Math.abs(b.ringChance) + Math.abs(b.mediaHeat) + Math.abs(b.teamFit)
      return swingB - swingA
    })
    const topIds = sorted.slice(0, 5).map((i) => i.playerId)
    const topTargets = topIds
      .map((id) => stars.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => new THREE.Vector3(s!.position.x, s!.position.y, s!.position.z))
    if (topTargets.length > 0) {
      shockwaveBridge.ripple?.(sourcePos, topTargets, teamColor)
    }

    const names = playerIds.slice(0, 3).map(playerNameZh).join('、')
    setStatusText(
      meta.eventTitle ?? useStore.getState().statusText,
      meta.source === 'choice'
        ? `🦋 詹姆斯的选择冲击：${names}${playerIds.length > 3 ? '…' : ''}`
        : `🦋 命运波及：${names}${playerIds.length > 3 ? '…' : ''}`,
    )

    setTimeout(() => setPulsingPlayers([]), 1600)
  }

  function processStreamEvent(
    eventType: string,
    data: string,
    ctx: {
      forkId: string
      choiceId: string
      teamColor: string
      forkMeta: { forkId: string; forkLabel: string }
      lastNodeIdRef: { current: string | null }
      receivedRef: { current: boolean }
    },
  ) {
    const { forkId, choiceId, teamColor, forkMeta, lastNodeIdRef, receivedRef } = ctx

    if (eventType === 'timeline_event') {
      receivedRef.current = true
      const payload: TimelineEventPayload = JSON.parse(data)
      const nodeId = payload.event_id
      nodeCounter.current++

      const existing = useStore.getState().nodes
      const currentFork = existing.find((n) => n.id === forkId)
      const fx = currentFork?.position.x ?? 0
      const fy = currentFork?.position.y ?? 0
      const fz = currentFork?.position.z ?? 0

      const newPos = new THREE.Vector3(
        fx + nodeCounter.current * 1.85,
        fy + 0.35 + Math.sin(nodeCounter.current * 0.7) * 0.55,
        fz - 0.65 - nodeCounter.current * 0.35,
      )

      const newNode: GraphNode = {
        id: nodeId,
        type: 'event',
        label: payload.title,
        description: payload.description,
        timestamp: payload.timestamp,
        position: { x: newPos.x, y: newPos.y, z: newPos.z },
        color: teamColor,
        size: payload.confidence > 0.8 ? 0.7 : 0.45,
        parentId: choiceId,
        isRealHistory: false,
        isClickable: false,
        teamsAffected: payload.teams_affected,
      }

      pushNarrative({
        id: nodeId,
        timestamp: payload.timestamp,
        title: payload.title,
        description: payload.description || '平行宇宙正在展开……',
        teamColor,
        isBranch: true,
        teamsAffected: payload.teams_affected,
      })

      setStatusText(payload.title, `${payload.timestamp} · 平行宇宙事件 #${nodeCounter.current}`)

      const impacts = resolveEventImpacts(payload)
      if (impacts.length > 0) {
        dispatchPlayerRipple(nodeId, newPos, impacts, teamColor, {
          source: 'event', eventTitle: payload.title, ...forkMeta,
        })
      }

      const careerEvents = resolveCareerEvents(payload)
      const careerPlayerIds = new Set(careerEvents.map((e) => e.playerId))
      if (careerEvents.length > 0) {
        pushPlayerCareerEvents(careerEvents.map((ev) => ({ ...ev, forkId })))
      }

      for (const impact of impacts) {
        if (impact.playerId === 'lebron-james') continue
        if (careerPlayerIds.has(impact.playerId)) continue
        appendNpcParallelFromImpact(
          impact.playerId,
          {
            playerId: impact.playerId,
            timestamp: payload.timestamp,
            title: impact.reason.slice(0, 20) || payload.title.slice(0, 20),
            description: `因「${payload.title}」：${payload.description?.slice(0, 120) ?? impact.reason}`,
            vsRealHistory: '真实历史线与此不同',
            sourceEventTitle: payload.title,
          },
          nodeId,
          forkId,
        )
      }

      const sourceId = lastNodeIdRef.current ?? currentFork?.id
      lastNodeIdRef.current = nodeId

      const onNodeReady = () => {
        addNode(newNode)
        if (sourceId) {
          addEdge({
            id: `edge_${sourceId}_${nodeId}`,
            source: sourceId,
            target: nodeId,
            color: teamColor,
            thickness: 0.03,
            isParticleFlow: true,
          })
        }
        if (cameraBridge.flyToBranch && nodeCounter.current % 2 === 0) {
          cameraBridge.flyToBranch(newPos)
        }
      }

      if (particleBridge.coalesceAtPosition) {
        particleBridge.coalesceAtPosition(newPos, teamColor, onNodeReady)
      } else {
        onNodeReady()
      }
      return
    }

    if (eventType === 'stat_update') {
      receivedRef.current = true
      const stat: StatUpdatePayload = JSON.parse(data)
      applyStatDelta({
        dimension: mapDimension(stat.dimension),
        delta: stat.delta,
        reason: stat.reason,
      })
      if (stat.reason) {
        setStatusText(
          useStore.getState().statusText,
          `${stat.reason} (${stat.delta > 0 ? '+' : ''}${stat.delta})`,
        )
      }
      return
    }

    if (eventType === 'social_post') {
      receivedRef.current = true
      const postPayload: SocialPostPayload = JSON.parse(data)
      const post: SocialPost = {
        id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        username: postPayload.username,
        handle: postPayload.handle,
        avatarColor: postPayload.avatar_color || '#888',
        content: postPayload.content,
        sentiment: (postPayload.sentiment as SocialPost['sentiment']) || 'excited',
        timestamp: Date.now(),
      }
      pushPost(post)
      return
    }

    if (eventType === 'error') {
      const err = JSON.parse(data)
      throw new Error(err.message ?? '推演失败')
    }
  }

  function attachStreamHandlers(
    es: EventSource,
    forkId: string,
    choiceId: string,
    teamColor: string,
    forkLabel: string,
    forkMeta: { forkId: string; forkLabel: string },
    onFatalError: () => void,
  ) {
    const lastNodeIdRef = { current: null as string | null }
    const receivedRef = { current: false }
    const ctx = { forkId, choiceId, teamColor, forkMeta, lastNodeIdRef, receivedRef }

    es.addEventListener('timeline_event', (e: MessageEvent) => {
      processStreamEvent('timeline_event', e.data, ctx)
    })
    es.addEventListener('stat_update', (e: MessageEvent) => {
      processStreamEvent('stat_update', e.data, ctx)
    })
    es.addEventListener('social_post', (e: MessageEvent) => {
      processStreamEvent('social_post', e.data, ctx)
    })
    es.addEventListener('done', async () => {
      es.close()
      esRef.current = null
      await finishForkGeneration(forkId, forkLabel)
    })
    es.addEventListener('error', () => {
      if (useStore.getState().phase === 'complete') return
      if (!receivedRef.current && !triedLegacyRef.current) {
        onFatalError()
        return
      }
      es.close()
      esRef.current = null
      setStatusText('⚠️ 推演连接中断', '请检查后端是否运行 · 点击分叉点重试')
      setPhase('idle')
      setInputLocked(false)
      setMasterBrightness(1.0)
    })
  }

  async function openCustomStream(
    forkId: string,
    customText: string,
    choiceId: string,
    teamColor: string,
    forkLabel: string,
  ) {
    const forkMeta = { forkId, forkLabel }
    const lastNodeIdRef = { current: null as string | null }
    const receivedRef = { current: false }
    const ctx = { forkId, choiceId, teamColor, forkMeta, lastNodeIdRef, receivedRef }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamCustomBranch(
        forkId,
        customText,
        (eventType, data) => {
          if (eventType === 'done') return
          processStreamEvent(eventType, data, ctx)
        },
        controller.signal,
      )
      abortRef.current = null
      await finishForkGeneration(forkId, forkLabel)
    } catch (err) {
      if (controller.signal.aborted) return
      abortRef.current = null
      setStatusText('⚠️ 自定义推演失败', err instanceof Error ? err.message : '请重试')
      setPhase('idle')
      setInputLocked(false)
      setMasterBrightness(1.0)
      setTimeout(() => triggerRollback(), 1500)
    }
  }

  async function finishForkGeneration(
    forkId: string,
    forkLabel: string,
    titlePrefix = '平行宇宙推演完成',
  ) {
    markForkCompleted(forkId)

    const forkDef = useStore.getState().availableForks.find((f) => f.fork_id === forkId)
    const endYear = forkDef?.simulation_window.end_year ?? 2014
    useStore.setState({ currentYear: endYear })

    await syncWorldStateToBackend()
    await refreshAvailableForks()
    markNpcParallelLatest()
    setMasterBrightness(0.92)

    const completed = useStore.getState().completedForks
    useStore.setState((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.type !== 'fork') return n
        const clickable = isForkClickable(n.id, completed)
        return {
          ...n,
          isClickable: clickable,
          hidden: clickable ? false : n.hidden,
        }
      }),
    }))

    setPhase('complete')
    setInputLocked(false)

    const nextForkIdx = FORK_ORDER.indexOf(forkId) + 1
    const nextFork = FORK_ORDER[nextForkIdx]
    if (nextFork) {
      setHighlightedForkId(nextFork)
      const nextNode = useStore.getState().nodes.find((n) => n.id === nextFork)
      if (nextNode && cameraBridge.flyToBranch) {
        cameraBridge.flyToBranch(
          new THREE.Vector3(nextNode.position.x, nextNode.position.y, nextNode.position.z),
        )
      }
    } else {
      setHighlightedForkId(null)
    }

    const sub = nextFork
      ? `👉 点击高亮分叉点继续 · ${getForkLabel(nextFork)}`
      : '全部分叉推演完成 · 点击球星查看命运'

    setStatusText(`${titlePrefix} · ${forkLabel}`, sub)
  }

  function openStream(url: string, forkId: string, choiceId: string, teamColor: string, forkLabel: string) {
    const forkMeta = { forkId, forkLabel }
    const es = new EventSource(url)
    esRef.current = es

    attachStreamHandlers(es, forkId, choiceId, teamColor, forkLabel, forkMeta, () => {
      es.close()
      esRef.current = null
      if (!triedLegacyRef.current) {
        triedLegacyRef.current = true
        const legacyUrl = generateStreamUrl(forkId, choiceId, 'legacy')
        setStatusText('⚡ 切换兼容模式推演……', legacyUrl)
        openStream(legacyUrl, forkId, choiceId, teamColor, forkLabel)
        return
      }
      setStatusText('⚠️ 时间线崩塌 · 正在回滚……', '请重启后端: python main.py')
      setTimeout(() => triggerRollback(), 1500)
    })
  }

  const generate = async (choice: ChoiceData, forkId: string, customText?: string) => {
    if (esRef.current) esRef.current.close()
    abortRef.current?.abort()
    triedLegacyRef.current = false

    const isCustom = choice.choice_id.startsWith('custom_')
    const teamColor = choice.team_color
    const choiceId = choice.choice_id
    const forkLabel = getForkLabel(forkId)

    if (!useStore.getState().generationSnapshot) {
      takeSnapshot()
    }
    const snap = useStore.getState().generationSnapshot!

    useStore.setState({
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
      masterBrightness: snap.masterBrightness,
      statHistory: [],
      recentStatBadges: [],
      posts: [],
      narrativeEvents: [],
      featuredEventId: null,
      selectedNodeId: null,
      selectedPlayerId: null,
      pulsingPlayerIds: [],
      activeBranchId: null,
      activeChoiceLabel: '',
    })

    setActiveBranchId(choiceId)
    setActiveTeamColor(teamColor)
    clearNarrative()
    setActiveChoiceLabel(choice.label)
    setPhase('generating')
    setInputLocked(true)
    nodeCounter.current = 0

    setStatusText(
      isCustom ? '⚡ 正在理解你的决定……' : '⚡ 时间线分叉中……',
      `${forkLabel} · 詹姆斯选择 ${choice.label}`,
    )

    const allNodes = useStore.getState().nodes
    const forkNode = allNodes.find((n) => n.id === forkId)
    const forkIdx = allNodes.findIndex((n) => n.id === forkId)
    const masterAfterFork = allNodes.filter(
      (n, i) => n.isRealHistory && i > forkIdx,
    )

    recordJamesChoice({
      fork_id: forkId,
      choice_id: choiceId,
      choice_label: choice.label,
      timestamp: forkNode?.timestamp ?? new Date().toISOString().slice(0, 10),
    })

    const mode = await getBackendMode()
    if (mode === 'full') {
      await useStore.getState().syncWorldStateToBackend()
      await recordChoiceIfAvailable({
        fork_id: forkId,
        choice_id: choiceId,
        choice_label: choice.label,
        timestamp: forkNode?.timestamp ?? '2010-07-08',
      })
    }

    if (choice.is_real_history) {
      setMasterBrightness(0.92)
      await finishForkGeneration(forkId, forkLabel, '真实历史已确认')
      return
    }

    hideMasterTailAfterFork(forkId)
    setMasterBrightness(0.15)

    const npcDissolve = useStore.getState().dissolveNpcTimelinesForFork(forkId)
    useStore.getState().prepareNpcBranchForFork(forkId)
    if (npcDissolve.length > 0 && particleBridge.dissolveAtPositions) {
      particleBridge.dissolveAtPositions(
        npcDissolve.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
        teamColor,
      )
    }

    if (masterAfterFork.length > 0 && particleBridge.dissolveAtPositions) {
      const positions = masterAfterFork.map(
        (n) => new THREE.Vector3(n.position.x, n.position.y, n.position.z),
      )
      particleBridge.dissolveAtPositions(positions, '#D4A853')
    }

    if (forkNode && cameraBridge.flyToBranch) {
      cameraBridge.flyToBranch(
        new THREE.Vector3(
          forkNode.position.x + 2,
          forkNode.position.y,
          forkNode.position.z,
        ),
      )
    }

    const forkMeta = { forkId, forkLabel }

    if (forkNode && !isCustom) {
      const forkPos = new THREE.Vector3(
        forkNode.position.x,
        forkNode.position.y,
        forkNode.position.z,
      )
      const choiceImpacts = computeChoiceRipple(forkId, choice)
      choiceImpacts.forEach((impact, i) => {
        setTimeout(() => {
          dispatchPlayerRipple(
            forkNode.id,
            forkPos,
            [impact],
            teamColor,
            { source: 'choice', eventTitle: choice.label, ...forkMeta },
          )
        }, 400 + i * 380)
      })

      const choiceCareer = computeChoiceCareerRipple(forkId, choice)
      choiceCareer.forEach((ev, i) => {
        setTimeout(() => {
          pushPlayerCareerEvents([{ ...ev, sourceEventId: forkNode.id, forkId }])
        }, 500 + i * 420)
      })
    }

    if (isCustom && customText) {
      if (mode !== 'full') {
        setStatusText('⚠️ 自定义决定需要完整后端', '请启动 python main.py 后重试')
        setPhase('idle')
        setInputLocked(false)
        return
      }
      setStatusText('⚡ 正在推演平行宇宙……', choice.label)
      await openCustomStream(forkId, customText, choiceId, teamColor, forkLabel)
      return
    }

    const url = generateStreamUrl(forkId, choiceId, mode)
    openStream(url, forkId, choiceId, teamColor, forkLabel)
  }

  const cancel = () => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    abortRef.current?.abort()
    abortRef.current = null
    triggerRollback()
    cameraBridge.resetView?.()
  }

  useEffect(() => {
    return () => {
      if (esRef.current) esRef.current.close()
      abortRef.current?.abort()
    }
  }, [])

  return { generate, cancel }
}
