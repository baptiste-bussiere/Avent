import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import React from 'react'
import { useControls } from 'leva'

export type CameraPreset = 'default' | 'library' | 'map'

type CameraRigProps = {
  preset: CameraPreset
  followBookId: string | null
  levaStore: any
  isDev: boolean
}

const PRESETS: Record<
  CameraPreset,
  { radius: number; baseAzimuth: number; basePolar: number; lookAt: THREE.Vector3 }
> = {
  default: {
    radius: 9.7,
    baseAzimuth: -0.98,
    basePolar:0.98,
    lookAt: new THREE.Vector3(0.0, 0.9, 0.4),
  },
  library: {
    radius: 2.2,
    baseAzimuth: -0.08,
    basePolar: 0.90,
    lookAt: new THREE.Vector3(0.1, 1.3,-2.7),
  },
  map: {
    radius: 4.5,
    baseAzimuth: -0.26,
    basePolar: 0.75,
    lookAt: new THREE.Vector3(1.4, -1.5, 1.3),
  },
}

export function CameraRig({ preset, followBookId, levaStore, isDev }: CameraRigProps) {
  const { camera, mouse, scene } = useThree()
  const currentLookAt = React.useRef(PRESETS.default.lookAt.clone())

  const {
    defaultRadius,
    defaultAzimuth,
    defaultPolar,
    defaultLookAtX,
    defaultLookAtY,
    defaultLookAtZ,
    libraryRadius,
    libraryAzimuth,
    libraryPolar,
    libraryLookAtX,
    libraryLookAtY,
    libraryLookAtZ,
    mapRadius,
    mapAzimuth,
    mapPolar,
    mapLookAtX,
    mapLookAtY,
    mapLookAtZ,
  } = useControls(
    'Camera',
    {
      defaultRadius: {
        value: PRESETS.default.radius,
        min: 1,
        max: 20,
        step: 0.1,
      },
      defaultAzimuth: {
        value: PRESETS.default.baseAzimuth,
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
      },
      defaultPolar: {
        value: PRESETS.default.basePolar,
        min: 0,
        max: Math.PI,
        step: 0.01,
      },
      defaultLookAtX: { value: PRESETS.default.lookAt.x, min: -5, max: 5, step: 0.1 },
      defaultLookAtY: { value: PRESETS.default.lookAt.y, min: -5, max: 5, step: 0.1 },
      defaultLookAtZ: { value: PRESETS.default.lookAt.z, min: -5, max: 5, step: 0.1 },

      libraryRadius: {
        value: PRESETS.library.radius,
        min: 1,
        max: 20,
        step: 0.1,
      },
      libraryAzimuth: {
        value: PRESETS.library.baseAzimuth,
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
      },
      libraryPolar: {
        value: PRESETS.library.basePolar,
        min: 0,
        max: Math.PI,
        step: 0.01,
      },
      libraryLookAtX: { value: PRESETS.library.lookAt.x, min: -5, max: 5, step: 0.1 },
      libraryLookAtY: { value: PRESETS.library.lookAt.y, min: -5, max: 5, step: 0.1 },
      libraryLookAtZ: { value: PRESETS.library.lookAt.z, min: -5, max: 5, step: 0.1 },

      mapRadius: {
        value: PRESETS.map.radius,
        min: 1,
        max: 20,
        step: 0.1,
      },
      mapAzimuth: {
        value: PRESETS.map.baseAzimuth,
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
      },
      mapPolar: {
        value: PRESETS.map.basePolar,
        min: 0,
        max: Math.PI,
        step: 0.01,
      },
      mapLookAtX: { value: PRESETS.map.lookAt.x, min: -5, max: 5, step: 0.1 },
      mapLookAtY: { value: PRESETS.map.lookAt.y, min: -5, max: 5, step: 0.1 },
      mapLookAtZ: { value: PRESETS.map.lookAt.z, min: -5, max: 5, step: 0.1 },
    },
    { store: levaStore }
  )

  const cfg = React.useMemo(() => {
    if (!isDev) {
      return PRESETS[preset]
    }

    switch (preset) {
      case 'library':
        return {
          radius: libraryRadius,
          baseAzimuth: libraryAzimuth,
          basePolar: libraryPolar,
          lookAt: new THREE.Vector3(
            libraryLookAtX,
            libraryLookAtY,
            libraryLookAtZ
          ),
        }
      case 'map':
        return {
          radius: mapRadius,
          baseAzimuth: mapAzimuth,
          basePolar: mapPolar,
          lookAt: new THREE.Vector3(mapLookAtX, mapLookAtY, mapLookAtZ),
        }
      case 'default':
      default:
        return {
          radius: defaultRadius,
          baseAzimuth: defaultAzimuth,
          basePolar: defaultPolar,
          lookAt: new THREE.Vector3(
            defaultLookAtX,
            defaultLookAtY,
            defaultLookAtZ
          ),
        }
    }
  }, [
    preset,
    isDev,
    defaultRadius,
    defaultAzimuth,
    defaultPolar,
    defaultLookAtX,
    defaultLookAtY,
    defaultLookAtZ,
    libraryRadius,
    libraryAzimuth,
    libraryPolar,
    libraryLookAtX,
    libraryLookAtY,
    libraryLookAtZ,
    mapRadius,
    mapAzimuth,
    mapPolar,
    mapLookAtX,
    mapLookAtY,
    mapLookAtZ,
  ])

  useFrame(() => {
    const smooth = (t: number) => 1 - Math.exp(-t * 3)

    if (followBookId) {
      const book = scene.getObjectByName(`Book${followBookId}`) as THREE.Object3D | null
      if (book) {
        const bookPos = new THREE.Vector3()
        book.getWorldPosition(bookPos)

        const distance = 2.2
        const angle = 0
        const offset = new THREE.Vector3(
          Math.sin(angle) * distance,
          0.4,
          Math.cos(angle) * distance
        )

        const desiredPos = bookPos.clone().add(offset)
        const ef = smooth(0.01)

        camera.position.lerp(desiredPos, ef)
        currentLookAt.current.lerp(bookPos, ef)
        camera.lookAt(currentLookAt.current)
        return
      }
    }

    const { radius, baseAzimuth, basePolar, lookAt } = cfg
    const e = smooth(0.01)

    const azimuthOffset = mouse.x * 0.2
    const polarOffset = mouse.y * 0.15

    const currentAzimuth = baseAzimuth + azimuthOffset
    const currentPolar = THREE.MathUtils.clamp(
      basePolar + polarOffset,
      Math.PI / 4,
      Math.PI / 2.1
    )

    const targetPos = new THREE.Vector3(
      radius * Math.sin(currentPolar) * Math.sin(currentAzimuth),
      radius * Math.cos(currentPolar),
      radius * Math.sin(currentPolar) * Math.cos(currentAzimuth)
    )

    camera.position.lerp(targetPos, e)
    currentLookAt.current.lerp(lookAt, e)
    camera.lookAt(currentLookAt.current)
  })

  return null
}
