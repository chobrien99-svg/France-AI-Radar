"use client"

import { useEffect, useRef } from "react"

/**
 * Wireframe parabolic radar dish on a canvas, slowly turning in azimuth.
 * Geometry and constants follow the v2 design handoff (landing2.jsx).
 * With prefers-reduced-motion a single static frame is drawn.
 */
export function RadarDish({ speed = 1 }: { speed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext("2d")
    if (!cv || !ctx) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let w = 0
    let h = 0
    let raf = 0
    const t0 = performance.now()

    const size = () => {
      const r = cv.getBoundingClientRect()
      const d = window.devicePixelRatio || 1
      w = r.width
      h = r.height
      cv.width = w * d
      cv.height = h * d
      ctx.setTransform(d, 0, 0, d, 0, 0)
    }
    const ro = new ResizeObserver(() => {
      size()
      if (reduce) draw(performance.now())
    })
    ro.observe(cv)
    size()

    const RINGS = 10, SPOKES = 40, SEG = 120, f = 0.85, EL = -0.55, CAM = 0.2
    type P = [number, number, number]

    function draw(now: number) {
      const az = reduce ? 0.7 : ((now - t0) / 1000) * 0.11 * speed + 0.7
      const R = Math.min(w * 0.4, h * 0.44), cx = w * 0.5, cy = h * 0.47, F = 3.2
      const ce = Math.cos(EL), se = Math.sin(EL), ca = Math.cos(az), sa = Math.sin(az), cc = Math.cos(CAM), sc = Math.sin(CAM)
      const world = (x: number, y: number, z: number, dish: boolean): P => {
        if (dish) {
          const y1 = y * ce - z * se, z1 = y * se + z * ce
          y = y1
          z = z1
        }
        const x2 = x * ca + z * sa, z2 = -x * sa + z * ca
        const y3 = y * cc - z2 * sc, z3 = y * sc + z2 * cc
        const s = F / (F - z3)
        return [cx + x2 * s * R, cy - y3 * s * R, z3]
      }
      const dp = (r: number, a: number) => world(r * Math.cos(a), r * Math.sin(a), (r * r) / (4 * f) - 0.2, true)
      const seg = (p: P, q: P, base: number) => {
        const z = (p[2] + q[2]) / 2
        ctx!.strokeStyle = `rgba(255,255,255,${(base * (0.38 + 0.62 * Math.max(0, Math.min(1, (z + 1) / 2)))).toFixed(3)})`
        ctx!.beginPath()
        ctx!.moveTo(p[0], p[1])
        ctx!.lineTo(q[0], q[1])
        ctx!.stroke()
      }

      ctx!.clearRect(0, 0, w, h)
      ctx!.lineWidth = 1

      // Stand: legs, braces, ground circle
      const gy = -1.3, piv = world(0, -0.05, -0.22, false)
      for (const [x, z] of [[0.62, 0.34], [-0.62, 0.34], [0.62, -0.34], [-0.62, -0.34]]) seg(world(x, gy, z, false), piv, 0.22)
      seg(world(0.62, gy, 0.34, false), world(-0.62, gy, 0.34, false), 0.16)
      seg(world(0.62, gy, -0.34, false), world(-0.62, gy, -0.34, false), 0.16)
      let prev: P | null = null
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2
        const p = world(Math.cos(a) * 0.9, gy, Math.sin(a) * 0.9, false)
        p[2] = 0
        if (prev) seg(prev, p, 0.12)
        prev = p
      }

      // Dish rings and spokes
      for (let k = 1; k <= RINGS; k++) {
        const r = k / RINGS
        let pv = dp(r, 0)
        for (let i = 1; i <= SEG; i++) {
          const p = dp(r, (i / SEG) * Math.PI * 2)
          seg(pv, p, k === RINGS ? 0.42 : 0.2)
          pv = p
        }
      }
      for (let j = 0; j < SPOKES; j++) {
        const a = (j / SPOKES) * Math.PI * 2, r0 = j % 2 ? 0.3 : 0.1
        let pv = dp(r0, a)
        for (let i = 1; i <= 10; i++) {
          const p = dp(r0 + (i / 10) * (1 - r0), a)
          seg(pv, p, 0.18)
          pv = p
        }
      }

      // Feed struts and feed
      const feed = world(0, 0, f * 0.92, true)
      for (const m of [0.25, 0.75, 1.25, 1.75]) seg(dp(0.98, m * Math.PI), feed, 0.3)
      ctx!.fillStyle = "#6EA0FF"
      ctx!.fillRect(feed[0] - 3, feed[1] - 3, 6, 6)

      if (!reduce) raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [speed])

  return <canvas ref={ref} />
}
