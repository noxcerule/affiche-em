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
    // 2. HOLI — Fumée de poudre colorée qui apparaît et disparaît sur place
    // -----------------------------------------------------------------------
    const smokeVertexShader = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `

    const smokeFragmentShader = /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uDissolve;
      uniform float uSeed;
      uniform vec3 uColorCore;
      uniform vec3 uColorEdge;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.04 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = vUv - 0.5;
        vec2 p = uv * 3.8 + vec2(uSeed * 11.3, uSeed * 7.1);

        // Volutes internes de fumée (domain warping) sans déplacer le nuage
        vec2 q = vec2(
          fbm(p + vec2(0.0, -uTime * 0.34)),
          fbm(p + vec2(5.2, 1.3 - uTime * 0.26))
        );
        vec2 r = vec2(
          fbm(p + 2.3 * q + vec2(1.7, 9.2 - uTime * 0.40)),
          fbm(p + 2.3 * q + vec2(8.3, 2.8 + uTime * 0.16))
        );
        float n = fbm(p + 2.1 * r - vec2(0.0, uTime * 0.30));

        float dist = length(uv * vec2(1.0, 1.08));
        float edgeWarp = (q.x - 0.5) * 0.14 + (n - 0.5) * 0.12;
        float hardEdge = 1.0 - smoothstep(0.35, 0.49, dist);
        float mask = (1.0 - smoothstep(0.12, 0.44, dist + edgeWarp)) * hardEdge;

        float smoke = smoothstep(0.16 + uDissolve * 0.55, 0.82, n * 0.85 + 0.32 * mask);
        float alpha = mask * smoke * uOpacity;
        if (alpha < 0.005) discard;

        float coreMix = clamp(mask * n * 1.35, 0.0, 1.0);
        vec3 col = mix(uColorEdge, uColorCore, coreMix);
        col += vec3(0.08, 0.06, 0.04) * smoothstep(0.55, 0.90, r.x) * (1.0 - coreMix * 0.5);

        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `

    // 5 panaches superposés (rose, orange, jaune, vert + brume centrale) fixes au-dessus du bol
    const holiPlumes = [
      {x: 0.655, y: 0.325, z: 0.026, w: 0.25, h: 0.24, delay: 0.00, seed: 1.3, core: '#d81b60', edge: '#ff6090', maxOp: 0.84},
      {x: 0.715, y: 0.305, z: 0.034, w: 0.25, h: 0.24, delay: 0.07, seed: 3.7, core: '#ef6c00', edge: '#ffa726', maxOp: 0.80},
      {x: 0.768, y: 0.298, z: 0.042, w: 0.26, h: 0.24, delay: 0.12, seed: 6.1, core: '#f9a825', edge: '#ffe066', maxOp: 0.78},
      {x: 0.825, y: 0.328, z: 0.030, w: 0.24, h: 0.23, delay: 0.05, seed: 8.9, core: '#558b2f', edge: '#8bc34a', maxOp: 0.78},
      {x: 0.738, y: 0.292, z: 0.050, w: 0.34, h: 0.26, delay: 0.15, seed: 12.4, core: '#ff7043', edge: '#ffd180', maxOp: 0.56},
    ].map((cfg, idx) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: smokeVertexShader,
        fragmentShader: smokeFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: {value: 0},
          uOpacity: {value: 0},
          uDissolve: {value: 0.5},
          uSeed: {value: cfg.seed},
          uColorCore: {value: new THREE.Color(cfg.core)},
          uColorEdge: {value: new THREE.Color(cfg.edge)},
        },
      })
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(cfg.w * AFFICHE_W, cfg.h * AFFICHE_H),
        mat,
      )
      const origin = toAffiche(cfg.x, cfg.y, cfg.z)
      mesh.position.copy(origin)
      mesh.renderOrder = 24 + idx
      mesh.visible = false
      group.add(mesh)
      return {mesh, mat, origin, cfg}
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
      holiPlumes,
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
    // Relance une apparition de fumée colorée de Holi sur place
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

    // 3. Holi : fumée colorée fixe qui apparaît et disparaît en douceur toutes les 5 s
    if (t - (s.holiBurstStart ?? t) >= HOLI_REPEAT_INTERVAL) {
      s.holiBurstStart = t
      s.holiParticlesHidden = false
      const pBrickReset = ctx.bricks.get('poudre-particules')
      if (pBrickReset) pBrickReset.object3d.position.set(0, 0, 0)
      ctx.bricks.show('poudre-particules')
    }
    const elapsedBurst = t - (s.holiBurstStart ?? t)
    for (const plume of s.holiPlumes) {
      const localT = elapsedBurst - plume.cfg.delay
      if (localT < 0 || localT > HOLI_BURST_DURATION) {
        plume.mesh.visible = false
        plume.mat.uniforms.uOpacity.value = 0
        continue
      }
      plume.mesh.visible = true
      const p = localT / HOLI_BURST_DURATION // 0..1

      // Apparition douce (0 -> 0.28), maintien vaporeux (0.28 -> 0.58), dissipation (0.58 -> 1.0)
      const inK = Math.min(1, p / 0.28)
      const inEase = 1 - Math.pow(1 - inK, 2.2)
      const outK = p <= 0.56 ? 0 : (p - 0.56) / 0.44
      const outFade = 1 - Math.pow(outK, 1.35)

      const dissolve = (1 - inEase) * 0.42 + Math.pow(outK, 1.1) * 0.72
      const sc = 0.86 + 0.16 * (1 - Math.pow(1 - Math.min(1, p / 0.6), 2))

      plume.mesh.position.copy(plume.origin)
      plume.mesh.scale.set(sc, sc, 1)
      plume.mat.uniforms.uTime.value = t
      plume.mat.uniforms.uOpacity.value = plume.cfg.maxOp * inEase * outFade * fadeIn
      plume.mat.uniforms.uDissolve.value = dissolve
    }

    // Les particules de poudre restent strictement en place et disparaissent en douceur
    const pBrick = ctx.bricks.get('poudre-particules')
    if (pBrick) pBrick.object3d.position.set(0, 0, 0)
    if (!s.holiParticlesHidden && elapsedBurst >= 2.0) {
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
