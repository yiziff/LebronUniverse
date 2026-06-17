import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import ForceGraph3D, { type ForceGraph3DInstance } from '3d-force-graph'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { useStore } from '../store'
import { CameraController, cameraBridge } from './CameraController'
import { createStarField } from './StarField'
import { createParticleSystem } from './ParticleSystem'
import { createShockwaveSystem } from './ShockwaveSystem'
import { createPlayerConstellation } from './PlayerConstellation'
import { createPlayerTimelineNebula } from './PlayerTimelineNebula'
import { buildTimelineNodeObject, buildTimelineNodeLabel } from './TimelineNodeFactory'
import { computeTimelineMeta } from '../utils/timelineOrder'
import { applySoftTimelineLinks } from './TimelineLinkStyle'
import type { GraphNode, GraphEdge } from '../types'

function applyTimelineVisuals(
  fg: ForceGraph3DInstance,
  nodes: GraphNode[],
  edges: GraphEdge[],
  featuredEventId: string | null,
  masterBrightness: number,
) {
  const metaMap = computeTimelineMeta(nodes, edges)

  fg.nodeThreeObject((node: any) => {
    const data = { ...(node as GraphNode), __meta: metaMap.get(node.id) }
    return buildTimelineNodeObject(data, featuredEventId, masterBrightness)
  })

  fg.nodeLabel((node: any) => {
    const data = { ...(node as GraphNode), __meta: metaMap.get(node.id) }
    return buildTimelineNodeLabel(data)
  })

  applySoftTimelineLinks(fg, nodes, metaMap, masterBrightness)
}

