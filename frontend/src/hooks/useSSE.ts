import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'
import { particleBridge } from '../engine/ParticleSystem'
import { cameraBridge } from '../engine/CameraController'
import { shockwaveBridge } from '../engine/ShockwaveSystem'
import { resolveEventImpacts, resolveCareerEvents, playerNameZh } from '../utils/inferPlayerImpact'
import { computeChoiceRipple, computeChoiceCareerRipple } from '../utils/choiceButterfly'
import { nextForkId } from '../utils/loadMasterTimeline'
import { playerColor } from '../data/keyPlayers'
import { computeParallelEventPosition } from '../utils/parallelForkLayout'
import {
  getBackendMode, generateStreamUrl,
  recordChoiceIfAvailable,
} from '../utils/apiClient'
import {
  loadBranchFromCache,
  saveBranchToCache,
  type CachedBranch,
} from './useBranchCache'
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

export function useSSE() {
  const esRef = useRef<EventSource | null>(null)
  const nodeCounter = useRef(0)
  const triedLegacyRef = useRef(false)
  const masterTailHiddenRef = useRef(false)
  const lastParallelNodeIdRef = useRef<string | null>(null)
  const cacheCollectRef = useRef<CachedBranch | null>(null)

  const addNode = useStore((s) => s.addNode)
  const addEdge = useStore((s) => s.addEdge)
  const setMasterBrightness = useStore((s) => s.setMasterBrightness)
  const hideMasterTailAfterFork = useStore((s) => s.hideMasterTailAfterFork)
  const hideResolvedMasterForks = useStore((s) => s.hideResolvedMasterForks)
  const lockForkDuringGeneration = useStore((s) => s.lockForkDuringGeneration)
  const spawnNextParallelFork = useStore((s) => s.spawnNextParallelFork)
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

  function ensureMasterTailHidden(forkId: string) {
    if (masterTailHiddenRef.current) return
    masterTailHiddenRef.current = true

    const allNodes = useStore.getState().nodes
    const forkIdx = allNodes.findIndex((n) => n.id === forkId)
    const masterAfterFork = allNodes.filter(
      (n, i) => n.isRealHistory && n.type !== 'fork' && i > forkIdx,
    )

    hideMasterTailAfterFork(forkId)

    if (masterAfterFork.length > 0 && particleBridge.dissolveAtPositions) {
      const positions = masterAfterFork.map(
        (n) => new THREE.Vector3(n.position.x, n.position.y, n.position.z),
      )
      particleBridge.dissolveAtPositions(positions, '#D4A853')
    }
  }

  function processTimelineEvent(
    data: TimelineEventPayload,
    forkId: string,
    choiceId: string,
    teamColor: string,
    forkMeta: { forkId: string; forkLabel: string },
    options: { instant?: boolean } = {},
  ): THREE.Vector3 {
    ensureMasterTailHidden(forkId)

    const nodeId = data.event_id
    const existing = useStore.getState().nodes
    const currentFork = existing.find((n) => n.id === forkId)
    const anchor = {
      x: currentFork?.position.x ?? 0,
      y: currentFork?.position.y ?? 0,
      z: currentFork?.position.z ?? 0,
    }
    const pos = computeParallelEventPosition(anchor, nodeCounter.current)
    const newPos = new THREE.Vector3(pos.x, pos.y, pos.z)
    const branchColor = playerColor('lebron-james')

    const newNode: GraphNode = {
      id: nodeId,
      type: 'event',
      label: data.title,
      description: data.description,
      timestamp: data.timestamp,
      position: { x: newPos.x, y: newPos.y, z: newPos.z },
      color: branchColor,
      size: data.confidence > 0.8 ? 0.75 : 0.52,
      parentId: choiceId,
      isRealHistory: false,
      isClickable: false,
      teamsAffected: data.teams_affected,
    }

    pushNarrative({
      id: nodeId,
      timestamp: data.timestamp,
      title: data.title,
      description: data.description || '平行宇宙正在展开……',
      teamColor,
      isBranch: true,
      teamsAffected: data.teams_affected,
    })

    setStatusText(data.title, `${data.timestamp} · 平行宇宙事件 #${nodeCounter.current}`)

    const impacts = resolveEventImpacts(data)
    if (impacts.length > 0) {
      dispatchPlayerRipple(nodeId, newPos, impacts, teamColor, {
        source: 'event', eventTitle: data.title, ...forkMeta,
      })
    }

    const careerEvents = resolveCareerEvents(data)
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
          timestamp: data.timestamp,
          title: impact.reason.slice(0, 20) || data.title.slice(0, 20),
          description: `因「${data.title}」：${data.description?.slice(0, 120) ?? impact.reason}`,
          vsRealHistory: '真实历史线与此不同',
          sourceEventTitle: data.title,
        },
        nodeId,
        forkId,
      )
    }

    const sourceId = lastParallelNodeIdRef.current ?? currentFork?.id
    lastParallelNodeIdRef.current = nodeId

    const onNodeReady = () => {
      addNode(newNode)
      if (sourceId) {
        addEdge({
          id: `edge_${sourceId}_${nodeId}`,
          source: sourceId,
          target: nodeId,
          color: branchColor,
          thickness: 0.04,
          isParticleFlow: true,
        })
      }
      if (
        cameraBridge.flyToBranch &&
        (options.instant || nodeCounter.current === 1 || nodeCounter.current % 2 === 0)
      ) {
        cameraBridge.flyToBranch(newPos)
      }
    }

    if (options.instant) {
      onNodeReady()
    } else if (particleBridge.coalesceAtPosition) {
      particleBridge.coalesceAtPosition(newPos, branchColor, onNodeReady)
    } else {
      onNodeReady()
    }

    return newPos
  }

  function processStatUpdate(data: StatUpdatePayload) {
    applyStatDelta({
      dimension: mapDimension(data.dimension),
      delta: data.delta,
      reason: data.reason,
    })
    if (data.reason) {
      setStatusText(
        useStore.getState().statusText,
        `${data.reason} (${data.delta > 0 ? '+' : ''}${data.delta})`,
      )
    }
  }

  function processSocialPost(data: SocialPostPayload) {
    const post: SocialPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username: data.username,
      handle: data.handle,
      avatarColor: data.avatar_color || '#888',
      content: data.content,
      sentiment: (data.sentiment as SocialPost['sentiment']) || 'excited',
      timestamp: Date.now(),
    }
    pushPost(post)
  }

  async function finishGeneration(forkId: string, forkLabel: string) {
    markForkCompleted(forkId)
    hideResolvedMasterForks(forkId)
    const spawnedForkId = spawnNextParallelFork(forkId)

    const forkDef = useStore.getState().availableForks.find((f) => f.fork_id === forkId)
    const endYear = forkDef?.simulation_window.end_year ?? 2014
    useStore.setState({ currentYear: endYear })

    await syncWorldStateToBackend()
    await refreshAvailableForks()
    markNpcParallelLatest()
    setMasterBrightness(0.92)
    useStore.getState().takeSnapshot()

    setPhase('complete')
    setInputLocked(false)

    const nextFork = nextForkId(forkId)
    let sub: string
    if (spawnedForkId && nextFork) {
      const spawned = useStore.getState().nodes.find((n) => n.id === spawnedForkId)
      if (spawned && cameraBridge.flyToBranch) {
        cameraBridge.flyToBranch(
          new THREE.Vector3(
            spawned.position.x + 2,
            spawned.position.y,
            spawned.position.z,
          ),
        )
      }
      sub = `点击平行宇宙末端的分叉点 · ${getForkLabel(spawnedForkId)}`
    } else {
      sub = '全部分叉推演完成 · 点击球星查看命运'
    }

    setStatusText(`平行宇宙推演完成 · ${forkLabel}`, sub)
  }

  async function replayCachedBranch(
    cached: CachedBranch,
    forkId: string,
    choiceId: string,
    teamColor: string,
    forkLabel: string,
  ) {
    const forkMeta = { forkId, forkLabel }
    lastParallelNodeIdRef.current = null
    nodeCounter.current = 0

    setStatusText('⚡ 读取缓存 · 平行宇宙展开', `${forkLabel} · 詹姆斯选择 ${cached.events[0]?.title ?? choiceId}`)

    let lastPos: THREE.Vector3 | null = null
    for (const event of cached.events) {
      nodeCounter.current++
      lastPos = processTimelineEvent(
        event as TimelineEventPayload,
        forkId,
        choiceId,
        teamColor,
        forkMeta,
        { instant: true },
      )
    }

    for (const sc of cached.statUpdates) {
      processStatUpdate(sc)
    }
    for (const sp of cached.socialPosts) {
      processSocialPost(sp)
    }

    if (lastPos && cameraBridge.flyToBranch) {
      cameraBridge.flyToBranch(lastPos)
    }

    await finishGeneration(forkId, forkLabel)
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
    let receivedEvent = false

    es.addEventListener('timeline_event', (e: MessageEvent) => {
      receivedEvent = true
      const data: TimelineEventPayload = JSON.parse(e.data)
      nodeCounter.current++
      processTimelineEvent(data, forkId, choiceId, teamColor, forkMeta)

      const collector = cacheCollectRef.current
      if (collector) {
        collector.events.push({
          event_id: data.event_id,
          timestamp: data.timestamp,
          title: data.title,
          description: data.description,
          teams_affected: data.teams_affected,
          key_players: data.key_players ?? [],
          confidence: data.confidence ?? 0.7,
        })
      }
    })

    es.addEventListener('stat_update', (e: MessageEvent) => {
      receivedEvent = true
      const data: StatUpdatePayload = JSON.parse(e.data)
      processStatUpdate(data)
      cacheCollectRef.current?.statUpdates.push(data)
    })

    es.addEventListener('social_post', (e: MessageEvent) => {
      receivedEvent = true
      const data: SocialPostPayload = JSON.parse(e.data)
      processSocialPost(data)
      cacheCollectRef.current?.socialPosts.push(data)
    })

    es.addEventListener('done', async () => {
      es.close()
      esRef.current = null

      const collector = cacheCollectRef.current
      if (collector && collector.events.length > 0) {
        saveBranchToCache(collector)
      }
      cacheCollectRef.current = null

      await finishGeneration(forkId, forkLabel)
    })

    es.addEventListener('error', () => {
      if (useStore.getState().phase === 'complete') return
      if (!receivedEvent && !triedLegacyRef.current) {
        onFatalError()
        return
      }
      es.close()
      esRef.current = null
      cacheCollectRef.current = null
      setStatusText('⚠️ 推演连接中断', '请检查后端是否运行 · 点击分叉点重试')
      setPhase('idle')
      setInputLocked(false)
      setMasterBrightness(1.0)
    })
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

  const generate = async (choice: ChoiceData, forkId: string) => {
    if (esRef.current) esRef.current.close()
    triedLegacyRef.current = false
    masterTailHiddenRef.current = false
    lastParallelNodeIdRef.current = null
    cacheCollectRef.current = null

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

    const cached = !choice.is_real_history
      ? loadBranchFromCache(forkId, choiceId)
      : null

    setStatusText(
      cached?.events.length
        ? '⚡ 读取缓存 · 平行宇宙展开'
        : '⚡ 时间线分叉中……',
      `${forkLabel} · 詹姆斯选择 ${choice.label}`,
    )

    const allNodes = useStore.getState().nodes
    const forkNode = allNodes.find((n) => n.id === forkId)

    lockForkDuringGeneration(forkId)
    setMasterBrightness(cached?.events.length ? 0.55 : 0.15)

    if (!choice.is_real_history) {
      const npcDissolve = useStore.getState().dissolveNpcTimelinesForFork(forkId)
      useStore.getState().prepareNpcBranchForFork(forkId)
      if (npcDissolve.length > 0 && particleBridge.dissolveAtPositions) {
        particleBridge.dissolveAtPositions(
          npcDissolve.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
          teamColor,
        )
      }
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

    if (forkNode && !choice.is_real_history) {
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
        }, cached?.events.length ? 0 : 400 + i * 380)
      })

      const choiceCareer = computeChoiceCareerRipple(forkId, choice)
      choiceCareer.forEach((ev, i) => {
        setTimeout(() => {
          pushPlayerCareerEvents([{ ...ev, sourceEventId: forkNode.id, forkId }])
        }, cached?.events.length ? 0 : 500 + i * 420)
      })
    }

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

    if (cached && cached.events.length > 0) {
      await replayCachedBranch(cached, forkId, choiceId, teamColor, forkLabel)
      return
    }

    cacheCollectRef.current = {
      forkId,
      choiceId,
      events: [],
      statUpdates: [],
      socialPosts: [],
      savedAt: Date.now(),
    }

    const url = generateStreamUrl(forkId, choiceId, mode)
    openStream(url, forkId, choiceId, teamColor, forkLabel)
  }

  const cancel = () => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    cacheCollectRef.current = null
    triggerRollback()
    cameraBridge.resetView?.()
  }

  useEffect(() => {
    return () => {
      if (esRef.current) esRef.current.close()
    }
  }, [])

  return { generate, cancel }
}
