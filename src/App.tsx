import { Canvas } from '@react-three/fiber'
import {
  Environment,
  ContactShadows,
  AdaptiveDpr,
  AdaptiveEvents,
  useProgress,
} from '@react-three/drei'
import { useState, useRef } from 'react'
import { CameraRig } from './components/CameraRig'
import type { CameraPreset } from './components/CameraRig'
import { Model } from './components/Model'
import './scss/index.scss'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { Leva, useCreateStore } from 'leva'
import advent from './data/advent.json'
import giftsConfig from './data/giftsConfig.json'
import { GiftBanner } from './components/GiftBanner'
import gsap from 'gsap'
import { useLayoutEffect, useEffect } from 'react'
import { useCallback } from 'react'
type GiftConfig = {
  [id: string]: {
    title: string
    subtitle?: string
    image: string
    description?: string
  }
}

/* ---------- Plane sol ---------- */
const TRACKS = [
  { src: '/song/Double Trouble.mp3', name: 'Double Trouble' },
  { src: '/song/Gilderoy Lockhart.mp3', name: 'Gilderoy Lockhart' },
  { src: '/song/The Book.mp3', name: 'The Book' },
  { src: '/song/The Room of Requirements.mp3', name: 'The Room of Requirements' },
]
function getCurrentAdventDay(): number {
  let forcedDay: number | null = null

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const d = params.get('adventDay')
    if (d) {
      const n = Number(d)
      if (!Number.isNaN(n)) {
        // on clamp entre 1 et 24
        forcedDay = Math.min(24, Math.max(1, n))
      }
    }
  }

  // si un adventDay est forcé dans l'URL, on l'utilise
  if (forcedDay !== null) return forcedDay

  const now = new Date()
  const month = now.getMonth() // 0 = janvier, 11 = décembre
  const day = now.getDate()

  // en dehors de décembre → 0 = "pas encore commencé"
  if (month !== 11) return 0

  // en décembre : on limite entre 1 et 24
  return Math.min(24, Math.max(1, day))
}


function PlaneGeometry() {
  const texture = useTexture('textures/parquet.jpg')
  texture.anisotropy = 8
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
    >
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial
        map={texture}
        color="#ffeed1"
        roughness={0.8}
        metalness={0}
        envMapIntensity={0}
      />
    </mesh>
  )
}

/* ---------- Intro / Loading screen ---------- */
type IntroScreenProps = {
  progress: number
  onStart: () => void
}

function IntroScreen({ progress, onStart }: IntroScreenProps) {
  const isReady = progress >= 100

  const rootRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  // ✨ ANIM D’ENTRÉE (une seule fois)
  useEffect(() => {
    if (!isReady) return;

    const ctx = gsap.context(() => {
      isReady &&
        gsap.from('.intro__container', {
          duration: 0.7,
          opacity: 0,
          scale: 0.95,
          ease: 'power2.out',
        })

      if (contentRef.current) {
        gsap.from(contentRef.current.children, {
          duration: 0.6,
          opacity: 0,
          y: 20,
          stagger: 0.1,
          delay: 0.2,
          ease: 'power2.out',
        })
      }
    }, rootRef)

    return () => ctx.revert()
  }, [isReady])

  // 💡 ANIM QUAND TOUT EST PRÊT (progress >= 100)


  // 🚪 ANIM DE SORTIE + callback onStart
  const handleClick = () => {
    if (!isReady || !rootRef.current) return

    gsap.to('.intro', {
      duration: 0.6,

      y: -150 + "%",
      ease: 'power2.inOut',
      pointerEvents: 'none',
      onComplete: onStart,
    })
  }

  return (
    <div ref={rootRef} className="intro">
      {isReady &&
        <div className="intro__container">
          <div ref={contentRef} className="intro__container__content">
            <h1 className="intro__title">The Chamber of Forgotten Stories</h1>

            <p className="intro__text intro__text--large">
              In a forgotten corner of the library,<br />
              among ancient books and animated scrolls,<br />
              a very special calendar comes back to life.
            </p>

            <p className="intro__text">
              Each book holds a secret<br />
              protected by the spells of time.

            </p>

            <p className="intro__text">
              One rule :


              <span className="intro__highlight">open the right book, on the right day.</span>
            </p>

            <p className="intro__text">
              Prepare your wand… The adventure begins now.

            </p>

            <p className="intro__loading-text">
              Ready to cast the spell?

            </p>

            <button
              ref={buttonRef}
              type="button"
              className="intro__button"
              onClick={handleClick}
              disabled={!isReady}
            >
              {isReady
                ? "Discover the secrets"
                : `Loading… ${Math.round(progress)}%`}
            </button>
          </div>
        </div>}
      <div className="intro__loading">
        {!isReady &&
          <>
            <img src="img/loading.gif" alt="" />
            <span>Loading...</span>
          </>
        }

      </div>
    </div>
  )
}

