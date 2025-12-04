import React, { useRef, useEffect } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BOOK_MEDIA } from '../data/mediaConfig'

type ModelProps = JSX.IntrinsicElements['group'] & {
  onBookcaseClick?: () => void
  onBookSelected?: (id: string | null) => void
  booksActive?: boolean
  onMapClick?: () => void
  openedBooks: Record<string, boolean>
  onBookOpened?: (id: string) => void
  mapControlRef?: React.RefObject<{ closeMap: () => void }>
  bookControlRef?: React.RefObject<{ closeActiveBook: (reason?: string) => void }>
  onBookLocked?: (id: string) => void

}

/* ---------- Advent helpers ---------- */
const mediaTextureLoader = new THREE.TextureLoader()

const getMaxUnlockedByDate = (): number => {
  let forcedDay: number | null = null

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const d = params.get('adventDay')
    if (d) {
      const n = Number(d)
      if (!Number.isNaN(n)) {
        forcedDay = Math.min(24, Math.max(0, n))
      }
    }
  }

  if (forcedDay !== null) return forcedDay

  const now = new Date()
  const month = now.getMonth()
  const day = now.getDate()

  if (month !== 11) return 0
  return Math.min(24, Math.max(0, day))
}

const canOpenBook = (
  numId: number,
  openedBooks: Record<string, boolean>
): boolean => {
  const maxDate = getMaxUnlockedByDate()
  if (numId > maxDate) return false

  for (let i = 1; i < numId; i++) {
    if (!openedBooks[String(i)]) return false
  }

  return true
}

/* ---------- Candle ---------- */

function CandleLight() {
  const ref = useRef<THREE.PointLight | null>(null)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()

    const base = 5
    const flicker =
      Math.sin(t * 10) * 0.5 +
      Math.sin(t * 17 + 1.3) * 0.3 +
      (Math.random() - 0.5) * 0.2

    ref.current.intensity = base + flicker
    ref.current.position.y = 0.06 + Math.sin(t * 8) * 0.01
  })

  return (
    <pointLight
      ref={ref}
      color="#ff8c45"
      distance={0.5}
      decay={0.3}
      intensity={0.1}
      castShadow
    />
  )
}
/* ---------- Cadeau en l'aiiiiiir ---------- */

/* ---------- Constantes livres ---------- */

const TABLE_TARGET = new THREE.Vector3(-0.2, 1.9, 0)
const TABLE_BOOK_ROTATION = new THREE.Euler(-Math.PI / 1.3, 0, 0)
const TABLE_BOOK_QUAT = new THREE.Quaternion().setFromEuler(TABLE_BOOK_ROTATION)

const COVER_OPEN_ANGLE = -Math.PI / 1.3
const COVER_OPEN_AXIS = new THREE.Vector3(0, 0, 1)


const PRESENT_NAMES = ['Present001', 'Present002', 'Present003', 'Present004', 'Present005']

export function Model({
  onBookcaseClick,
  onBookSelected,
  booksActive = false,
  onMapClick,
  openedBooks,
  onBookOpened,
  mapControlRef,
  bookControlRef,
  onBookLocked,
  ...props
}: ModelProps) {
  const onBookSelectedRef = useRef(onBookSelected)
  useEffect(() => {
    onBookSelectedRef.current = onBookSelected
  }, [onBookSelected])

  const onBookOpenedRef = useRef(onBookOpened)
  useEffect(() => {
    onBookOpenedRef.current = onBookOpened
  }, [onBookOpened])

  const openedBooksRef = useRef<Record<string, boolean>>(openedBooks)
  useEffect(() => {
    openedBooksRef.current = openedBooks
  }, [openedBooks])

  const group = useRef<THREE.Group>(null)
  const { nodes, materials, animations } = useGLTF('models/model.glb')
  const { actions } = useAnimations(animations, group)
  const onBookLockedRef = useRef(onBookLocked)
  useEffect(() => {
    onBookLockedRef.current = onBookLocked
  }, [onBookLocked])



  const activeBookId = useRef<string | null>(null)
  const bookIds = useRef<string[]>([])
  const focusBookId = useRef<string | null>(null)
  const bookFocusOffsets = useRef<Record<string, THREE.Vector3>>({})
  const coverBookId = useRef<string | null>(null)
  const coverPhase = useRef<
    'idle' | 'waitingMove' | 'opening' | 'open' | 'waitingPageDown' | 'closing'
  >('idle')

  const pendingCoverBookId = useRef<string | null>(null)
  const pendingFocusBookId = useRef<string | null>(null)
  const hoveredBookId = useRef<string | null>(null)

  const mediaPlanes = useRef<Record<string, THREE.Mesh>>({})
  const videoElements = useRef<Record<string, HTMLVideoElement>>({})
  const videoTextures = useRef<Record<string, THREE.VideoTexture>>({})
  const presentPhases = useRef<Record<string, number>>({})
  const mapActionRef = useRef<THREE.AnimationAction | null>(null)
  const mapAnimState = useRef<'closed' | 'opening' | 'open' | 'closing'>('closed')
  const mapOpenTime = useRef(0)
  const onBookcaseClickRef = useRef(onBookcaseClick)
  useEffect(() => {
    onBookcaseClickRef.current = onBookcaseClick
  }, [onBookcaseClick])

  const pendingBookcaseClick = useRef(false)

  const openMap = () => {
    const action = mapActionRef.current
    if (!action) return

    mapAnimState.current = 'opening'
    action.paused = false

    action.timeScale = Math.abs(action.timeScale) || 1.5
  }

  const closeMap = () => {
    const action = mapActionRef.current
    if (!action) return

    mapAnimState.current = 'closing'
    action.paused = false
    action.timeScale = -(Math.abs(action.timeScale) || 1.5)
  }

  useEffect(() => {
    if (!mapControlRef) return

    mapControlRef.current = {
      closeMap: () => {
        if (
          mapAnimState.current === 'open' ||
          mapAnimState.current === 'opening'
        ) {
          closeMap()
        }
      },
    }
  }, [mapControlRef])



  const mediaActiveBookId = useRef<string | null>(null)
  const mediaProgress = useRef(0)
  const bookContentGroups = useRef<Record<string, THREE.Object3D>>({})

  /* ---------- Tweaks matériaux globaux ---------- */

  PRESENT_NAMES.forEach((name, idx) => {
    presentPhases.current[name] = idx * Math.PI * 0.6
  })


  useFrame((state) => {
    const time = state.clock.getElapsedTime()

    PRESENT_NAMES.forEach((name) => {
      if (!group.current) return
      const present = group.current.getObjectByName(name) as THREE.Object3D | null
      if (!present) return

      const basePos = present.userData.basePos as THREE.Vector3
      const baseQuat = present.userData.baseQuat as THREE.Quaternion
      if (!basePos || !baseQuat) return

      const phase = presentPhases.current[name] ?? 0

      const floatAmp = 0.04
      const floatSpeed = 1.5
      const floatY = Math.sin(time * floatSpeed + phase) * floatAmp

      const orbitRadius = 0.06
      const orbitSpeed = 0.4
      const angle = time * orbitSpeed + phase

      const targetPos = new THREE.Vector3(
        basePos.x + Math.cos(angle) * orbitRadius,
        basePos.y + floatY,
        basePos.z + Math.sin(angle) * orbitRadius
      )

      present.position.lerp(targetPos, 0.08)

      const tiltAmount = 0.18
      const wobbleEuler = new THREE.Euler(
        Math.sin(time * 1.3 + phase) * tiltAmount,
        Math.sin(time * 0.9 + phase * 0.5) * tiltAmount,
        Math.sin(time * 1.7 + phase * 0.8) * tiltAmount * 0.5
      )

      const wobbleQuat = new THREE.Quaternion().setFromEuler(wobbleEuler)
      const targetQuat = baseQuat.clone().multiply(wobbleQuat)

      present.quaternion.slerp(targetQuat, 0.12)
    })
  })
  useEffect(() => {
    if (materials['Material.060']) {
      materials['Material.060'].roughness = 0.9
      materials['Material.060'].metalness = 1
      materials['Material.060'].emissive.set('#dba40f')
      materials['Material.060'].emissiveIntensity = 1
    }
  }, [materials])



  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy()

    const isMobile = /Mobi|Android/i.test(navigator.userAgent)
    const targetAniso = isMobile ? 2 : 8

    materials.anisotropy = Math.min(targetAniso, maxAniso)
    materials.wrapS = materials.wrapT = THREE.RepeatWrapping
    materials.needsUpdate = true

  }, [materials, gl])
  /* ---------- Animation de la carte (action "Open") ---------- */
  useEffect(() => {
    const action = actions['Take 001']
    if (!action) return
    action.play()

  }, [])
  useEffect(() => {
    const action = actions['Open']
    if (!action) return

    mapActionRef.current = action

    const TOTAL_FRAMES = 250

    const clip = action.getClip()
    mapOpenTime.current = (148 / TOTAL_FRAMES) * clip.duration

    action.reset()
    action.clampWhenFinished = true
    action.setLoop(THREE.LoopOnce, 1)
    action.time = 0
    action.timeScale = 0
    action.play()
    action.paused = false

    mapAnimState.current = 'closed'
  }, [actions])



  /* ---------- Init livre + Content.xxx ---------- */

  useEffect(() => {
    if (!group.current) return


    const ids = new Set<string>()
    const mediaMap: Record<string, THREE.Mesh> = {}
    const contentMap: Record<string, THREE.Object3D> = {}
    console.log(mediaMap);

    group.current.traverse((obj: any) => {
      if (!obj.userData.baseScale) obj.userData.baseScale = obj.scale.clone()
      if (!obj.userData.baseQuat) obj.userData.baseQuat = obj.quaternion.clone()
      if (!obj.userData.basePos) obj.userData.basePos = obj.position.clone()



      if (obj.name.startsWith('Book')) {
        const id = getBookId(obj.name)
        if (id) ids.add(id)
      }

      if (obj.name.startsWith('Content')) {
        let parent: THREE.Object3D | null = obj
        let bookId: string | null = null

        while (parent) {
          if (parent.name.startsWith('BookContent')) {
            bookId = getBookId(parent.name)
            break
          }
          parent = parent.parent
        }

        if (bookId && (obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh

          mediaMap[bookId] = mesh

          mesh.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true
          })

          mesh.visible = true
        }
      }

      if (obj.name.startsWith('BookContent')) {
        let parent: THREE.Object3D | null = obj
        let bookId: string | null = null

        while (parent) {
          if (parent.name.startsWith('Book')) {
            bookId = getBookId(parent.name)
            break
          }
          parent = parent.parent
        }

        if (bookId) {
          contentMap[bookId] = obj as THREE.Object3D
        }
      }
    })

    mediaPlanes.current = mediaMap
    bookContentGroups.current = contentMap


    const arr = Array.from(ids).sort()
    bookIds.current = arr

    const radius = 0.15
    const center = (arr.length - 1) / 2

    arr.forEach((id, index) => {
      const angle = (index - center) * 0.2
      const offset = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      )
      bookFocusOffsets.current[id] = offset
    })
  }, [])


  /* ---------- Helpers médias ---------- */
  const setupMediaTexture = (id: string) => {
    const plane = mediaPlanes.current[id]
    if (!plane) {
      console.warn('[MEDIA] aucun plane pour le livre', id)
      return
    }

    const config = BOOK_MEDIA[id]
    if (!config) {
      console.warn('[MEDIA] pas de config BOOK_MEDIA pour', id)
      return
    }

    const material = plane.material as THREE.MeshStandardMaterial

    if (config.type === 'image') {
      const texture = mediaTextureLoader.load(
        config.src,
        () => { },
        undefined,
        (err) => {
          console.error('[MEDIA] erreur de chargement texture pour', id, err)
        }
      )

      material.map = texture
      texture.flipY = false
      // Couleur globale du matériau = teinte sepia douce
      material.color.set(new THREE.Color(0.9, 0.85, 0.7))

      // Désature en réduisant la contribution de la texture
      material.map.encoding = THREE.SRGBColorSpace
      material.map.needsUpdate = true

      // Baisser la luminosité
      material.color.multiplyScalar(0.7)

      // Rendre la texture plus douce
      material.roughness = 1
      material.metalness = 0
      material.needsUpdate = true
      plane.visible = true

    } else if (config.type === 'video') {
      plane.visible = true
    }
  }


  const startMediaAnimation = (id: string) => {
    mediaActiveBookId.current = id
    mediaProgress.current = 0
  }


  const clearMediaForBook = (id: string) => {
    const plane = mediaPlanes.current[id]
    if (!plane) return



    if (mediaActiveBookId.current === id) {
      mediaActiveBookId.current = null
      mediaProgress.current = 0
    }
  }


  const closeActiveBook = (reason?: string) => {
    const id = focusBookId.current
    if (!id) return

    if (
      coverBookId.current === id &&
      (coverPhase.current === 'open' || coverPhase.current === 'opening')
    ) {
      console.log('close');
      
      clearMediaForBook(id)
      mediaActiveBookId.current = null

      coverPhase.current = 'waitingPageDown'

      pendingCoverBookId.current = null
      pendingFocusBookId.current = null
    } else {
      activeBookId.current = null
      focusBookId.current = null

      if (coverBookId.current === id) {
        coverBookId.current = null
      }

      coverPhase.current = 'idle'
      pendingCoverBookId.current = null
      pendingFocusBookId.current = null

      onBookSelectedRef.current?.(null)

      if (pendingBookcaseClick.current) {
        pendingBookcaseClick.current = false
        onBookcaseClickRef.current?.()
      }
    }
  }

  useEffect(() => {
    if (!bookControlRef) return

    bookControlRef.current = {
      closeActiveBook,
    }
  }, [bookControlRef])

  /* ---------- Helpers scene ---------- */

  const findBookGroup = (obj: THREE.Object3D | null) => {
    while (obj) {
      if (obj.name.startsWith('Book') || obj.name.startsWith('BookCover')) {
        return obj
      }
      obj = obj.parent as THREE.Object3D
    }
    return null
  }

  const findBookcaseGroup = (obj: THREE.Object3D | null) => {
    while (obj) {
      const name = obj.name.toLowerCase()
      if (name.includes('shelfbook') || name.includes('bookcase')) return obj
      obj = obj.parent as THREE.Object3D
    }
    return null
  }

  const findMapGroup = (obj: THREE.Object3D | null) => {
    while (obj) {
      const name = obj.name.toLowerCase()
      if (name.includes('marauder') || name.includes('map')) return obj
      obj = obj.parent as THREE.Object3D
    }
    return null
  }

  const getBookId = (name: string) => {
    const match = name.match(/\d+/)
    return match ? match[0] : null
  }

  const setBookScale = (id: string, factor: number) => {
    if (!group.current) return
    const bookGroup = group.current.getObjectByName(`Book${id}`)
    if (!bookGroup) return

    const baseScale = bookGroup.userData.baseScale as THREE.Vector3
    if (!baseScale) return

    if (factor === 1) {
      bookGroup.scale.copy(baseScale)
    } else {
      bookGroup.scale.set(
        baseScale.x * factor,
        baseScale.y * factor,
        baseScale.z * factor
      )
    }
  }

  const isFromBookContent = (obj: THREE.Object3D | null) => {
    while (obj) {
      if (obj.name.startsWith('BookContent')) {
        return true           // 👉 clic sur la page / son container
      }
      obj = obj.parent as THREE.Object3D | null
    }
    return false
  }

  /* ---------- Click ---------- */

  const handleClick = (e: any) => {
    e.stopPropagation()
    const obj = e.object as THREE.Object3D

    if (isFromBookContent(obj)) {
      return
    }

    // 1) Livres
    const bookGroup = findBookGroup(obj)
    if (bookGroup) {
      const id = getBookId(bookGroup.name)


      if (!booksActive) {
        if (
          mapAnimState.current === 'open' ||
          mapAnimState.current === 'opening'
        ) {
          closeMap()
        }

        closeActiveBook()

        onBookcaseClick?.()
        return
      }

      if (id) {
        const numId = parseInt(id, 10)
        const opened = openedBooksRef.current

        if (!canOpenBook(numId, opened)) {
          onBookLockedRef.current?.(id)
          return
        }

        const isCurrentlyFocused = focusBookId.current === id

        if (isCurrentlyFocused) {
          activeBookId.current = null
          onBookSelectedRef.current?.(null)

          if (
            coverBookId.current === id &&
            (coverPhase.current === 'open' || coverPhase.current === 'opening')
          ) {
            coverPhase.current = 'waitingPageDown'
          }

          pendingCoverBookId.current = null
          pendingFocusBookId.current = null
          return
        }
        activeBookId.current = id

        if (focusBookId.current === null) {
          focusBookId.current = id
          coverBookId.current = id
          coverPhase.current = 'waitingMove'
          pendingCoverBookId.current = null
          pendingFocusBookId.current = null

          setupMediaTexture(id)

          onBookSelectedRef.current?.(id)
          return
        }
        pendingCoverBookId.current = id
        pendingFocusBookId.current = id

        if (coverBookId.current === null) {
          focusBookId.current = id
          coverBookId.current = id
          coverPhase.current = 'waitingMove'
          pendingCoverBookId.current = null
          pendingFocusBookId.current = null

          setupMediaTexture(id)

          onBookSelectedRef.current?.(id)
        } else if (
          coverPhase.current === 'open' ||
          coverPhase.current === 'opening'
        ) {
          if (coverBookId.current) {
            clearMediaForBook(coverBookId.current)
          }
          mediaActiveBookId.current = null
          coverPhase.current = 'waitingPageDown'
        }

        return
      }
    }

    const mapGroup = findMapGroup(obj)
    if (mapGroup) {
      const state = mapAnimState.current

      if (state === 'closed' || state === 'closing') {
        openMap()
      } else if (state === 'open' || state === 'opening') {
        closeMap()
      }

      onMapClick?.()
      return
    }

    const shelfGroup = findBookcaseGroup(obj)
    if (shelfGroup) {
      if (
        mapAnimState.current === 'open' ||
        mapAnimState.current === 'opening'
      ) {
        closeMap()
      }

      const hasFocusedBook = !!focusBookId.current

      if (hasFocusedBook) {
        pendingBookcaseClick.current = true
        closeActiveBook()
      } else {
        onBookcaseClick?.()
      }

      return
    }
  }


  /* ---------- Animation frame ---------- */