export default function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraph3DInstance | null>(null)
  const camRef = useRef<CameraController | null>(null)
  const particleRef = useRef<ReturnType<typeof createParticleSystem> | null>(null)
  const shockwaveRef = useRef<ReturnType<typeof createShockwaveSystem> | null>(null)
  const constellationRef = useRef<ReturnType<typeof createPlayerConstellation> | null>(null)
  const nebulaRef = useRef<ReturnType<typeof createPlayerTimelineNebula> | null>(null)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)

  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const masterBrightness = useStore((s) => s.masterBrightness)
  const inputLocked = useStore((s) => s.inputLocked)
  const featuredEventId = useStore((s) => s.featuredEventId)
  const playerStars = useStore((s) => s.playerStars)
  const playerFates = useStore((s) => s.playerFates)
  const pulsingPlayerIds = useStore((s) => s.pulsingPlayerIds)
  const npcTimelineNodes = useStore((s) => s.npcTimelineNodes)
  const npcTimelineEdges = useStore((s) => s.npcTimelineEdges)
  const npcCrossLinks = useStore((s) => s.npcCrossLinks)
  const npcForkAnchors = useStore((s) => s.npcForkAnchors)
  const selectedPlayerId = useStore((s) => s.selectedPlayerId)

  useEffect(() => {
    if (!containerRef.current) return

    const fg = new ForceGraph3D(containerRef.current)
    fgRef.current = fg

    // Avoid OrbitControls + DragControls fighting on the same canvas (pointerUp crash)
    if (typeof fg.enableNavigationControls === 'function') {
      fg.enableNavigationControls(false)
    }
    if (typeof fg.enableNodeDrag === 'function') {
      fg.enableNodeDrag(false)
    }

    const scene = fg.scene()
    const camera = fg.camera() as THREE.PerspectiveCamera
    const renderer = fg.renderer()

    renderer.setClearColor(0x030308)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.92

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.22,
      0.2,
      0.82,
    )
    fg.postProcessingComposer().addPass(bloomPass)

    createStarField(scene)
    particleRef.current = createParticleSystem(scene)
    shockwaveRef.current = createShockwaveSystem(scene)
    constellationRef.current = createPlayerConstellation(scene)
    nebulaRef.current = createPlayerTimelineNebula(scene)

    const initState = useStore.getState()
    constellationRef.current.syncPlayers(
      initState.playerStars,
      new Set(initState.pulsingPlayerIds),
      initState.playerFates,
    )

    scene.add(new THREE.HemisphereLight(0x667799, 0x0a0818, 0.4))
    scene.add(new THREE.AmbientLight(0x151525, 0.25))
    const light1 = new THREE.PointLight(0xffd4aa, 8, 45)
    light1.position.set(6, 8, 4)
    scene.add(light1)
    const light2 = new THREE.PointLight(0x6688ff, 5, 40)
    light2.position.set(-2, 3, -6)
    scene.add(light2)

    const ctrl = new CameraController(camera, renderer.domElement)
    camRef.current = ctrl

    cameraBridge.flyToBranch = (lookAt: THREE.Vector3) => {
      ctrl.flyTo(
        new THREE.Vector3(lookAt.x + 2, lookAt.y + 8, lookAt.z + 14),
        lookAt,
        1.4,
      )
    }
    cameraBridge.resetView = () => ctrl.resetView()

    fg.graphData({ nodes: [], links: [] })
    applyTimelineVisuals(fg, [], [], null, 1)

    fg.onNodeClick((node: any) => {
      const n = node as GraphNode
      if (n.type === 'fork' && n.isClickable) {
        useStore.getState().openWheel(n.id)
        return
      }
      if (n.type === 'event' && n.isClickable) {
        useStore.getState().setSelectedNodeId(n.id)
        const px = n.position?.x ?? 0
        const py = n.position?.y ?? 0
        const pz = n.position?.z ?? 0
        camRef.current?.flyTo(
          new THREE.Vector3(px + 1.5, py + 3, pz + 3),
          new THREE.Vector3(px, py, pz),
          0.9,
        )
      }
    })

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownRef.current = { x: ev.clientX, y: ev.clientY }
    }

    const onPointerUp = (ev: PointerEvent) => {
      const down = pointerDownRef.current
      if (!down) return
      pointerDownRef.current = null
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y)
      if (moved > 8) return

      const state = useStore.getState()
      if (state.phase === 'generating' && state.inputLocked) return

      const rect = renderer.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)

      const starId = constellationRef.current?.pickStar(raycaster)
      if (starId && starId !== 'lebron-james') {
        ev.stopPropagation()
        state.setSelectedPlayerId(starId)
        const star = state.playerStars.find((p) => p.id === starId)
        const firstNode = state.npcTimelineNodes
          .filter((n) => n.playerId === starId && n.segmentKind === 'real' && !n.hidden)
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0]
        const look = firstNode
          ? new THREE.Vector3(firstNode.position.x, firstNode.position.y, firstNode.position.z)
          : star
            ? new THREE.Vector3(star.position.x, star.position.y, star.position.z)
            : null
        if (look) {
          camRef.current?.flyTo(
            new THREE.Vector3(look.x + 1.4, look.y + 2.8, look.z + 2.8),
            look,
            0.9,
          )
        }
        return
      }

      const npcId = nebulaRef.current?.pickNode(raycaster)
      if (npcId) {
        ev.stopPropagation()
        state.selectNpcTimelineNode(npcId)
        const node = state.npcTimelineNodes.find((n) => n.id === npcId)
        if (node) {
          camRef.current?.flyTo(
            new THREE.Vector3(node.position.x + 1.2, node.position.y + 2.5, node.position.z + 2.5),
            new THREE.Vector3(node.position.x, node.position.y, node.position.z),
            0.85,
          )
        }
      }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    const onResize = () => {
      bloomPass.resolution.set(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    let animId: number
    let last = performance.now()
    const animate = () => {
      animId = requestAnimationFrame(animate)
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      ctrl.update()
      particleRef.current?.update()
      shockwaveRef.current?.update(dt)
      constellationRef.current?.tick(dt)
      nebulaRef.current?.tick(dt)

      const pulse = 1 + Math.sin(now * 0.003) * 0.04
      scene.traverse((obj) => {
        if (obj.name === 'timeline-latest-ring' || obj.name === 'npc-latest-ring' || obj.name === 'npc-fork-anchor-ring') {
          obj.scale.setScalar(pulse)
        }
      })

      const state = useStore.getState()
      constellationRef.current?.syncPlayers(
        state.playerStars,
        new Set(state.pulsingPlayerIds),
        state.playerFates,
      )
      const posMap = new Map<string, THREE.Vector3>()
      state.nodes.forEach((n) => {
        if (!n.hidden) {
          posMap.set(n.id, new THREE.Vector3(n.position.x, n.position.y, n.position.z))
        }
      })
      state.playerStars.forEach((p) => {
        posMap.set(p.id, new THREE.Vector3(p.position.x, p.position.y, p.position.z))
      })
      const rippleEdges = state.edges.filter((e) => e.isRipple)
      constellationRef.current?.syncRippleEdges(rippleEdges, posMap)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      cameraBridge.flyToBranch = null
      cameraBridge.resetView = null
      constellationRef.current?.dispose()
      nebulaRef.current?.dispose()
      ctrl.dispose()
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return

    const visibleNodes = nodes.filter((n) => !n.hidden)
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))
    const visibleEdges = edges.filter(
      (e) =>
        !e.hidden &&
        !e.isRipple &&
        !e.ephemeral &&
        visibleNodeIds.has(e.source) &&
        visibleNodeIds.has(e.target),
    )

    const metaMap = computeTimelineMeta(nodes, edges)

    fg.graphData({
      nodes: visibleNodes.map((n) => ({
        ...n,
        __meta: metaMap.get(n.id),
        fx: n.isRealHistory || n.parentId ? n.position.x : undefined,
        fy: n.isRealHistory || n.parentId ? n.position.y : undefined,
        fz: n.isRealHistory || n.parentId ? n.position.z : undefined,
      })),
      links: visibleEdges.map((e) => ({
        source: e.source,
        target: e.target,
        color: e.color,
      })),
    })

    applyTimelineVisuals(fg, nodes, edges, featuredEventId, masterBrightness)
    fg.refresh()
  }, [nodes, edges, featuredEventId, masterBrightness])

  useEffect(() => {
    if (camRef.current) camRef.current.setEnabled(!inputLocked)
  }, [inputLocked])

  useEffect(() => {
    constellationRef.current?.syncPlayers(
      playerStars,
      new Set(pulsingPlayerIds),
      playerFates,
    )
  }, [playerStars, playerFates, pulsingPlayerIds])

  useEffect(() => {
    const nebula = nebulaRef.current
    if (!nebula) return
    const nodeMap = new Map(npcTimelineNodes.map((n) => [n.id, n]))
    const jamesPositions = new Map<string, THREE.Vector3>()
    for (const n of nodes) {
      if (!n.hidden) {
        jamesPositions.set(n.id, new THREE.Vector3(n.position.x, n.position.y, n.position.z))
      }
    }
    nebula.sync(
      npcTimelineNodes,
      npcTimelineEdges,
      npcCrossLinks,
      nodeMap,
      masterBrightness,
      selectedPlayerId,
      playerStars,
      npcForkAnchors,
      jamesPositions,
    )
  }, [
    nodes,
    npcTimelineNodes,
    npcTimelineEdges,
    npcCrossLinks,
    npcForkAnchors,
    masterBrightness,
    selectedPlayerId,
    playerStars,
  ])

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
    />
  )
}