/* ---------- HUD overlay ---------- */

type HudProps = {
  daysRemaining: number
  currentTrackName: string
  dialogMessage: string | null
  dialogKey: number           // 👈 présent ici
  isPlaying: boolean
  onToggleMusic: () => void
  onDialogHidden?: () => void
}
function Hud({
  daysRemaining,
  currentTrackName,
  dialogMessage,
  dialogKey,          // 👈 on le récupère ici
  isPlaying,
  onToggleMusic,
  onDialogHidden,
}: HudProps) {


  const rootRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const barsRef = useRef<HTMLDivElement[]>([])
  const dialogTlRef = useRef<gsap.core.Timeline | null>(null)
  const barsTlRef = useRef<gsap.core.Timeline | null>(null)

  // 🔁 on garde la version à jour du callback sans re-trigger l'effet
  const onDialogHiddenRef = useRef(onDialogHidden)
  useEffect(() => {
    onDialogHiddenRef.current = onDialogHidden
  }, [onDialogHidden])

  useEffect(() => {
  if (!dialogRef.current) return

  dialogTlRef.current?.kill()
  dialogTlRef.current = null

  if (!dialogMessage) {
    gsap.to(dialogRef.current, {
      opacity: 0,
      y: 40,
      duration: 0.3,
      ease: 'power2.in',
    })
    return
  }

  const tl = gsap.timeline()
  dialogTlRef.current = tl

  tl.fromTo(
    dialogRef.current,
    { opacity: 0, y: 30 },
    { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
  )
    .to(dialogRef.current, {
      opacity: 1,
      duration: 2,
    })
    .to(dialogRef.current, {
      opacity: 0,
      y: 40,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        onDialogHiddenRef.current?.()
      },
    })

  return () => {
    tl.kill()
  }
}, [dialogMessage, dialogKey]) // 👈 clé ajoutée ici


  /* --- EQUALIZER ANIM: 3 barres qui bougent quand la musique joue --- */


  /* --- Rendu --- */
  return (
    <div className="hud">
      <div className="hud__top-left">
        <span className="hud__value">          {daysRemaining === 0 ? "Merry Christmas, Milla the witch ! " :  `${daysRemaining}  day${daysRemaining > 1 ? 's' : ''} before Christmas`}</span>
      </div>

      <div className="hud__top-right">
        <button
          type="button"
          className="hud__music-button"
          onClick={onToggleMusic}
        >
          <div className={`hud__music-bars `}>
            <span className={`hud__music-bar ${isPlaying ? 'hud__music-bar--active' : ''}`} />
            <span className={`hud__music-bar ${isPlaying ? 'hud__music-bar--active' : ''}`} />
            <span className={`hud__music-bar ${isPlaying ? 'hud__music-bar--active' : ''}`} />

          </div>
          <div className="hud__music-info">
            <span className="hud__music-name">{currentTrackName}</span>
          </div>
        </button>
      </div>

      <div className="hud__bottom">
        <div
          ref={dialogRef}
          className={`hud__dialog ${dialogMessage ? 'hud__dialog--visible' : 'hud__dialog--hidden'
            }`}
        >
          <p className="hud__dialog-text">
            {dialogMessage}
          </p>
        </div>
      </div>
    </div>

  )
}


/* ---------- App ---------- */

function App() {
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('default')
  const [followBookId, setFollowBookId] = useState<string | null>(null)
  const [currentGiftId, setCurrentGiftId] = useState<string | null>(null)

  // UI / overlay
  const [hasStarted, setHasStarted] = useState(false) // intro / expérience
  const [dialogMessage, setDialogMessage] = useState<string | null>(null)
  const [dialogKey, setDialogKey] = useState(0)

  // helper pour déclencher un message AVEC anim, même texte
  const showDialog = (msg: string) => {
    setDialogMessage(msg)
    setDialogKey((k) => k + 1)
  }

  // quand le HUD a fini son anim
  const handleDialogHidden = () => {
    setDialogMessage(null)
  }
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null)
  const [currentTrackName, setCurrentTrackName] = useState<string>('Aucune musique')
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const gifts = giftsConfig as GiftConfig
  const playTrack = useCallback((index: number) => {
    const audio = audioRef.current
    if (!audio) return

    const track = TRACKS[index]
    setCurrentTrackIndex(index)
    setCurrentTrackName(track.name)

    audio.src = track.src
    audio.currentTime = 0
    audio.volume = 0.5

    audio
      .play()
      .then(() => {
        setIsMusicPlaying(true)
      })
      .catch((err) => {
        console.warn('Playback bloqué par le navigateur :', err)
      })
  }, [])


  useEffect(() => {
    const audio = new Audio()
    audio.volume = 0.5
    audioRef.current = audio

    const handleEnded = () => {
      setCurrentTrackIndex((prev) => {
        if (prev === null) return prev
        const next = (prev + 1) % TRACKS.length
        playTrack(next)
        return next
      })
    }

    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('ended', handleEnded)
    }
  }, [playTrack])


  const isDev =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('dev') === 'true'

  const levaStore = useCreateStore()
  const mapControlRef = useRef<{ closeMap: () => void } | null>(null)
  const bookControlRef = useRef<{ closeActiveBook: (reason?: string) => void } | null>(null)

  const isMobile =
    typeof navigator !== 'undefined' &&
    /Mobi|Android/i.test(navigator.userAgent)

  const shadowSize = isMobile ? 1024 : 4096

  // Progress du chargement des assets 3D
  const { progress } = useProgress()

  // calcul simple : 24 jours - nb de livres ouverts