useFrame((state) => {
  if (!group.current) return

  // ----- ANIM CARTE (Open) -----
  const mapAction = mapActionRef.current
  if (mapAction) {
    if (mapAnimState.current === 'opening') {
      if (mapAction.time >= mapOpenTime.current) {
        mapAction.time = mapOpenTime.current
        mapAction.timeScale = 0
        mapAnimState.current = 'open'
      }
    }

    if (mapAnimState.current === 'closing') {
      if (mapAction.time <= 0) {
        mapAction.time = 0
        mapAction.timeScale = 0
        mapAnimState.current = 'closed'
      }
    }
  }

  const t = state.clock.getElapsedTime()
    // ----- GLOW LIVRE DU JOUR -----
    const glowSpeed = 4
    const glowStrength = 0.5

    const pulse = (Math.sin(t * glowSpeed) + 1) * 0.5 * glowStrength

    Object.values(materials).forEach((mat: any) => {
      if (!mat.userData?.isTodayGlow) return

      // Base emissive + glow
      const base = mat.userData.baseEmissive
      mat.emissive.setRGB(
        base.r + pulse,
        base.g + pulse * 0.8,
        base.b + pulse * 0.5,
      )
      mat.emissiveIntensity = 100
    })

     if (booksActive) {
    state.raycaster.setFromCamera(state.pointer, state.camera)
    const hits = state.raycaster.intersectObjects(group.current.children, true)

    let newHoverId: string | null = null

    if (hits.length > 0) {
      const hitObj = hits[0].object as THREE.Object3D
      const bookGroup = findBookGroup(hitObj)
      if (bookGroup) {
        const id = getBookId(bookGroup.name)
        if (id) newHoverId = id
      }
    }

    if (newHoverId !== hoveredBookId.current) {
      if (hoveredBookId.current) {
        setBookScale(hoveredBookId.current, 1)
      }

      hoveredBookId.current = newHoverId

      if (newHoverId && activeBookId.current !== newHoverId) {
        setBookScale(newHoverId, 1.02)
      }
    }
  } else {
    if (hoveredBookId.current) {
      setBookScale(hoveredBookId.current, 1)
      hoveredBookId.current = null
    }
  }

    const lerpFactorPos = 0.05
    const lerpFactorRot = 0.02
    const coverSpeed = 0.04
    const distThreshold = 0.02

    const floatAmp = 0.02
    const floatSpeed = 2

    bookIds.current.forEach((id) => {
      const bookGroup = group.current!.getObjectByName(
        `Book${id}`
      ) as THREE.Object3D | null
      const coverGroup = group.current!.getObjectByName(
        `BookCover${id}`
      ) as THREE.Object3D | null
      if (!bookGroup) return

      const basePos = bookGroup.userData.basePos as THREE.Vector3
      const baseQuat = bookGroup.userData.baseQuat as THREE.Quaternion

      const numId = parseInt(id, 10)
      const opened = !!openedBooksRef.current[id]
      const available = !opened && canOpenBook(numId, openedBooksRef.current)


      const isFocused = focusBookId.current === id

      let focusPos: THREE.Vector3
      if (isFocused) {
        const offset = bookFocusOffsets.current[id]
        focusPos = offset ? TABLE_TARGET.clone().add(offset) : TABLE_TARGET.clone()
      } else {
        focusPos = basePos
      }

      let targetPos = focusPos
      if (isFocused) {
        const floatY = Math.sin(t * floatSpeed) * floatAmp
        targetPos = focusPos.clone()
        targetPos.y += floatY
      }

      const targetQuat = isFocused ? TABLE_BOOK_QUAT : baseQuat

      bookGroup.position.lerp(targetPos, lerpFactorPos)
      bookGroup.quaternion.slerp(targetQuat, lerpFactorRot)

      if (coverBookId.current === id && coverPhase.current === 'waitingMove') {
        const dist = bookGroup.position.distanceTo(focusPos)
        if (dist < distThreshold) {
          coverPhase.current = 'opening'
        }
      }

      if (coverGroup) {
        if (coverGroup.userData.openProgress === undefined) {
          coverGroup.userData.openProgress = 0
        }
        let progress = coverGroup.userData.openProgress as number

        let targetProgress = coverGroup.userData.openProgress as number

        if (coverBookId.current === id) {
          if (
            coverPhase.current === 'opening' ||
            coverPhase.current === 'open' ||
            coverPhase.current === 'waitingPageDown'
          ) {
            targetProgress = 1
          } else if (coverPhase.current === 'closing') {
            targetProgress = 0
          }
        } else {
          targetProgress = 0
        }


        progress += (targetProgress - progress) * coverSpeed
        coverGroup.userData.openProgress = progress

        if (coverBookId.current === id) {
          if (
            coverPhase.current === 'opening' &&
            Math.abs(1 - progress) < 0.01
          ) {
            coverPhase.current = 'open'

            startMediaAnimation(id)

            const openedMap = openedBooksRef.current
            if (!openedMap[id]) {
              onBookOpenedRef.current?.(id)
            }
          }

          if (coverPhase.current === 'closing' && progress < 0.01) {
            if (pendingCoverBookId.current && pendingFocusBookId.current) {
              const nextId = pendingFocusBookId.current
              coverBookId.current = pendingCoverBookId.current
              focusBookId.current = nextId
              coverPhase.current = 'waitingMove'
              pendingCoverBookId.current = null
              pendingFocusBookId.current = null

              setupMediaTexture(nextId)

              onBookSelectedRef.current?.(nextId)
            } else {
              coverBookId.current = null
              coverPhase.current = 'idle'
              focusBookId.current = null
              onBookSelectedRef.current?.(null)

              if (pendingBookcaseClick.current) {
                pendingBookcaseClick.current = false
                onBookcaseClickRef.current?.()
              }
            }
          }
        }

        const baseQuatCover = coverGroup.userData.baseQuat as THREE.Quaternion
        const angle = COVER_OPEN_ANGLE * progress
        const openQuat = new THREE.Quaternion().setFromAxisAngle(
          COVER_OPEN_AXIS,
          angle
        )
        const coverTargetQuat = baseQuatCover.clone().multiply(openQuat)
        coverGroup.quaternion.slerp(coverTargetQuat, 0.2)
      }
    })
    if (mediaActiveBookId.current && group.current) {
      const id = mediaActiveBookId.current
      const contentGroup = bookContentGroups.current[id]

      if (contentGroup) {
        const basePos = contentGroup.userData.basePos as THREE.Vector3
        const baseQuat = contentGroup.userData.baseQuat as THREE.Quaternion
        const parent = contentGroup.parent as THREE.Object3D | null
        if (!parent) return

        mediaProgress.current = THREE.MathUtils.clamp(
          mediaProgress.current + 0.05,
          0,
          1
        )
        const p = mediaProgress.current

        const cam = state.camera

        const forward = new THREE.Vector3()
        cam.getWorldDirection(forward)
        forward.normalize()

        const up = new THREE.Vector3(0, 0, 0)

        const targetWorldPos = new THREE.Vector3()
          .copy(cam.position)
          .add(forward.multiplyScalar(0.6))
          .add(up.multiplyScalar(-0.1))

        const targetLocalPos = targetWorldPos.clone()
        parent.worldToLocal(targetLocalPos)

        const interpolatedLocalPos = basePos.clone().lerp(targetLocalPos, p)
        contentGroup.position.lerp(interpolatedLocalPos, 0.2)

        // 1️⃣ Quaternion monde de la caméra
        const camWorldQuat = new THREE.Quaternion()
        cam.getWorldQuaternion(camWorldQuat)

        // 2️⃣ On ne garde que la rotation Y (yaw) de la caméra
        const camEuler = new THREE.Euler().setFromQuaternion(camWorldQuat, 'YXZ')
        camEuler.x = -0.6  // pas de pitch
        camEuler.z = -Math.PI / 2   // pas de roll
        const camYawQuat = new THREE.Quaternion().setFromEuler(camEuler)

        // 3️⃣ Optionnel : flip si tu veux que la page soit orientée
        // "face caméra" au lieu de lui tourner le dos
        const flipQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          Math.PI
        )

        // 👉 quaternion cible en espace MONDE : vertical + tournée vers la caméra
        const targetWorldQuat = camYawQuat.multiply(flipQuat)

        // 4️⃣ Conversion monde → local par rapport au parent
        const parentWorldQuat = new THREE.Quaternion()
        parent.getWorldQuaternion(parentWorldQuat)
        const parentWorldQuatInv = parentWorldQuat.clone().invert()

        const targetLocalQuat = targetWorldQuat.clone().premultiply(parentWorldQuatInv)

        // 5️⃣ Interpolation depuis la pose de base
        const interpolatedLocalQuat = baseQuat.clone().slerp(targetLocalQuat, p)
        contentGroup.quaternion.copy(interpolatedLocalQuat)

      }
    } else {
      if (coverBookId.current && coverPhase.current === 'waitingPageDown') {
        const id = coverBookId.current
        const contentGroup = bookContentGroups.current[id]
        if (contentGroup) {
          const basePos = contentGroup.userData.basePos as THREE.Vector3
          const dist = contentGroup.position.distanceTo(basePos)

          if (dist < 0.01) {
            coverPhase.current = 'closing'
          }
        }
      }

      Object.values(bookContentGroups.current).forEach((obj) => {
        const basePos = obj.userData.basePos as THREE.Vector3
        const baseQuat = obj.userData.baseQuat as THREE.Quaternion
        if (!basePos || !baseQuat) return

        obj.position.lerp(basePos, 0.05)
        obj.quaternion.slerp(baseQuat, 0.05)
      })
    }

  })

  return (
    <group ref={group} {...props} dispose={null} onClick={handleClick}>
      <group name="Scene">
        <group name="Sketchfab_model" position={[0.563, 0.901, 2.313]} rotation={[-Math.PI / 2, 0, -0.541]} scale={4.524}>
          <group name="marauders_mapfbx" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
            <group name="Object_2">
              <group name="RootNode">
                <group name="Object_4">
                  <primitive object={nodes._rootJoint} />
                  <group name="marauders_map" scale={0.394} />
                  <group name="Object_6001" scale={0.394} />
                  <skinnedMesh name="Object_7001" geometry={nodes.Object_7001.geometry} material={materials['m_marauders_map_back.001']} skeleton={nodes.Object_7001.skeleton} castShadow />
                  <skinnedMesh name="Object_8001" geometry={nodes.Object_8001.geometry} material={materials['m_marauders_map.001']} skeleton={nodes.Object_8001.skeleton} castShadow />
                </group>
              </group>
            </group>
          </group>
        </group>
        <group name="Sketchfab_model001" position={[1.209, 0.673, 1.478]} rotation={[-Math.PI / 2, 0, 2.289]} scale={0.025}>
          <group name="root">
            <group name="GLTF_SceneRootNode" rotation={[Math.PI / 2, 0, 0]}>
              <group name="RootNode_(gltf_orientation_matrix)_0" rotation={[-Math.PI / 2, 0, 0]}>
                <group name="RootNode_(model_correction_matrix)_1">
                  <group name="catfbx_2" rotation={[Math.PI / 2, 0, 0]}>
                    <group name="_3">
                      <group name="RootNode_4">
                        <group name="_5">
                          <group name="GLTF_created_0">
                            <primitive object={nodes.GLTF_created_0_rootJoint} />
                            <group name="_10" />
                            <group name="_8" />
                            <group name="_9" />
                            <skinnedMesh name="Object_12001" geometry={nodes.Object_12001.geometry} material={materials.Material_81} skeleton={nodes.Object_12001.skeleton} castShadow receiveShadow />
                            <skinnedMesh name="Object_14" geometry={nodes.Object_14.geometry} material={materials.Material_105} skeleton={nodes.Object_14.skeleton} castShadow receiveShadow />
                            <skinnedMesh name="Object_16" geometry={nodes.Object_16.geometry} material={materials.Material_93} skeleton={nodes.Object_16.skeleton} castShadow receiveShadow />
                          </group>
                        </group>
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
        <mesh name="Candle001" geometry={nodes.Candle001.geometry} material={materials['LowCandle.003']} position={[0.559, 0.183, 2.323]} scale={0.031}>
          <CandleLight />
          <mesh name="Flame008" geometry={nodes.Flame008.geometry} material={materials['candle_flame2.002']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh name="Flame009" geometry={nodes.Flame009.geometry} material={materials['candle_flame2.002']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh name="Flame010" geometry={nodes.Flame010.geometry} material={materials['candle_flame2.002']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, -0.873]} />
          <mesh name="Flame011" geometry={nodes.Flame011.geometry} material={materials['candle_flame2.002']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, -0.698]} />
          <mesh name="Flame012" geometry={nodes.Flame012.geometry} material={materials['candle_flame2.002']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 6]} />
          <mesh name="Flame013" geometry={nodes.Flame013.geometry} material={materials['candle_flame2.002']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 9]} />
          <mesh name="Flame014" geometry={nodes.Flame014.geometry} material={materials['candle_flame2.002']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </mesh>
        <group name="Shelfbook" position={[0.493, 0.598, -1.523]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} scale={0.32}>
          <mesh name="Sheftbook" castShadow receiveShadow geometry={nodes.Sheftbook.geometry} material={materials['Object002_mtl.002']} />
          <mesh name="Sheftbook_1" castShadow receiveShadow geometry={nodes.Sheftbook_1.geometry} material={materials['Object003_mtl.002']} />
          <mesh name="Sheftbook_2" castShadow receiveShadow geometry={nodes.Sheftbook_2.geometry} material={materials['Object007_mtl.001']} />
          <mesh name="Sheftbook_3" castShadow receiveShadow geometry={nodes.Sheftbook_3.geometry} material={materials['Object006_mtl.002']} />
          <mesh name="Sheftbook_4" castShadow receiveShadow geometry={nodes.Sheftbook_4.geometry} material={materials['Object005_mtl.002']} />
          <mesh name="Sheftbook_5" castShadow receiveShadow geometry={nodes.Sheftbook_5.geometry} material={materials['Object003_mtl.001']} />
          <mesh name="Sheftbook_6" castShadow receiveShadow geometry={nodes.Sheftbook_6.geometry} material={materials['Object004_mtl.001']} />
          <mesh name="Sheftbook_7" castShadow receiveShadow geometry={nodes.Sheftbook_7.geometry} material={materials['Object002_mtl.001']} />
          <mesh name="Sheftbook_8" castShadow receiveShadow geometry={nodes.Sheftbook_8.geometry} material={materials['Object001_mtl.001']} />
          <mesh name="Sheftbook_9" castShadow receiveShadow geometry={nodes.Sheftbook_9.geometry} material={materials['Object001_mtl.002']} />
          <mesh name="Sheftbook_10" castShadow receiveShadow geometry={nodes.Sheftbook_10.geometry} material={materials['Object007_mtl.002']} />
          <mesh name="Sheftbook_11" castShadow receiveShadow geometry={nodes.Sheftbook_11.geometry} material={materials['Object007_mtl.003']} />
          <mesh name="Sheftbook_12" castShadow receiveShadow geometry={nodes.Sheftbook_12.geometry} material={materials['Object006_mtl.003']} />
          <mesh name="Sheftbook_13" castShadow receiveShadow geometry={nodes.Sheftbook_13.geometry} material={materials['Object001_mtl.003']} />
          <mesh name="Sheftbook_14" castShadow receiveShadow geometry={nodes.Sheftbook_14.geometry} material={materials['Object003_mtl.003']} />
          <mesh name="Sheftbook_15" castShadow receiveShadow geometry={nodes.Sheftbook_15.geometry} material={materials['Object004_mtl.002']} />
          <mesh name="Sheftbook_16" castShadow receiveShadow geometry={nodes.Sheftbook_16.geometry} material={materials['Object005_mtl.003']} />
          <mesh name="Sheftbook_17" castShadow receiveShadow geometry={nodes.Sheftbook_17.geometry} material={materials['Object007_mtl.004']} />
          <mesh name="Sheftbook_18" castShadow receiveShadow geometry={nodes.Sheftbook_18.geometry} material={materials['Object006_mtl.004']} />
          <mesh name="Sheftbook_19" castShadow receiveShadow geometry={nodes.Sheftbook_19.geometry} material={materials['Object007_mtl.005']} />
          <mesh name="Sheftbook_20" castShadow receiveShadow geometry={nodes.Sheftbook_20.geometry} material={materials['Object006_mtl.005']} />
          <mesh name="Sheftbook_21" castShadow receiveShadow geometry={nodes.Sheftbook_21.geometry} material={materials['Object007_mtl.006']} />
          <mesh name="Sheftbook_22" castShadow receiveShadow geometry={nodes.Sheftbook_22.geometry} material={materials['Object006_mtl.006']} />
          <mesh name="Sheftbook_23" castShadow receiveShadow geometry={nodes.Sheftbook_23.geometry} material={materials['Object005_mtl.004']} />
          <mesh name="Sheftbook_24" castShadow receiveShadow geometry={nodes.Sheftbook_24.geometry} material={materials['Object005_mtl.005']} />
          <mesh name="Sheftbook_25" castShadow receiveShadow geometry={nodes.Sheftbook_25.geometry} material={materials['Object002_mtl.003']} />
          <mesh name="Sheftbook_26" castShadow receiveShadow geometry={nodes.Sheftbook_26.geometry} material={materials['Object003_mtl.007']} />
          <mesh name="Sheftbook_27" castShadow receiveShadow geometry={nodes.Sheftbook_27.geometry} material={materials['Object002_mtl.004']} />
          <mesh name="Sheftbook_28" castShadow receiveShadow geometry={nodes.Sheftbook_28.geometry} material={materials['Object003_mtl.005']} />
          <mesh name="Sheftbook_29" castShadow receiveShadow geometry={nodes.Sheftbook_29.geometry} material={materials['Object002_mtl.005']} />
          <mesh name="Sheftbook_30" castShadow receiveShadow geometry={nodes.Sheftbook_30.geometry} material={materials['Object003_mtl.006']} />
          <mesh name="Sheftbook_31" castShadow receiveShadow geometry={nodes.Sheftbook_31.geometry} material={materials['Object001_mtl.004']} />
          <mesh name="Sheftbook_32" castShadow receiveShadow geometry={nodes.Sheftbook_32.geometry} material={materials['Object001_mtl.006']} />
          <mesh name="Sheftbook_33" castShadow receiveShadow geometry={nodes.Sheftbook_33.geometry} material={materials['Object001_mtl.007']} />
          <mesh name="Sheftbook_34" castShadow receiveShadow geometry={nodes.Sheftbook_34.geometry} material={materials['Object005_mtl.007']} />
          <mesh name="Sheftbook_35" castShadow receiveShadow geometry={nodes.Sheftbook_35.geometry} material={materials['Object006_mtl.007']} />
          <mesh name="Sheftbook_36" castShadow receiveShadow geometry={nodes.Sheftbook_36.geometry} material={materials['Object003_mtl.008']} />
          <mesh name="Sheftbook_37" castShadow receiveShadow geometry={nodes.Sheftbook_37.geometry} material={materials['Object004_mtl.006']} />
          <mesh name="Sheftbook_38" castShadow receiveShadow geometry={nodes.Sheftbook_38.geometry} material={materials['Object005_mtl.008']} />
          <mesh name="Sheftbook_39" castShadow receiveShadow geometry={nodes.Sheftbook_39.geometry} material={materials['Object003_mtl.009']} />
          <mesh name="Sheftbook_40" castShadow receiveShadow geometry={nodes.Sheftbook_40.geometry} material={materials['Object004_mtl.007']} />
          <mesh name="Sheftbook_41" castShadow receiveShadow geometry={nodes.Sheftbook_41.geometry} material={materials['Object005_mtl.009']} />
          <mesh name="Sheftbook_42" castShadow receiveShadow geometry={nodes.Sheftbook_42.geometry} material={materials['Object005_mtl.010']} />
          <mesh name="Sheftbook_43" castShadow receiveShadow geometry={nodes.Sheftbook_43.geometry} material={materials['Object006_mtl.008']} />
          <mesh name="Sheftbook_44" castShadow receiveShadow geometry={nodes.Sheftbook_44.geometry} material={materials['Object003_mtl.010']} />
          <mesh name="Sheftbook_45" castShadow receiveShadow geometry={nodes.Sheftbook_45.geometry} material={materials['Object004_mtl.008']} />
          <mesh name="Sheftbook_46" castShadow receiveShadow geometry={nodes.Sheftbook_46.geometry} material={materials['Object005_mtl.011']} />
          <mesh name="Sheftbook_47" castShadow receiveShadow geometry={nodes.Sheftbook_47.geometry} material={materials.Bookshelf} />
          <mesh name="Sheftbook_48" castShadow receiveShadow geometry={nodes.Sheftbook_48.geometry} material={materials.Knobs} />
          <mesh name="Sheftbook_49" castShadow receiveShadow geometry={nodes.Sheftbook_49.geometry} material={materials.Object007_mtl} />
          <mesh name="Sheftbook_50" castShadow receiveShadow geometry={nodes.Sheftbook_50.geometry} material={materials.Object006_mtl} />
          <mesh name="Sheftbook_51" castShadow receiveShadow geometry={nodes.Sheftbook_51.geometry} material={materials.Object003_mtl} />
          <mesh name="Sheftbook_52" castShadow receiveShadow geometry={nodes.Sheftbook_52.geometry} material={materials.Object004_mtl} />
          <mesh name="Sheftbook_53" castShadow receiveShadow geometry={nodes.Sheftbook_53.geometry} material={materials.Object005_mtl} />
          <mesh name="Sheftbook_54" castShadow receiveShadow geometry={nodes.Sheftbook_54.geometry} material={materials.Object001_mtl} />
          <mesh name="Sheftbook_55" castShadow receiveShadow geometry={nodes.Sheftbook_55.geometry} material={materials.Object002_mtl} />
        </group>
        <group name="Book002" position={[-0.335, 1.717, -1.527]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.348}>
          <mesh name="BookBody002" castShadow receiveShadow geometry={nodes.BookBody002.geometry} material={materials['Object007_mtl.008']} />
          <mesh name="BookBody002_1" castShadow receiveShadow geometry={nodes.BookBody002_1.geometry} material={materials['Object006_mtl.009']} />
          <mesh name="BookBody002_2" castShadow receiveShadow geometry={nodes.BookBody002_2.geometry} material={materials['Material.004']} />
          <mesh name="BookContent002" castShadow receiveShadow geometry={nodes.BookContent002.geometry} material={materials['blinn1SG.004']} position={[-0.007, -0.047, 0.008]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.037}>
            <mesh name="Content002" castShadow receiveShadow geometry={nodes.Content002.geometry} material={nodes.Content002.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover002" position={[-0.442, -0.103, 0.627]} rotation={[0, 0, -0.002]}>
            <mesh name="Object007_Object007_mtl_0010" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0010.geometry} material={materials['Object007_mtl.008']} />
            <mesh name="Object007_Object007_mtl_0010_1" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0010_1.geometry} material={materials['Object006_mtl.009']} />
            <mesh name="Object007_Object007_mtl_0010_2" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0010_2.geometry} material={materials['Material.005']} />
          </group>
          <mesh name="Text002" castShadow receiveShadow geometry={nodes.Text002.geometry} material={materials['Material.060']} position={[-0.506, 0.059, -0.604]} rotation={[3.117, 0, 1.571]} scale={0.226} />
        </group>
        <group name="Book001" position={[-0.153, 1.683, -1.491]} rotation={[-Math.PI / 2, -0.147, 1.571]} scale={0.32}>
          <mesh name="BookBody001" castShadow receiveShadow geometry={nodes.BookBody001.geometry} material={materials['Object002_mtl.006']} />
          <mesh name="BookBody001_1" castShadow receiveShadow geometry={nodes.BookBody001_1.geometry} material={materials['Object003_mtl.011']} />
          <mesh name="BookBody001_2" castShadow receiveShadow geometry={nodes.BookBody001_2.geometry} material={materials['Material.003']} />
          <mesh name="BookContent001" castShadow receiveShadow geometry={nodes.BookContent001.geometry} material={materials.blinn1SG} position={[0.005, 0.025, 0.028]} rotation={[-1.595, 0.025, -Math.PI / 2]} scale={0.027}>
            <mesh name="Content001" castShadow receiveShadow geometry={nodes.Content001.geometry} material={nodes.Content001.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover001" position={[-0.316, -0.047, 0.586]} rotation={[0, 0, 0.001]}>
            <mesh name="Object002_Object002_mtl_0008" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0008.geometry} material={materials['Object002_mtl.006']} />
            <mesh name="Object002_Object002_mtl_0008_1" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0008_1.geometry} material={materials['Object003_mtl.011']} />
            <mesh name="Object002_Object002_mtl_0008_2" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0008_2.geometry} material={materials['Material.002']} />
          </group>
          <mesh name="Text001" castShadow receiveShadow geometry={nodes.Text001.geometry} material={materials['Material.060']} position={[-0.364, 0.039, -0.553]} rotation={[3.11, 0, 1.571]} scale={0.246} />
        </group>
        <group name="Book003" position={[-0.432, 1.701, -1.503]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.35}>
          <mesh name="BookBody003" castShadow receiveShadow geometry={nodes.BookBody003.geometry} material={materials['Object001_mtl.008']} />
          <mesh name="BookBody003_1" castShadow receiveShadow geometry={nodes.BookBody003_1.geometry} material={materials['Object007_mtl.008']} />
          <mesh name="BookBody003_2" castShadow receiveShadow geometry={nodes.BookBody003_2.geometry} material={materials['Material.010']} />
          <mesh name="BookContent003" castShadow receiveShadow geometry={nodes.BookContent003.geometry} material={materials['blinn1SG.007']} position={[-0.002, -0.031, 0.031]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.03}>
            <mesh name="Content003" castShadow receiveShadow geometry={nodes.Content003.geometry} material={nodes.Content003.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover003" position={[-0.373, -0.084, 0.586]}>
            <mesh name="Object001_Object001_mtl_0010" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0010.geometry} material={materials['Object001_mtl.008']} />
            <mesh name="Object001_Object001_mtl_0010_1" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0010_1.geometry} material={materials['Object007_mtl.008']} />
            <mesh name="Object001_Object001_mtl_0010_2" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0010_2.geometry} material={materials['Material.011']} />
          </group>
          <mesh name="Text003" castShadow receiveShadow geometry={nodes.Text003.geometry} material={materials['Material.060']} position={[-0.409, 0.051, 0.388]} rotation={[3.117, 0, 1.571]} scale={0.225} />
        </group>
        <group name="Book004" position={[-0.52, 1.721, -1.565]} rotation={[-Math.PI / 2, 0, 1.571]} scale={[0.655, 0.655, 0.448]}>
          <mesh name="BookBody004" castShadow receiveShadow geometry={nodes.BookBody004.geometry} material={materials['Object005_mtl.013']} />
          <mesh name="BookBody004_1" castShadow receiveShadow geometry={nodes.BookBody004_1.geometry} material={materials['Object006_mtl.010']} />
          <mesh name="BookBody004_2" castShadow receiveShadow geometry={nodes.BookBody004_2.geometry} material={materials['Material.008']} />
          <mesh name="BookContent004" castShadow receiveShadow geometry={nodes.BookContent004.geometry} material={materials['blinn1SG.010']} position={[0.006, 0.022, -0.002]} rotation={[-1.605, 0.037, -1.559]} scale={[0.032, 0.022, 0.022]}>
            <mesh name="Content004" castShadow receiveShadow geometry={nodes.Content004.geometry} material={nodes.Content004.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover004" position={[-0.29, -0.06, 0.507]}>
            <mesh name="Object005_Object005_mtl_0012" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0012.geometry} material={materials['Object005_mtl.013']} />
            <mesh name="Object005_Object005_mtl_0012_1" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0012_1.geometry} material={materials['Object006_mtl.010']} />
            <mesh name="Object005_Object005_mtl_0012_2" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0012_2.geometry} material={materials['Material.009']} />
          </group>
          <mesh name="Text004" castShadow receiveShadow geometry={nodes.Text004.geometry} material={materials['Material.060']} position={[-0.335, 0.031, -0.464]} rotation={[3.116, 0.009, 1.571]} scale={[0.12, 0.12, 0.176]} />
        </group>
        <group name="Book005" position={[-0.648, 1.719, -1.524]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.396}>
          <mesh name="BookBody005" castShadow receiveShadow geometry={nodes.BookBody005.geometry} material={materials['Object003_mtl.012']} />
          <mesh name="BookBody005_1" castShadow receiveShadow geometry={nodes.BookBody005_1.geometry} material={materials['Object004_mtl.010']} />
          <mesh name="BookBody005_2" castShadow receiveShadow geometry={nodes.BookBody005_2.geometry} material={materials['Object005_mtl.013']} />
          <mesh name="BookBody005_3" castShadow receiveShadow geometry={nodes.BookBody005_3.geometry} material={materials['Material.006']} />
          <mesh name="BookContent005" castShadow receiveShadow geometry={nodes.BookContent005.geometry} material={materials['blinn1SG.011']} position={[0.032, 0.135, -0.001]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.03}>
            <mesh name="Content005" castShadow receiveShadow geometry={nodes.Content005.geometry} material={nodes.Content005.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover005" position={[-0.344, -0.154, 0.556]}>
            <mesh name="Object003_Object003_mtl_0014" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0014.geometry} material={materials['Object003_mtl.012']} />
            <mesh name="Object003_Object003_mtl_0014_1" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0014_1.geometry} material={materials['Object004_mtl.010']} />
            <mesh name="Object003_Object003_mtl_0014_2" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0014_2.geometry} material={materials['Material.007']} />
          </group>
          <mesh name="Text005" castShadow receiveShadow geometry={nodes.Text005.geometry} material={materials['Material.060']} position={[-0.399, 0.044, -0.098]} rotation={[3.117, 0, 1.571]} scale={0.199} />
        </group>
        <group name="Book006" position={[-0.227, 1.7, -1.505]} rotation={[-Math.PI / 2, -0.08, 1.571]} scale={0.35}>
          <mesh name="BookBody006" castShadow receiveShadow geometry={nodes.BookBody006.geometry} material={materials['Object001_mtl.009']} />
          <mesh name="BookBody006_1" castShadow receiveShadow geometry={nodes.BookBody006_1.geometry} material={materials['Object007_mtl.009']} />
          <mesh name="BookBody006_2" castShadow receiveShadow geometry={nodes.BookBody006_2.geometry} material={materials['Material.013']} />
          <mesh name="BookContent006" castShadow receiveShadow geometry={nodes.BookContent006.geometry} material={materials['blinn1SG.012']} position={[-0.001, -0.046, 0.011]} rotation={[-1.596, 0.025, -Math.PI / 2]} scale={0.029}>
            <mesh name="Content006" castShadow receiveShadow geometry={nodes.Content006.geometry} material={nodes.Content006.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover006" position={[-0.373, -0.084, 0.586]}>
            <mesh name="Object001_Object001_mtl_0011" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0011.geometry} material={materials['Object001_mtl.009']} />
            <mesh name="Object001_Object001_mtl_0011_1" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0011_1.geometry} material={materials['Object007_mtl.009']} />
            <mesh name="Object001_Object001_mtl_0011_2" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0011_2.geometry} material={materials['Material.012']} />
          </group>
          <mesh name="Text006" castShadow receiveShadow geometry={nodes.Text006.geometry} material={materials['Material.060']} position={[-0.411, 0.053, -0.052]} rotation={[3.123, 0, 1.571]} scale={0.225} />
        </group>
        <group name="Book007" position={[-0.053, 1.696, -1.548]} rotation={[-Math.PI / 2, 0, 1.571]} scale={[0.582, 0.582, 0.398]}>
          <mesh name="BookBody007" castShadow receiveShadow geometry={nodes.BookBody007.geometry} material={materials['Object005_mtl.014']} />
          <mesh name="BookBody007_1" castShadow receiveShadow geometry={nodes.BookBody007_1.geometry} material={materials['Object006_mtl.011']} />
          <mesh name="BookBody007_2" castShadow receiveShadow geometry={nodes.BookBody007_2.geometry} material={materials['Material.015']} />
          <mesh name="BookContent007" castShadow receiveShadow geometry={nodes.BookContent007.geometry} material={materials['blinn1SG.016']} position={[0.026, -0.023, -0.002]} rotation={[-1.605, 0.037, -1.559]} scale={[0.032, 0.022, 0.022]}>
            <mesh name="Content007" castShadow receiveShadow geometry={nodes.Content007.geometry} material={nodes.Content007.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover007" position={[-0.29, -0.06, 0.507]}>
            <mesh name="Object005_Object005_mtl_0013" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0013.geometry} material={materials['Object005_mtl.014']} />
            <mesh name="Object005_Object005_mtl_0013_1" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0013_1.geometry} material={materials['Object006_mtl.011']} />
            <mesh name="Object005_Object005_mtl_0013_2" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0013_2.geometry} material={materials['Material.014']} />
          </group>
          <mesh name="Text007" castShadow receiveShadow geometry={nodes.Text007.geometry} material={materials['Material.060']} position={[-0.334, 0.032, 0.352]} rotation={[3.116, 0.009, 1.571]} scale={[0.135, 0.135, 0.198]} />
        </group>
        <group name="Book008" position={[0.037, 1.717, -1.529]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.348}>
          <mesh name="BookBody008" castShadow receiveShadow geometry={nodes.BookBody008.geometry} material={materials['Object007_mtl.010']} />
          <mesh name="BookBody008_1" castShadow receiveShadow geometry={nodes.BookBody008_1.geometry} material={materials['Object006_mtl.012']} />
          <mesh name="BookBody008_2" castShadow receiveShadow geometry={nodes.BookBody008_2.geometry} material={materials['Material.017']} />
          <mesh name="BookContent008" castShadow receiveShadow geometry={nodes.BookContent008.geometry} material={materials['blinn1SG.017']} position={[0.002, -0.067, 0.008]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.037}>
            <mesh name="Content008" castShadow receiveShadow geometry={nodes.Content008.geometry} material={nodes.Content008.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover008" position={[-0.442, -0.103, 0.627]} rotation={[0, 0, -0.002]}>
            <mesh name="Object007_Object007_mtl_0011" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0011.geometry} material={materials['Object007_mtl.010']} />
            <mesh name="Object007_Object007_mtl_0011_1" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0011_1.geometry} material={materials['Object006_mtl.012']} />
            <mesh name="Object007_Object007_mtl_0011_2" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0011_2.geometry} material={materials['Material.016']} />
          </group>
          <mesh name="Text008" castShadow receiveShadow geometry={nodes.Text008.geometry} material={materials['Material.060']} position={[-0.506, 0.055, -0.565]} rotation={[3.117, 0, 1.571]} scale={0.226} />
        </group>
        <group name="Book009" position={[0.15, 1.662, -1.484]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.291}>
          <mesh name="BookBody009" castShadow receiveShadow geometry={nodes.BookBody009.geometry} material={materials['Object003_mtl.013']} />
          <mesh name="BookBody009_1" castShadow receiveShadow geometry={nodes.BookBody009_1.geometry} material={materials['Object004_mtl.011']} />
          <mesh name="BookBody009_2" castShadow receiveShadow geometry={nodes.BookBody009_2.geometry} material={materials['Object005_mtl.015']} />
          <mesh name="BookBody009_3" castShadow receiveShadow geometry={nodes.BookBody009_3.geometry} material={materials['Material.019']} />
          <mesh name="BookContent009" castShadow receiveShadow geometry={nodes.BookContent009.geometry} material={materials['blinn1SG.018']} position={[0.03, 0.02, -0.01]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.03}>
            <mesh name="Content009" castShadow receiveShadow geometry={nodes.Content009.geometry} material={nodes.Content009.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover009" position={[-0.344, -0.154, 0.556]}>
            <mesh name="Object003_Object003_mtl_0015" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0015.geometry} material={materials['Object003_mtl.013']} />
            <mesh name="Object003_Object003_mtl_0015_1" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0015_1.geometry} material={materials['Object004_mtl.011']} />
            <mesh name="Object003_Object003_mtl_0015_2" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0015_2.geometry} material={materials['Material.018']} />
          </group>
          <mesh name="Text009" castShadow receiveShadow geometry={nodes.Text009.geometry} material={materials['Material.060']} position={[-0.398, 0.072, 0.318]} rotation={[3.117, 0, 1.571]} scale={0.271} />
        </group>
        <group name="Book010" position={[0.249, 1.701, -1.52]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.35}>
          <mesh name="BookBody010" castShadow receiveShadow geometry={nodes.BookBody010.geometry} material={materials['Object001_mtl.010']} />
          <mesh name="BookBody010_1" castShadow receiveShadow geometry={nodes.BookBody010_1.geometry} material={materials['Object007_mtl.011']} />
          <mesh name="BookBody010_2" castShadow receiveShadow geometry={nodes.BookBody010_2.geometry} material={materials['Material.021']} />
          <mesh name="BookContent010" castShadow receiveShadow geometry={nodes.BookContent010.geometry} material={materials['blinn1SG.015']} position={[0.004, -0.07, 0.011]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.03}>
            <mesh name="Content010" castShadow receiveShadow geometry={nodes.Content010.geometry} material={nodes.Content010.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover010" position={[-0.373, -0.084, 0.586]}>
            <mesh name="Object001_Object001_mtl_0013" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0013.geometry} material={materials['Object001_mtl.010']} />
            <mesh name="Object001_Object001_mtl_0013_1" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0013_1.geometry} material={materials['Object007_mtl.011']} />
            <mesh name="Object001_Object001_mtl_0013_2" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0013_2.geometry} material={materials['Material.020']} />
          </group>
          <mesh name="Text010" castShadow receiveShadow geometry={nodes.Text010.geometry} material={materials['Material.060']} position={[-0.413, 0.062, -0.527]} rotation={[3.117, 0, 1.571]} scale={0.172} />
        </group>
        <group name="Book011" position={[0.336, 1.721, -1.593]} rotation={[-Math.PI / 2, 0, 1.571]} scale={[0.655, 0.655, 0.448]}>
          <mesh name="BookBody011" castShadow receiveShadow geometry={nodes.BookBody011.geometry} material={materials['Object005_mtl.016']} />
          <mesh name="BookBody011_1" castShadow receiveShadow geometry={nodes.BookBody011_1.geometry} material={materials['Object006_mtl.013']} />
          <mesh name="BookBody011_2" castShadow receiveShadow geometry={nodes.BookBody011_2.geometry} material={materials['Material.023']} />
          <mesh name="BookContent011" castShadow receiveShadow geometry={nodes.BookContent011.geometry} material={materials['blinn1SG.014']} position={[0.013, -0.02, -0.002]} rotation={[-1.605, 0.037, -1.559]} scale={[0.033, 0.022, 0.022]}>
            <mesh name="Content011" castShadow receiveShadow geometry={nodes.Content011.geometry} material={nodes.Content011.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover011" position={[-0.29, -0.06, 0.507]}>
            <mesh name="Object005_Object005_mtl_0015" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0015.geometry} material={materials['Object005_mtl.016']} />
            <mesh name="Object005_Object005_mtl_0015_1" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0015_1.geometry} material={materials['Object006_mtl.013']} />
            <mesh name="Object005_Object005_mtl_0015_2" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0015_2.geometry} material={materials['Material.022']} />
          </group>
          <mesh name="Text011" castShadow receiveShadow geometry={nodes.Text011.geometry} material={materials['Material.060']} position={[-0.333, 0.031, 0.392]} rotation={[3.116, 0.009, 1.571]} scale={[0.092, 0.092, 0.135]} />
        </group>
        <group name="Book012" position={[0.43, 1.683, -1.509]} rotation={[-Math.PI / 2, -0.147, 1.571]} scale={0.32}>
          <mesh name="BookBody012" castShadow receiveShadow geometry={nodes.BookBody012.geometry} material={materials['Object002_mtl.007']} />
          <mesh name="BookBody012_1" castShadow receiveShadow geometry={nodes.BookBody012_1.geometry} material={materials['Object003_mtl.014']} />
          <mesh name="BookBody012_2" castShadow receiveShadow geometry={nodes.BookBody012_2.geometry} material={materials['Material.025']} />
          <mesh name="BookContent012" castShadow receiveShadow geometry={nodes.BookContent012.geometry} material={materials['blinn1SG.013']} position={[0.018, 0.004, -0.012]} rotation={[-1.603, 0.025, -Math.PI / 2]} scale={0.029}>
            <mesh name="Content012" castShadow receiveShadow geometry={nodes.Content012.geometry} material={nodes.Content012.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover012" position={[-0.316, -0.047, 0.586]} rotation={[0, 0, 0.001]}>
            <mesh name="Object002_Object002_mtl_0009" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0009.geometry} material={materials['Object002_mtl.007']} />
            <mesh name="Object002_Object002_mtl_0009_1" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0009_1.geometry} material={materials['Object003_mtl.014']} />
            <mesh name="Object002_Object002_mtl_0009_2" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0009_2.geometry} material={materials['Material.024']} />
          </group>
          <mesh name="Text012" castShadow receiveShadow geometry={nodes.Text012.geometry} material={materials['Material.060']} position={[-0.361, 0.043, -0.538]} rotation={[-3.14, 0, 1.571]} scale={0.097} />
        </group>
        <group name="Book013" position={[0.7, 1.147, -1.5]} rotation={[-Math.PI / 2, 0.022, 1.571]} scale={0.32}>
          <mesh name="BookBody013" castShadow receiveShadow geometry={nodes.BookBody013.geometry} material={materials['Object002_mtl.008']} />
          <mesh name="BookBody013_1" castShadow receiveShadow geometry={nodes.BookBody013_1.geometry} material={materials['Object003_mtl.015']} />
          <mesh name="BookBody013_2" castShadow receiveShadow geometry={nodes.BookBody013_2.geometry} material={materials['Material.038']} />
          <mesh name="BookContent013" castShadow receiveShadow geometry={nodes.BookContent013.geometry} material={materials['blinn1SG.028']} position={[0.017, -0.007, 0.021]} rotation={[-1.624, 0.025, -Math.PI / 2]} scale={0.028}>
            <mesh name="Content013" castShadow receiveShadow geometry={nodes.Content013.geometry} material={nodes.Content013.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover013" position={[-0.316, -0.047, 0.586]} rotation={[0, 0, 0.001]}>
            <mesh name="Object002_Object002_mtl_0011" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0011.geometry} material={materials['Object002_mtl.008']} />
            <mesh name="Object002_Object002_mtl_0011_1" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0011_1.geometry} material={materials['Object003_mtl.015']} />
            <mesh name="Object002_Object002_mtl_0011_2" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0011_2.geometry} material={materials['Material.026']} />
          </group>
          <mesh name="Text013" castShadow receiveShadow geometry={nodes.Text013.geometry} material={materials['Material.060']} position={[-0.361, 0.041, 0.469]} rotation={[3.12, 0, 1.571]} scale={0.103} />
        </group>
        <group name="Book014" position={[0.626, 1.184, -1.596]} rotation={[-Math.PI / 2, 0, 1.571]} scale={[0.655, 0.655, 0.448]}>
          <mesh name="BookBody014" castShadow receiveShadow geometry={nodes.BookBody014.geometry} material={materials['Object005_mtl.017']} />
          <mesh name="BookBody014_1" castShadow receiveShadow geometry={nodes.BookBody014_1.geometry} material={materials['Object006_mtl.014']} />
          <mesh name="BookBody014_2" castShadow receiveShadow geometry={nodes.BookBody014_2.geometry} material={materials['Material.039']} />
          <mesh name="BookContent014" castShadow receiveShadow geometry={nodes.BookContent014.geometry} material={materials['blinn1SG.029']} position={[0.022, 0.033, -0.011]} rotation={[-1.605, 0.037, -1.559]} scale={[0.033, 0.022, 0.022]}>
            <mesh name="Content014" castShadow receiveShadow geometry={nodes.Content014.geometry} material={nodes.Content014.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover014" position={[-0.29, -0.06, 0.507]}>
            <mesh name="Object005_Object005_mtl_0017" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0017.geometry} material={materials['Object005_mtl.017']} />
            <mesh name="Object005_Object005_mtl_0017_1" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0017_1.geometry} material={materials['Object006_mtl.014']} />
            <mesh name="Object005_Object005_mtl_0017_2" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0017_2.geometry} material={materials['Material.027']} />
          </group>
          <mesh name="Text014" castShadow receiveShadow geometry={nodes.Text014.geometry} material={materials['Material.060']} position={[-0.333, 0.036, -0.462]} rotation={[3.116, 0.009, 1.571]} scale={[0.092, 0.092, 0.135]} />
        </group>
        <group name="Book015" position={[0.543, 1.163, -1.499]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.35}>
          <mesh name="BookBody015" castShadow receiveShadow geometry={nodes.BookBody015.geometry} material={materials['Object001_mtl.011']} />
          <mesh name="BookBody015_1" castShadow receiveShadow geometry={nodes.BookBody015_1.geometry} material={materials['Object007_mtl.012']} />
          <mesh name="BookBody015_2" castShadow receiveShadow geometry={nodes.BookBody015_2.geometry} material={materials['Material.040']} />
          <mesh name="BookContent015" castShadow receiveShadow geometry={nodes.BookContent015.geometry} material={materials['blinn1SG.030']} position={[0.006, 0.038, -0.023]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.031}>
            <mesh name="Content015" castShadow receiveShadow geometry={nodes.Content015.geometry} material={nodes.Content015.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover015" position={[-0.373, -0.084, 0.586]}>
            <mesh name="Object001_Object001_mtl_0015" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0015.geometry} material={materials['Object001_mtl.011']} />
            <mesh name="Object001_Object001_mtl_0015_1" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0015_1.geometry} material={materials['Object007_mtl.012']} />
            <mesh name="Object001_Object001_mtl_0015_2" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0015_2.geometry} material={materials['Material.028']} />
          </group>
          <mesh name="Text015" castShadow receiveShadow geometry={nodes.Text015.geometry} material={materials['Material.060']} position={[-0.409, 0.065, 0.403]} rotation={[3.117, 0, 1.571]} scale={0.172} />
        </group>
        <group name="Book016" position={[0.209, 1.121, -1.472]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.291}>
          <mesh name="_BookBody016" castShadow receiveShadow geometry={nodes._BookBody016.geometry} material={materials['Object003_mtl.016']} />
          <mesh name="_BookBody016_1" castShadow receiveShadow geometry={nodes._BookBody016_1.geometry} material={materials['Object004_mtl.012']} />
          <mesh name="_BookBody016_2" castShadow receiveShadow geometry={nodes._BookBody016_2.geometry} material={materials['Object005_mtl.018']} />
          <mesh name="_BookBody016_3" castShadow receiveShadow geometry={nodes._BookBody016_3.geometry} material={materials['Material.041']} />
          <mesh name="BookContent016" castShadow receiveShadow geometry={nodes.BookContent016.geometry} material={materials['blinn1SG.027']} position={[0.039, 0.115, -0.006]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.029}>
            <mesh name="Content016" castShadow receiveShadow geometry={nodes.Content016.geometry} material={nodes.Content016.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover016" position={[-0.344, -0.154, 0.556]}>
            <mesh name="Object003_Object003_mtl_0017" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0017.geometry} material={materials['Object003_mtl.016']} />
            <mesh name="Object003_Object003_mtl_0017_1" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0017_1.geometry} material={materials['Object004_mtl.012']} />
            <mesh name="Object003_Object003_mtl_0017_2" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0017_2.geometry} material={materials['Material.029']} />
          </group>
          <mesh name="Text016" castShadow receiveShadow geometry={nodes.Text016.geometry} material={materials['Material.060']} position={[-0.395, 0.1, -0.478]} rotation={[3.117, 0, 1.571]} scale={0.207} />
        </group>
        <group name="Book017" position={[0.449, 1.18, -1.548]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.348}>
          <mesh name="BookBody017" castShadow receiveShadow geometry={nodes.BookBody017.geometry} material={materials['Object007_mtl.013']} />
          <mesh name="BookBody017_1" castShadow receiveShadow geometry={nodes.BookBody017_1.geometry} material={materials['Object006_mtl.015']} />
          <mesh name="BookBody017_2" castShadow receiveShadow geometry={nodes.BookBody017_2.geometry} material={materials['Material.042']} />
          <mesh name="BookContent017" castShadow receiveShadow geometry={nodes.BookContent017.geometry} material={materials['blinn1SG.026']} position={[-0.008, 0.043, -0.006]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.039}>
            <mesh name="Content017" castShadow receiveShadow geometry={nodes.Content017.geometry} material={nodes.Content017.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover017" position={[-0.442, -0.103, 0.627]} rotation={[0, 0, -0.002]}>
            <mesh name="Object007_Object007_mtl_0013" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0013.geometry} material={materials['Object007_mtl.013']} />
            <mesh name="Object007_Object007_mtl_0013_1" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0013_1.geometry} material={materials['Object006_mtl.015']} />
            <mesh name="Object007_Object007_mtl_0013_2" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0013_2.geometry} material={materials['Material.030']} />
          </group>
          <mesh name="Text017" castShadow receiveShadow geometry={nodes.Text017.geometry} material={materials['Material.060']} position={[-0.531, 0.059, 0.464]} rotation={[3.117, 0, 1.571]} scale={0.173} />
        </group>
        <group name="Book018" position={[0.336, 1.156, -1.56]} rotation={[-Math.PI / 2, 0.091, 1.571]} scale={[0.582, 0.582, 0.398]}>
          <mesh name="BookBody018" castShadow receiveShadow geometry={nodes.BookBody018.geometry} material={materials['Object005_mtl.019']} />
          <mesh name="BookBody018_1" castShadow receiveShadow geometry={nodes.BookBody018_1.geometry} material={materials['Object006_mtl.016']} />
          <mesh name="BookBody018_2" castShadow receiveShadow geometry={nodes.BookBody018_2.geometry} material={materials['Material.043']} />
          <mesh name="BookContent018" castShadow receiveShadow geometry={nodes.BookContent018.geometry} material={materials['blinn1SG.025']} position={[0.02, 0.008, -0.003]} rotation={[-1.545, 0.034, -1.58]} scale={[0.031, 0.021, 0.021]}>
            <mesh name="Content018" castShadow receiveShadow geometry={nodes.Content018.geometry} material={nodes.Content018.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover018" position={[-0.29, -0.061, 0.507]}>
            <mesh name="Object005_Object005_mtl_0018" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0018.geometry} material={materials['Object005_mtl.019']} />
            <mesh name="Object005_Object005_mtl_0018_1" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0018_1.geometry} material={materials['Object006_mtl.016']} />
            <mesh name="Object005_Object005_mtl_0018_2" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0018_2.geometry} material={materials['Material.031']} />
          </group>
          <mesh name="Text018" castShadow receiveShadow geometry={nodes.Text018.geometry} material={materials['Material.060']} position={[-0.333, 0.043, -0.112]} rotation={[-3.136, -0.002, 1.571]} scale={[0.104, 0.104, 0.152]} />
        </group>
        <group name="Book019" position={[-0.244, 1.163, -1.502]} rotation={[-Math.PI / 2, -0.08, 1.571]} scale={0.35}>
          <mesh name="BookBody019" castShadow receiveShadow geometry={nodes.BookBody019.geometry} material={materials['Object001_mtl.012']} />
          <mesh name="BookBody019_1" castShadow receiveShadow geometry={nodes.BookBody019_1.geometry} material={materials['Object007_mtl.014']} />
          <mesh name="BookBody019_2" castShadow receiveShadow geometry={nodes.BookBody019_2.geometry} material={materials['Material.044']} />
          <mesh name="BookContent019" castShadow receiveShadow geometry={nodes.BookContent019.geometry} material={materials['blinn1SG.021']} position={[0.005, 0.01, 0.022]} rotation={[-1.591, 0.025, -Math.PI / 2]} scale={0.031}>
            <mesh name="Content019" castShadow receiveShadow geometry={nodes.Content019.geometry} material={nodes.Content019.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover019" position={[-0.373, -0.084, 0.586]}>
            <mesh name="Object001_Object001_mtl_0016" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0016.geometry} material={materials['Object001_mtl.012']} />
            <mesh name="Object001_Object001_mtl_0016_1" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0016_1.geometry} material={materials['Object007_mtl.014']} />
            <mesh name="Object001_Object001_mtl_0016_2" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0016_2.geometry} material={materials['Material.032']} />
          </group>
          <mesh name="Text019" castShadow receiveShadow geometry={nodes.Text019.geometry} material={materials['Material.060']} position={[-0.414, 0.064, 0.06]} rotation={[3.132, 0, 1.571]} scale={0.172} />
        </group>
        <group name="Book020" position={[-0.563, 1.157, -1.504]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.354}>
          <mesh name="BookBody020" castShadow receiveShadow geometry={nodes.BookBody020.geometry} material={materials['Object003_mtl.017']} />
          <mesh name="BookBody020_1" castShadow receiveShadow geometry={nodes.BookBody020_1.geometry} material={materials['Object004_mtl.013']} />
          <mesh name="BookBody020_2" castShadow receiveShadow geometry={nodes.BookBody020_2.geometry} material={materials['Object005_mtl.020']} />
          <mesh name="BookBody020_3" castShadow receiveShadow geometry={nodes.BookBody020_3.geometry} material={materials['Material.045']} />
          <mesh name="BookContent020" castShadow receiveShadow geometry={nodes.BookContent020.geometry} material={materials['blinn1SG.020']} position={[0.034, -0.111, -0.004]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.029}>
            <mesh name="Content020" castShadow receiveShadow geometry={nodes.Content020.geometry} material={nodes.Content020.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover020" position={[-0.344, -0.154, 0.556]}>
            <mesh name="Object003_Object003_mtl_0018" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0018.geometry} material={materials['Object003_mtl.017']} />
            <mesh name="Object003_Object003_mtl_0018_1" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0018_1.geometry} material={materials['Object004_mtl.013']} />
            <mesh name="Object003_Object003_mtl_0018_2" castShadow receiveShadow geometry={nodes.Object003_Object003_mtl_0018_2.geometry} material={materials['Material.033']} />
          </group>
          <mesh name="Text020" castShadow receiveShadow geometry={nodes.Text020.geometry} material={materials['Material.060']} position={[-0.395, 0.092, 0.01]} rotation={[3.117, 0, 1.571]} scale={0.171} />
        </group>
        <group name="Book021" position={[-0.683, 1.184, -1.581]} rotation={[-Math.PI / 2, 0, 1.571]} scale={[0.655, 0.655, 0.448]}>
          <mesh name="BookBody021" castShadow receiveShadow geometry={nodes.BookBody021.geometry} material={materials['Object005_mtl.020']} />
          <mesh name="BookBody021_1" castShadow receiveShadow geometry={nodes.BookBody021_1.geometry} material={materials['Object006_mtl.017']} />
          <mesh name="BookBody021_2" castShadow receiveShadow geometry={nodes.BookBody021_2.geometry} material={materials['Material.046']} />
          <mesh name="BookContent021" castShadow receiveShadow geometry={nodes.BookContent021.geometry} material={materials['blinn1SG.019']} position={[0.023, 0.016, -0.005]} rotation={[-1.605, 0.037, -1.559]} scale={[0.032, 0.022, 0.022]}>
            <mesh name="Content021" castShadow receiveShadow geometry={nodes.Content021.geometry} material={nodes.Content021.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover021" position={[-0.29, -0.06, 0.507]}>
            <mesh name="Object005_Object005_mtl_0019" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0019.geometry} material={materials['Object005_mtl.020']} />
            <mesh name="Object005_Object005_mtl_0019_1" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0019_1.geometry} material={materials['Object006_mtl.017']} />
            <mesh name="Object005_Object005_mtl_0019_2" castShadow receiveShadow geometry={nodes.Object005_Object005_mtl_0019_2.geometry} material={materials['Material.034']} />
          </group>
          <mesh name="Text021" castShadow receiveShadow geometry={nodes.Text021.geometry} material={materials['Material.060']} position={[-0.336, 0.037, -0.451]} rotation={[3.116, 0.009, 1.571]} scale={[0.092, 0.092, 0.135]} />
        </group>
        <group name="Book022" position={[-0.449, 1.163, -1.523]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.35}>
          <mesh name="BookBody022" castShadow receiveShadow geometry={nodes.BookBody022.geometry} material={materials['Object001_mtl.013']} />
          <mesh name="BookBody022_1" castShadow receiveShadow geometry={nodes.BookBody022_1.geometry} material={materials['Object007_mtl.015']} />
          <mesh name="BookBody022_2" castShadow receiveShadow geometry={nodes.BookBody022_2.geometry} material={materials['Material.047']} />
          <mesh name="BookContent022" castShadow receiveShadow geometry={nodes.BookContent022.geometry} material={materials['blinn1SG.022']} position={[0.01, 0.054, 0.017]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.03}>
            <mesh name="Content022" castShadow receiveShadow geometry={nodes.Content022.geometry} material={nodes.Content022.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover022" position={[-0.373, -0.084, 0.586]}>
            <mesh name="Object001_Object001_mtl_0017" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0017.geometry} material={materials['Object001_mtl.013']} />
            <mesh name="Object001_Object001_mtl_0017_1" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0017_1.geometry} material={materials['Object007_mtl.015']} />
            <mesh name="Object001_Object001_mtl_0017_2" castShadow receiveShadow geometry={nodes.Object001_Object001_mtl_0017_2.geometry} material={materials['Material.035']} />
          </group>
          <mesh name="Text022" castShadow receiveShadow geometry={nodes.Text022.geometry} material={materials['Material.060']} position={[-0.41, 0.074, 0.409]} rotation={[3.117, 0, 1.571]} scale={0.157} />
        </group>
        <group name="Book023" position={[-0.353, 1.18, -1.576]} rotation={[-Math.PI / 2, 0, 1.571]} scale={0.348}>
          <mesh name="BookBody023" castShadow receiveShadow geometry={nodes.BookBody023.geometry} material={materials['Object007_mtl.015']} />
          <mesh name="BookBody023_1" castShadow receiveShadow geometry={nodes.BookBody023_1.geometry} material={materials['Object006_mtl.018']} />
          <mesh name="BookBody023_2" castShadow receiveShadow geometry={nodes.BookBody023_2.geometry} material={materials['Material.048']} />
          <mesh name="BookContent023" castShadow receiveShadow geometry={nodes.BookContent023.geometry} material={materials['blinn1SG.023']} position={[-0.004, -0.034, -0.023]} rotation={[-1.602, 0.025, -Math.PI / 2]} scale={0.037}>
            <mesh name="Content023" castShadow receiveShadow geometry={nodes.Content023.geometry} material={nodes.Content023.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover023" position={[-0.442, -0.103, 0.627]} rotation={[0, 0, -0.002]}>
            <mesh name="Object007_Object007_mtl_0014" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0014.geometry} material={materials['Object007_mtl.015']} />
            <mesh name="Object007_Object007_mtl_0014_1" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0014_1.geometry} material={materials['Object006_mtl.018']} />
            <mesh name="Object007_Object007_mtl_0014_2" castShadow receiveShadow geometry={nodes.Object007_Object007_mtl_0014_2.geometry} material={materials['Material.036']} />
          </group>
          <mesh name="Text023" castShadow receiveShadow geometry={nodes.Text023.geometry} material={materials['Material.060']} position={[-0.503, 0.075, -0.302]} rotation={[3.117, 0, 1.571]} scale={0.158} />
        </group>
        <group name="Book024" position={[-0.171, 1.143, -1.488]} rotation={[-Math.PI / 2, -0.147, 1.571]} scale={0.32}>
          <mesh name="BookBody024" castShadow receiveShadow geometry={nodes.BookBody024.geometry} material={materials['Object002_mtl.009']} />
          <mesh name="BookBody024_1" castShadow receiveShadow geometry={nodes.BookBody024_1.geometry} material={materials['Object003_mtl.018']} />
          <mesh name="BookBody024_2" castShadow receiveShadow geometry={nodes.BookBody024_2.geometry} material={materials['Material.049']} />
          <mesh name="BookContent024" castShadow receiveShadow geometry={nodes.BookContent024.geometry} material={materials['blinn1SG.024']} position={[0.016, -0.025, 0.035]} rotation={[-1.574, 0.025, -Math.PI / 2]} scale={0.027}>
            <mesh name="Content024" castShadow receiveShadow geometry={nodes.Content024.geometry} material={nodes.Content024.material} position={[1.612, 2.958, -0.041]} rotation={[1.36, -1.563, 2.945]} scale={[5.837, 8.98, 3.162]} />
          </mesh>
          <group name="BookCover024" position={[-0.316, -0.047, 0.586]} rotation={[0, 0, 0.001]}>
            <mesh name="Object002_Object002_mtl_0012" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0012.geometry} material={materials['Object002_mtl.009']} />
            <mesh name="Object002_Object002_mtl_0012_1" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0012_1.geometry} material={materials['Object003_mtl.018']} />
            <mesh name="Object002_Object002_mtl_0012_2" castShadow receiveShadow geometry={nodes.Object002_Object002_mtl_0012_2.geometry} material={materials['Material.037']} />
          </group>
          <mesh name="Text024" castShadow receiveShadow geometry={nodes.Text024.geometry} material={materials['Material.060']} position={[-0.36, 0.04, -0.535]} rotation={[3.131, 0, 1.571]} scale={0.079} />
        </group>
        <mesh name="Chandeleier" geometry={nodes.Chandeleier.geometry} material={materials['material_0.001']} position={[-0.01, 2.641, 0.185]} rotation={[-Math.PI / 2, 0, 0]} scale={0.047} />
        <group name="Chair" position={[1.133, -0.014, 1.442]} rotation={[-Math.PI / 2, 0, 2.536]} scale={0.245}>
          <mesh name="Object_0002" castShadow receiveShadow geometry={nodes.Object_0002.geometry} material={materials['Material.050']} />
          <mesh name="Object_0002_1" castShadow receiveShadow geometry={nodes.Object_0002_1.geometry} material={materials['Material.051']} />
          <mesh name="Object_0002_2" castShadow receiveShadow geometry={nodes.Object_0002_2.geometry} material={materials['Material.052']} />
          <mesh name="Object_0002_3" castShadow receiveShadow geometry={nodes.Object_0002_3.geometry} material={materials['Material.053']} />
          <mesh name="Object_0002_4" castShadow receiveShadow geometry={nodes.Object_0002_4.geometry} material={materials['Material.054']} />
        </group>
        <mesh name="Carpet" castShadow receiveShadow geometry={nodes.Carpet.geometry} material={materials.Mat_1} position={[-0.047, 0.009, 0.226]} rotation={[Math.PI / 2, 0, 0]} scale={0.024} />
        <mesh name="Wand" castShadow receiveShadow geometry={nodes.Wand.geometry} material={materials['Scene_-_Root']} position={[-0.182, 0.97, -1.694]} rotation={[0.078, -0.807, 0.028]} scale={0.048} />
        <mesh name="Table" castShadow receiveShadow geometry={nodes.Table.geometry} material={materials['Scene_-_Root.001']} position={[0.554, -0.015, 2.318]} scale={0.001} />
        <mesh name="Candle" geometry={nodes.Candle.geometry} material={materials['LowCandle.001']} position={[0.599, 1.586, -1.482]} scale={0.054}>
          <CandleLight />
          <mesh name="Flame001" geometry={nodes.Flame001.geometry} material={materials['candle_flame2.001']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh name="Flame002" geometry={nodes.Flame002.geometry} material={materials['candle_flame2.001']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 9]} />
          <mesh name="Flame003" geometry={nodes.Flame003.geometry} material={materials['candle_flame2.001']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 6]} />
          <mesh name="Flame004" geometry={nodes.Flame004.geometry} material={materials['candle_flame2.001']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, -0.698]} />
          <mesh name="Flame005" geometry={nodes.Flame005.geometry} material={materials['candle_flame2.001']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, -0.873]} />
          <mesh name="Flame006" geometry={nodes.Flame006.geometry} material={materials['candle_flame2.001']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh name="Flame007" geometry={nodes.Flame007.geometry} material={materials['candle_flame2.001']} position={[0, 0.864, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </mesh>
        <mesh name="XmasTree" castShadow receiveShadow geometry={nodes.XmasTree.geometry} material={materials['lametta.001']} position={[1.791, 0.066, -0.458]} scale={1.243}>
          <mesh name="Object_10" castShadow receiveShadow geometry={nodes.Object_10.geometry} material={materials['needlaes_eevee.001']} />
          <mesh name="Object_11" castShadow receiveShadow geometry={nodes.Object_11.geometry} material={materials['material_0.004']} />
          <mesh name="Object_12" castShadow receiveShadow geometry={nodes.Object_12.geometry} material={materials['material_0.004']} />
          <mesh name="Object_13" castShadow receiveShadow geometry={nodes.Object_13.geometry} material={materials['material_0.004']} />
          <mesh name="Object_15" castShadow receiveShadow geometry={nodes.Object_15.geometry} material={materials['top_star.001']} position={[0, 2.918, 0]} />
          <mesh name="Object_36" castShadow receiveShadow geometry={nodes.Object_36.geometry} material={materials['gifts.bands.001']}>
            <mesh name="Object_38" castShadow receiveShadow geometry={nodes.Object_38.geometry} material={materials['gifts.001']} />
          </mesh>
          <mesh name="Object_39" castShadow receiveShadow geometry={nodes.Object_39.geometry} material={materials['gifts.bands.001']} />
          <mesh name="Object_5" castShadow receiveShadow geometry={nodes.Object_5.geometry} material={materials['lametta.001']} />
          <mesh name="Object_6" castShadow receiveShadow geometry={nodes.Object_6.geometry} material={materials['lametta.001']} />
          <mesh name="Object_7" castShadow receiveShadow geometry={nodes.Object_7.geometry} material={materials['lametta.001']} />
          <mesh name="Object_8" castShadow receiveShadow geometry={nodes.Object_8.geometry} material={materials['branch.001']} />
          <mesh name="Object_9" castShadow receiveShadow geometry={nodes.Object_9.geometry} material={materials['marbles.001']} />
          <group name="Present001" position={[-0.387, -0.056, 0.583]} rotation={[0, -0.294, 0]}>
            <mesh name="Object_17001" castShadow receiveShadow geometry={nodes.Object_17001.geometry} material={materials['gifts.001']} />
            <mesh name="Object_17001_1" castShadow receiveShadow geometry={nodes.Object_17001_1.geometry} material={materials['gifts.bands.001']} />
          </group>
          <group name="Present002" position={[-0.532, 0.176, -0.527]} rotation={[-0.208, -0.147, 0.025]} scale={0.763}>
            <mesh name="Object_19001" castShadow receiveShadow geometry={nodes.Object_19001.geometry} material={materials['gifts.001']} />
            <mesh name="Object_19001_1" castShadow receiveShadow geometry={nodes.Object_19001_1.geometry} material={materials['gifts.bands.001']} />
          </group>
          <group name="Present003" position={[-0.334, 1.489, -0.448]} rotation={[-0.133, 0.115, 0.035]} scale={0.694}>
            <mesh name="Object_23001" receiveShadow geometry={nodes.Object_23001.geometry} material={materials['gifts.001']} />
            <mesh name="Object_23001_1" receiveShadow geometry={nodes.Object_23001_1.geometry} material={materials['gifts.bands.001']} />
          </group>
          <group name="Present004" position={[-0.395, 1.208, 0.571]} rotation={[0.149, -0.39, 0]} scale={0.58}>
            <mesh name="Object_17002" receiveShadow geometry={nodes.Object_17002.geometry} material={materials['gifts.002']} />
            <mesh name="Object_17002_1" receiveShadow geometry={nodes.Object_17002_1.geometry} material={materials['gifts.bands.002']} />
          </group>
          <group name="Present005" position={[-0.493, 1.666, 0.255]} rotation={[0.055, 0.203, -0.266]} scale={0.59}>
            <mesh name="Object_21001" receiveShadow geometry={nodes.Object_21001.geometry} material={materials['gifts.001']} />
            <mesh name="Object_21001_1" receiveShadow geometry={nodes.Object_21001_1.geometry} material={materials['gifts.bands.001']} />
          </group>
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload('models/model.glb')


