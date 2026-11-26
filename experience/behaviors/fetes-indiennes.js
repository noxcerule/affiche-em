// Animation AR de l'affiche « Les fêtes indiennes » :
// 1. Diwali (gauche) : flamme vacillante, halo chaleureux, lanternes qui se balancent en boucle fluide de 8 s.
// 2. Holi (droite) : explosion brève de poudre colorée jetée vers l'écran puis disparition (rejouable au tap).
// 3. Étoiles : les 14 étoiles dorées scintillent l'une après l'autre sans bouger de position.

const AFFICHE_W = 1.05
const AFFICHE_H = AFFICHE_W * (2048 / 1513)
const HOLI_BURST_DURATION = 2.5
const HOLI_REPEAT_INTERVAL = 5.0

/** @type {import('../../core/behaviors').Behavior} */
export default {
  onFound(ctx) {
    const id = ctx.target || 'main'
    if (!ctx.state.scenes) ctx.state.scenes = {}
    if (ctx.state.scenes[id]) {
      const s = ctx.state.scenes[id]
      s.group.visible = true
      s.foundAt = null
      s.holiBurstStart = null
      s.holiParticlesHidden = false
      return
    }

    const THREE = ctx.THREE
    const loader = new THREE.TextureLoader()

    // Groupe racine aligné exactement sur la brique "affiche" (x: 0.5, y: 0.5, z: 0.008)
    const group = new THREE.Group()
    group.name = 'fetes-indiennes-fx'
    group.position.copy(ctx.toLocal(0.5, 0.5, 0.008))
    ctx.poster.add(group)

    const toAffiche = (x, y, z = 0) =>
      new THREE.Vector3((x - 0.5) * AFFICHE_W, (0.5 - y) * AFFICHE_H, z)

    const loadTex = (path) => {
      const tex = loader.load(ctx.asset(path), undefined, undefined, () => {
        ctx.log(`Impossible de charger ${path}`)
      })
      tex.colorSpace = THREE.SRGBColorSpace
      return tex
    }

    const makePlane = (texPath, nw, aspect, opts = {}) => {
      const w = nw * AFFICHE_W
      const mat = new THREE.MeshBasicMaterial({
        map: opts.tex ?? loadTex(texPath),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: opts.opacity ?? 1,
        blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * aspect), mat)
      if (opts.renderOrder !== undefined) mesh.renderOrder = opts.renderOrder
      return {mesh, mat, w, h: w * aspect}
    }

    // -----------------------------------------------------------------------
    // 1. DIWALI — Halo + Flamme de la diya + 2 Lanternes suspendues
    // -----------------------------------------------------------------------

    const halo = makePlane('assets/halo-diya.png', 0.2048, 422 / 425, {
      opacity: 0.85,
      renderOrder: 14,
    })
    halo.mesh.position.copy(toAffiche(0.2855, 0.3565, 0.008))
    group.add(halo.mesh)

    const flamePivot = new THREE.Group()
    flamePivot.position.copy(toAffiche(0.2834, 0.4124, 0.016))
    const flame = makePlane('assets/flamme-diya.png', 0.2048, 422 / 425, {
      opacity: 0.98,
      renderOrder: 16,
    })
    flame.mesh.position.set(
      (0.5 - 208 / 425) * flame.w,
      (368 / 422 - 0.5) * flame.h,
      0,
    )
    flamePivot.add(flame.mesh)
    group.add(flamePivot)

    const leftPivot = new THREE.Group()
    leftPivot.position.copy(toAffiche(0.1378, 0.2411, 0.012))
    const leftLantern = makePlane('assets/lanterne-gauche.png', 0.1210, 459 / 251, {
      renderOrder: 15,
    })
    leftLantern.mesh.position.set(
      (0.5 - 0.5139) * leftLantern.w,
      -leftLantern.h / 2,
      0,
    )
    leftPivot.add(leftLantern.mesh)
    group.add(leftPivot)

    const rightPivot = new THREE.Group()
    rightPivot.position.copy(toAffiche(0.4255, 0.2411, 0.012))
    const rightLantern = makePlane('assets/lanterne-droite.png', 0.0940, 444 / 195, {
      renderOrder: 15,
    })
    rightLantern.mesh.position.set(
      (0.5 - 0.6462) * rightLantern.w,
      -rightLantern.h / 2,
      0,
    )
    rightPivot.add(rightLantern.mesh)
    group.add(rightPivot)

    // -----------------------------------------------------------------------
    // 2. HOLI — Explosion brève de poudre jetée vers l'écran puis disparition
    // -----------------------------------------------------------------------
    const holiTex = loadTex('assets/poudre-holi.png')
    const holiOrigin = toAffiche(0.7369, 0.4035, 0.022)

    // 3 gerbes de poudre jetées vers l'écran : grossissent juste au-dessus du texte puis partent loin au vent vers la droite
    const holiBursts = [
      {delay: 0.00, dx: -0.06, dy: 0.05, dz: 0.34, windX: 0.78, rot: 0.10, maxScale: 1.55, maxOp: 0.86},
      {delay: 0.08, dx: -0.14, dy: 0.13, dz: 0.28, windX: 0.68, rot: -0.14, maxScale: 1.38, maxOp: 0.78},
      {delay: 0.16, dx: -0.02, dy: -0.04, dz: 0.38, windX: 0.88, rot: 0.18, maxScale: 1.68, maxOp: 0.72},
    ].map((cfg, idx) => {
      const plane = makePlane('assets/poudre-holi.png', 0.35, 660 / 792, {
        tex: holiTex,
        opacity: 0,
        renderOrder: 24 + idx,
      })
      plane.mesh.visible = false
      group.add(plane.mesh)
      return {...plane, cfg}
    })

    // -----------------------------------------------------------------------
    // 3. ÉTOILES — 14 étoiles à 4 branches scintillant en décalé (fixes)
    // -----------------------------------------------------------------------
    const starTex = loadTex('assets/etoile.png')
    const starDefs = [
      [0.3757, 0.0826, 0.0357, 0.0],
      [0.6243, 0.0833, 0.0357, 1.1],
      [0.5000, 0.2021, 0.0308, 2.2],
      [0.1949, 0.2705, 0.0193, 0.6],
      [0.3704, 0.2705, 0.0202, 1.9],
      [0.1682, 0.3882, 0.0207, 3.1],
      [0.3988, 0.3882, 0.0207, 4.2],
      [0.1096, 0.4151, 0.0280, 1.4],
      [0.4458, 0.4149, 0.0227, 2.7],
      [0.1224, 0.4688, 0.0236, 5.0],
      [0.4275, 0.4690, 0.0227, 3.6],
      [0.8716, 0.2906, 0.0202, 0.9],
      [0.1376, 0.8702, 0.0280, 2.4],
      [0.8610, 0.8702, 0.0289, 4.7],
    ]
    const starAspect = 76 / 59
    const stars = starDefs.map(([x, y, nw, phaseOffset]) => {
      const w = nw * AFFICHE_W
      const mat = new THREE.MeshBasicMaterial({
        map: starTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.2,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * starAspect), mat)
      mesh.position.copy(toAffiche(x, y, 0.006))
      mesh.renderOrder = 17
      group.add(mesh)
      return {mesh, mat, phaseOffset}
    })

    ctx.state.scenes[id] = {
      group,
      foundAt: null,
      holiBurstStart: null,
      holiParticlesHidden: false,
      lastT: 0,
      halo,
      flamePivot,
      flame,
      leftPivot,
      leftLantern,
      rightPivot,
      rightLantern,
      holiOrigin,
      holiBursts,
      stars,
    }
  },

  onLost(ctx, targetId) {
    const s = ctx.state.scenes?.[targetId]
    if (s) s.group.visible = false
  },

  onTap(ctx) {
    const id = ctx.target || 'main'
    const s = ctx.state.scenes?.[id]
    if (!s) return
    // Relance une nouvelle explosion de poudre de Holi vers l'écran
    s.holiBurstStart = s.lastT
    s.holiParticlesHidden = false
    const pBrick = ctx.bricks.get('poudre-particules')
    if (pBrick) pBrick.object3d.position.set(0, 0, 0)
    ctx.bricks.show('poudre-particules')
  },

  onUpdate(ctx, t) {
    const id = ctx.target || 'main'
    const s = ctx.state.scenes?.[id]
    if (!s) return

    s.lastT = t
    if (s.foundAt === null) {
      s.foundAt = t
      s.holiBurstStart = t
    }
    const fadeIn = Math.min(1, Math.max(0, (t - s.foundAt) / 0.45))

    // Boucle fluide de 8 s pour Diwali & étoiles
    const PERIOD = 8
    const phase = ((t % PERIOD) / PERIOD) * Math.PI * 2

    // 1. Flamme de la diya : léger vacillement latéral + variation douce de hauteur
    const sway = Math.sin(phase * 2) * 0.032 + Math.sin(phase * 5 + 0.7) * 0.018
    const stretchY = 1 + Math.sin(phase * 3 + 0.4) * 0.055 + Math.cos(phase * 7) * 0.025
    const stretchX = 1 - Math.sin(phase * 3 + 0.4) * 0.028
    s.flamePivot.rotation.z = sway
    s.flamePivot.scale.set(stretchX, stretchY, 1)
    s.flame.mat.opacity = 0.98 * fadeIn

    const glowPulse = 0.5 + 0.5 * Math.sin(phase * 2 - 0.5)
    s.halo.mat.opacity = (0.55 + glowPulse * 0.35) * fadeIn
    const glowScale = 0.98 + glowPulse * 0.06
    s.halo.mesh.scale.set(glowScale, glowScale * (1 + Math.sin(phase * 3) * 0.02), 1)

    // 2. Lanternes suspendues : balancement très léger
    s.leftPivot.rotation.z = Math.sin(phase) * 0.026
    s.rightPivot.rotation.z = Math.sin(phase + 1.4) * 0.022
    s.leftLantern.mat.opacity = fadeIn
    s.rightLantern.mat.opacity = fadeIn

    // 3. Holi : explosion vers l'écran toutes les 5 s (~2,5 s d'animation puis ~2,5 s de pause nette)
    if (t - (s.holiBurstStart ?? t) >= HOLI_REPEAT_INTERVAL) {
      s.holiBurstStart = t
      s.holiParticlesHidden = false
      const pBrickReset = ctx.bricks.get('poudre-particules')
      if (pBrickReset) pBrickReset.object3d.position.set(0, 0, 0)
      ctx.bricks.show('poudre-particules')
    }
    const elapsedBurst = t - (s.holiBurstStart ?? t)
    for (const b of s.holiBursts) {
      const localT = elapsedBurst - b.cfg.delay
      if (localT < 0 || localT > HOLI_BURST_DURATION) {
        b.mesh.visible = false
        b.mat.opacity = 0
        continue
      }
      b.mesh.visible = true
      const p = localT / HOLI_BURST_DURATION // 0..1
      const rush = 1 - Math.pow(1 - Math.min(1, p / 0.65), 3)
      const wind = p <= 0.14 ? 0 : Math.pow((p - 0.14) / 0.86, 1.25)

      b.mesh.position.set(
        s.holiOrigin.x + b.cfg.dx * rush + b.cfg.windX * wind,
        s.holiOrigin.y + b.cfg.dy * rush - wind * 0.03,
        s.holiOrigin.z + b.cfg.dz * rush,
      )
      b.mesh.rotation.z = b.cfg.rot * rush - wind * 0.18
      const sc = 0.30 + (b.cfg.maxScale - 0.30) * rush + wind * 0.18
      b.mesh.scale.set(sc, sc, 1)

      const inFade = Math.min(1, p / 0.10)
      const outFade = p < 0.42 ? 1 : Math.pow(1 - (p - 0.42) / 0.58, 1.2)
      b.mat.opacity = b.cfg.maxOp * inFade * outFade
    }

    // Dérive franche au vent vers la droite + disparition des particules autour de 2,5 s
    const pBrick = ctx.bricks.get('poudre-particules')
    if (pBrick) {
      if (elapsedBurst < 0.1) {
        pBrick.object3d.position.set(0, 0, 0)
      } else if (elapsedBurst < HOLI_BURST_DURATION) {
        const w = Math.max(0, (elapsedBurst - 0.35) / (HOLI_BURST_DURATION - 0.35))
        pBrick.object3d.position.set(Math.pow(w, 1.2) * 0.78, -w * 0.02, 0)
      }
    }
    if (!s.holiParticlesHidden && elapsedBurst >= 2.15) {
      s.holiParticlesHidden = true
      ctx.bricks.hide('poudre-particules')
    }

    // 4. Étoiles : scintillement en décalé (luminosité uniquement, position immobile)
    for (const star of s.stars) {
      const wave = 0.5 + 0.5 * Math.sin(phase * 2 + star.phaseOffset)
      const sparkle = Math.pow(wave, 2.2)
      star.mat.opacity = (0.08 + sparkle * 0.92) * fadeIn
      const sc = 0.95 + sparkle * 0.22
      star.mesh.scale.set(sc, sc, 1)
    }
  },
}
