import { useEffect, useRef, useCallback } from 'react'
import { type Repo, getTempColor, getTempGlow, getTempSize } from '../types'

interface GraphCanvasProps {
  repos: Repo[]
  languageGroups: Record<string, Repo[]>
  highlightedTemp: string | null
  searchQuery: string
  onSelectRepo: (repo: Repo | null) => void
  hoveredRepo: Repo | null
  onHoverRepo: (repo: Repo | null) => void
}

interface Node {
  repo: Repo
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
  radius: number
}

const DAMPING = 0.92
const CENTER_PULL = 0.0003
const REPULSION = 800
const LANG_ORBIT_FACTOR = 0.35 // How much repos cluster by language (0 = none, 1 = tight clusters)

export default function GraphCanvas({
  repos,
  languageGroups,
  highlightedTemp,
  searchQuery,
  onSelectRepo,
  hoveredRepo,
  onHoverRepo,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<Node[]>([])
  const animRef = useRef<number>(0)
  const mouseRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef<Node | null>(null)
  const panRef = useRef({ x: 0, y: 0 })

  // Initialize nodes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = canvas.width / 2
    const cy = canvas.height / 2

    // Position repos in clusters by language
    const langKeys = Object.keys(languageGroups)
    const langAngles: Record<string, number> = {}
    langKeys.forEach((lang, i) => {
      langAngles[lang] = (i / langKeys.length) * Math.PI * 2 - Math.PI / 2
    })

    const nodes: Node[] = repos.map((repo) => {
      const radius = getTempSize(repo.temperature)
      const langAngle = langAngles[repo.lang] ?? Math.random() * Math.PI * 2
      const spread = 120 + Math.random() * 180
      const langX = Math.cos(langAngle) * spread * LANG_ORBIT_FACTOR
      const langY = Math.sin(langAngle) * spread * LANG_ORBIT_FACTOR

      return {
        repo,
        x: cx + langX + (Math.random() - 0.5) * 200,
        y: cy + langY + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
        targetX: cx + langX,
        targetY: cy + langY,
        radius,
      }
    })

    nodesRef.current = nodes
  }, [repos, languageGroups])

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const nodes = nodesRef.current
    const W = canvas.width
    const H = canvas.height

    // Physics
    for (const node of nodes) {
      if (node === dragRef.current) continue

      // Pull toward language cluster center
      const dx = node.targetX + panRef.current.x - node.x
      const dy = node.targetY + panRef.current.y - node.y
      node.vx += dx * CENTER_PULL
      node.vy += dy * CENTER_PULL

      // Repulsion from other nodes
      for (const other of nodes) {
        if (node === other) continue
        const rx = node.x - other.x
        const ry = node.y - other.y
        const dist2 = rx * rx + ry * ry + 1
        const force = REPULSION / dist2
        node.vx += rx * force * 0.01
        node.vy += ry * force * 0.01
      }

      // Damping
      node.vx *= DAMPING
      node.vy *= DAMPING

      node.x += node.vx
      node.y += node.vy
    }

    // Clear
    ctx.fillStyle = '#050508'
    ctx.fillRect(0, 0, W, H)

    // Background glow layers
    // Language cluster halos
    const langKeys = Object.keys(languageGroups)
    for (const lang of langKeys) {
      const group = languageGroups[lang]
      if (!group.length) continue
      const firstNode = nodes.find(n => n.repo === group[0])
      if (!firstNode) continue
      
      // Calculate cluster center
      let avgX = 0, avgY = 0
      let count = 0
      for (const repo of group) {
        const node = nodes.find(n => n.repo === repo)
        if (node) {
          avgX += node.x
          avgY += node.y
          count++
        }
      }
      if (count === 0) continue
      avgX /= count
      avgY /= count

      const gradient = ctx.createRadialGradient(avgX, avgY, 0, avgX, avgY, 120)
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.04)')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fillRect(avgX - 120, avgY - 120, 240, 240)
    }

    // Draw connections between same-language repos
    ctx.lineWidth = 0.3
    for (const lang of langKeys) {
      const group = languageGroups[lang]
      if (group.length < 2) continue
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.08)'
      ctx.beginPath()
      for (let i = 0; i < group.length; i++) {
        const n1 = nodes.find(n => n.repo === group[i])
        if (!n1) continue
        for (let j = i + 1; j < group.length; j++) {
          const n2 = nodes.find(n => n.repo === group[j])
          if (!n2) continue
          const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y)
          if (dist < 150) {
            ctx.moveTo(n1.x, n1.y)
            ctx.lineTo(n2.x, n2.y)
          }
        }
      }
      ctx.stroke()
    }

    // Draw nodes
    const time = Date.now() * 0.001
    for (const node of nodes) {
      const repo = node.repo
      const isHighlighted = !highlightedTemp || repo.temperature === highlightedTemp
      const isSearched = searchQuery && (
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.lang.toLowerCase().includes(searchQuery.toLowerCase())
      )
      const isHovered = hoveredRepo === repo
      const dimmed = highlightedTemp && !isHighlighted
      const alpha = dimmed ? 0.15 : 1

      const color = getTempColor(repo.temperature)
      const glowColor = getTempGlow(repo.temperature)
      const r = isHovered ? node.radius * 1.8 : (isSearched ? node.radius * 1.5 : node.radius)
      const pulseFactor = repo.temperature === 'boss' ? 1 + 0.15 * Math.sin(time * 2) : 
                          repo.temperature === 'hot' ? 1 + 0.1 * Math.sin(time * 1.5) : 1
      const finalR = r * pulseFactor

      // Outer glow
      if ((repo.temperature === 'boss' || repo.temperature === 'hot' || isHovered || isSearched) && isHighlighted) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, finalR * 3, 0, Math.PI * 2)
        const outerGlow = ctx.createRadialGradient(node.x, node.y, finalR, node.x, node.y, finalR * 3)
        outerGlow.addColorStop(0, glowColor)
        outerGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = outerGlow
        ctx.globalAlpha = alpha * 0.6
        ctx.fill()
      }

      // Core dot
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(node.x, node.y, finalR, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      // Inner bright spot
      if (isHighlighted) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, finalR * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`
        ctx.fill()
      }

      // Name label for hovered/searched/boss
      if ((isHovered || isSearched || repo.temperature === 'boss') && isHighlighted) {
        ctx.font = isHovered ? 'bold 12px Inter' : '11px Inter'
        ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(226, 232, 240, 0.8)'
        ctx.textAlign = 'center'
        ctx.fillText(repo.name, node.x, node.y - finalR - 6)
      }
    }

    ctx.globalAlpha = 1

    animRef.current = requestAnimationFrame(animate)
  }, [repos, languageGroups, highlightedTemp, searchQuery, hoveredRepo])

  // Start animation
  useEffect(() => {
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [animate])

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio
      canvas.height = window.innerHeight * window.devicePixelRatio
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Mouse handlers
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    mouseRef.current = { x: mx, y: my }

    if (dragRef.current) {
      dragRef.current.x = mx
      dragRef.current.y = my
      return
    }

    // Find hovered node
    const nodes = nodesRef.current
    let found: Repo | null = null
    for (const node of nodes) {
      const dist = Math.hypot(node.x - mx, node.y - my)
      if (dist < node.radius * 2) {
        found = node.repo
        break
      }
    }
    onHoverRepo(found)
  }, [onHoverRepo])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const nodes = nodesRef.current
    for (const node of nodes) {
      const dist = Math.hypot(node.x - mx, node.y - my)
      if (dist < node.radius * 2) {
        onSelectRepo(node.repo)
        return
      }
    }
    onSelectRepo(null)
  }, [onSelectRepo])

  return (
    <canvas
      ref={canvasRef}
      className="canvas-container"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    />
  )
}