const currentAdventDay = getCurrentAdventDay()
// si 0 → on considère que tout reste à venir (24 jours)
// sinon → 24 - jour courant
const daysRemaining =
  currentAdventDay === 0 ? 24 : Math.max(0, 24 - currentAdventDay)
  // callback pour l’intro
  const handleStartExperience = () => {
    setHasStarted(true)
    // 🔊 On démarre la playlist au premier morceau
    playTrack(0)
  }



  // callback quand un livre verrouillé est cliqué
  const handleBookLocked = (id: string) => {
    setDialogMessage(`Book locked. Come back when the day comes !`)

  }
  const toggleMusic = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isMusicPlaying) {
      audio.pause()
      setIsMusicPlaying(false)
    } else {
      // si aucune musique n'a encore été lancée, on démarre au début de la playlist
      if (!audio.src) {
        playTrack(0)
      } else {
        audio
          .play()
          .then(() => setIsMusicPlaying(true))
          .catch((err) => console.warn('Playback bloqué :', err))
      }
    }
  }


  return (
    <div className="app">
      {isDev && <Leva store={levaStore} collapsed />}

      {/* INTRO / LOADING (plein écran) */}
      {!hasStarted && (
        <IntroScreen
          progress={progress} onStart={handleStartExperience} />
      )}

      {/* HUD / OVERLAY – seulement quand l’expérience a commencé */}
      {hasStarted && (
        <>
          <Hud
            daysRemaining={daysRemaining}
            currentTrackName={currentTrackName}
            dialogMessage={dialogMessage}
            dialogKey={dialogKey}
            isPlaying={isMusicPlaying}
            onToggleMusic={toggleMusic}
            onDialogHidden={handleDialogHidden}
          />

          {/* Bannière de cadeau déjà existante (quand un livre est ouvert) */}
          {currentGiftId && gifts[currentGiftId] && (
            <GiftBanner
              gift={gifts[currentGiftId]}
              onClose={() => setCurrentGiftId(null)}
            />
          )}
        </>
      )}
      <Canvas
        shadows
        dpr={isMobile ? [1, 1.2] : [1, 1.75]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 1.5, 5], fov: 30 }}
        onPointerMissed={ () => {
          setCameraPreset('default')
          mapControlRef.current?.closeMap()    
          bookControlRef.current?.closeActiveBook('miss')
          setFollowBookId(null)
        }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />

        <color attach="background" args={['black']} />
        <fog attach="fog" args={['black', -2, 29]} />

        <ambientLight intensity={0.05} color="#1a0d08" />
        <Environment preset="lobby" environmentIntensity={0.15} />

        <Model
          onBookOpened={(id) => {
            setCurrentGiftId(id)
            // tu peux aussi reset un éventuel message ici si tu veux
            setDialogMessage(null)
          }}
          onBookLocked={handleBookLocked} // 👈 NOUVEAU callback
          onBookcaseClick={() => {
            setCameraPreset('library')
            setFollowBookId(null)
          }}
          onMapClick={() => {
            setCameraPreset('map')
            setFollowBookId(null)
          }}
          onBookSelected={setFollowBookId}
          booksActive={cameraPreset === 'library'}
          openedBooks={advent.openedBooks}
          mapControlRef={mapControlRef}
          bookControlRef={bookControlRef}
        />

        <CameraRig
          preset={cameraPreset}
          followBookId={followBookId}
          levaStore={levaStore}
          isDev={isDev}
        />

        <PlaneGeometry />

        <spotLight
          castShadow
          position={[0, 5, 0]}
          angle={0.7}
          penumbra={10}
          intensity={20}
          distance={25}
          decay={0.2}
          color="#ffa04d"
          shadow-mapSize-width={shadowSize}
          shadow-mapSize-height={shadowSize}
          shadow-bias={-0.001}
          shadow-radius={6}
        />

        <ContactShadows
          position={[0, -0.009, 0]}
          opacity={0.7}
          width={10}
          height={10}
          blur={2.8}
          far={10}
          resolution={1024}
          frames={1}
        />
      </Canvas>
    </div>
  )
}

export default App
