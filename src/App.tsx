import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RotateCcw,
  Snowflake,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import {
  ChristmasSceneCanvas,
  type RibbonMode,
  type SceneSettings,
  type SnowMode,
} from './scene/ChristmasSceneCanvas';
import { useHandTracking } from './hooks/useHandTracking';
import { LofiChristmasJazzPlayer } from './audio/lofiChristmasJazz';

export default function App() {
  const [settings, setSettings] = useState<SceneSettings>({
    autoDrift: true,
    snowMode: 'gentle',
    ribbonMode: 'calm',
    resetCounter: 0,
  });

  // Collapsed by default so the scene opens unobstructed, matching the reference composition
  const [controlsOpen, setControlsOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);

  const audioPlayerRef = useRef<LofiChristmasJazzPlayer | null>(null);
  const { videoRef, handStateRef, uiState } = useHandTracking(cameraEnabled);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setZenMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      audioPlayerRef.current?.dispose();
      audioPlayerRef.current = null;
    };
  }, []);

  const toggleMusic = () => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new LofiChristmasJazzPlayer();
    }
    if (musicPlaying) {
      audioPlayerRef.current.pause();
      setMusicPlaying(false);
    } else {
      void audioPlayerRef.current.play();
      setMusicPlaying(true);
    }
  };

  const cycleSnow = () => {
    setSettings((prev) => {
      const order: SnowMode[] = ['gentle', 'rich', 'off'];
      const next = order[(order.indexOf(prev.snowMode) + 1) % order.length];
      return { ...prev, snowMode: next };
    });
  };

  const toggleRibbon = () => {
    setSettings((prev) => {
      const next: RibbonMode = prev.ribbonMode === 'calm' ? 'radiant' : 'calm';
      return { ...prev, ribbonMode: next };
    });
  };

  const toggleDrift = () => {
    setSettings((prev) => ({ ...prev, autoDrift: !prev.autoDrift }));
  };

  const handleResetView = () => {
    setSettings((prev) => ({ ...prev, resetCounter: prev.resetCounter + 1 }));
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#050203] select-none">
      {/* Full-viewport 3D WebGL canvas */}
      <div className="absolute inset-0">
        <ChristmasSceneCanvas settings={settings} handStateRef={handStateRef} />
      </div>

      {/* Top-right Enable camera toggle & compact hand-tracking status */}
      {!zenMode && (
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={cameraEnabled}
            onClick={() => setCameraEnabled((prev) => !prev)}
            className={`inline-flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-xs tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-[#e3ba6e] ${
              cameraEnabled
                ? 'border-[#d9ad5b]/55 bg-[#290911]/92 text-[#fae6b4]'
                : 'border-[#d9ad5b]/25 bg-[#0d0507]/88 text-[#e9cf96]/85 hover:border-[#d9ad5b]/45 hover:text-[#fae6b4]'
            }`}
          >
            <Camera className="h-3.5 w-3.5 text-[#d9ad5b]" aria-hidden="true" />
            <span className="whitespace-nowrap">Enable camera</span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${
                cameraEnabled
                  ? 'border-[#e6c173]/70 bg-[#b8893a]/70'
                  : 'border-[#d9ad5b]/30 bg-[#1a0a0d]'
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full transition-transform ${
                  cameraEnabled
                    ? 'translate-x-3.5 bg-[#fff2cc]'
                    : 'translate-x-0.5 bg-[#cbb58a]/75'
                }`}
              />
            </span>
          </button>

          {cameraEnabled && (
            <div className="flex w-40 flex-col items-center gap-1.5 rounded-xl border border-[#d9ad5b]/25 bg-[#0b0406]/90 p-2 shadow-xl">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={
                  uiState.status === 'active'
                    ? 'h-24 w-full rounded-lg border border-[#d9ad5b]/20 object-cover -scale-x-100'
                    : 'hidden'
                }
              />
              <div className="w-full text-center text-[11px] tracking-wide">
                {uiState.status === 'starting' && (
                  <span className="text-[#cbb58a]">Starting camera...</span>
                )}
                {uiState.status === 'error' && (
                  <span className="text-[#e0828b]">{uiState.errorMessage}</span>
                )}
                {uiState.status === 'active' && (
                  <span
                    className={
                      uiState.handDetected
                        ? uiState.isHandOpen
                          ? 'font-medium text-[#fae6b4]'
                          : 'text-[#d9ad5b]'
                        : 'text-[#cbb58a]/75'
                    }
                  >
                    {uiState.handDetected
                      ? uiState.isHandOpen
                        ? 'OPEN (Unleash)'
                        : 'CLOSED'
                      : 'Show hand to control'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Elegant centered vintage calligraphic title in upper negative space */}
      {!zenMode && (
        <header className="pointer-events-none absolute inset-x-0 top-[4.2%] sm:top-[4.8%] z-10 flex justify-center px-6">
          <div className="champagne-title-glow">
            <h1
              className="font-script champagne-title px-8 py-2 text-center font-normal tracking-wide leading-normal"
              style={{
                fontSize: 'clamp(2.6rem, 5.2vw, 4.75rem)',
              }}
            >
              Merry Christmas!
            </h1>
          </div>
        </header>
      )}

      {/* Discreet collapsible bottom control dock (solid rgba surface, no backdrop-filter over WebGL) */}
      {!zenMode ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center px-4">
          {!controlsOpen ? (
            <button
              type="button"
              onClick={() => setControlsOpen(true)}
              aria-label="Show scene controls"
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-[#d9ad5b]/20 bg-[#0d0507]/85 px-3.5 py-1.5 text-xs tracking-wider text-[#e9cf96]/75 transition-colors hover:border-[#d9ad5b]/45 hover:text-[#fae6b4] focus-visible:outline-2 focus-visible:outline-[#e3ba6e]"
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap">Scene Controls</span>
            </button>
          ) : (
            <div className="pointer-events-auto flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setControlsOpen(false)}
                aria-label="Collapse scene controls"
                className="inline-flex items-center gap-1 rounded-t-lg border border-b-0 border-[#d9ad5b]/20 bg-[#0d0507]/90 px-3 py-1 text-[11px] tracking-wider text-[#e9cf96]/70 transition-colors hover:text-[#fae6b4] focus-visible:outline-2 focus-visible:outline-[#e3ba6e]"
              >
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
                <span className="whitespace-nowrap">Collapse</span>
              </button>

              <nav
                aria-label="Scene Atmosphere Controls"
                className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-[#d9ad5b]/25 bg-[#0b0406]/92 px-3 py-2 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={toggleDrift}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs tracking-wide transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e3ba6e] ${
                    settings.autoDrift
                      ? 'bg-[#5c0f1b]/85 text-[#fce8b8] border border-[#d9ad5b]/35'
                      : 'text-[#cbb58a]/80 border border-transparent hover:bg-[#1f0a0e] hover:text-[#f5dfa9]'
                  }`}
                >
                  <Wind className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Drift: {settings.autoDrift ? 'On' : 'Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={cycleSnow}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs tracking-wide text-[#e9cf96] transition-colors hover:bg-[#1f0a0e] hover:text-[#fae6b4] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e3ba6e]"
                >
                  <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Snow: {settings.snowMode === 'gentle' ? 'Gentle' : settings.snowMode === 'rich' ? 'Rich' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleRibbon}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs tracking-wide text-[#e9cf96] transition-colors hover:bg-[#1f0a0e] hover:text-[#fae6b4] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e3ba6e]"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ribbon: {settings.ribbonMode === 'calm' ? 'Calm' : 'Radiant'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleMusic}
                  aria-pressed={musicPlaying}
                  aria-label={musicPlaying ? 'Pause ambient Christmas jazz' : 'Play ambient Christmas jazz'}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs tracking-wide transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e3ba6e] ${
                    musicPlaying
                      ? 'bg-[#5c0f1b]/85 text-[#fce8b8] border border-[#d9ad5b]/35'
                      : 'text-[#cbb58a]/80 border border-transparent hover:bg-[#1f0a0e] hover:text-[#f5dfa9]'
                  }`}
                >
                  {musicPlaying ? (
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Jazz: {musicPlaying ? 'Playing' : 'Paused'}</span>
                </button>

                <span className="mx-0.5 hidden h-4 w-px bg-[#d9ad5b]/20 sm:inline-block" aria-hidden="true" />

                <button
                  type="button"
                  onClick={handleResetView}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs tracking-wide text-[#e9cf96]/85 transition-colors hover:bg-[#1f0a0e] hover:text-[#fae6b4] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e3ba6e]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset View</span>
                </button>

                <button
                  type="button"
                  onClick={() => setZenMode(true)}
                  title="Hide title & controls (H)"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs tracking-wide text-[#cbb58a]/75 transition-colors hover:bg-[#1f0a0e] hover:text-[#fae6b4] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#e3ba6e]"
                >
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hide UI</span>
                </button>
              </nav>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setZenMode(false)}
          aria-label="Restore title and controls"
          className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-lg border border-[#d9ad5b]/20 bg-[#0d0507]/80 px-3 py-1.5 text-xs text-[#e9cf96]/70 transition-colors hover:text-[#fae6b4] focus-visible:outline-2 focus-visible:outline-[#e3ba6e]"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Show UI</span>
        </button>
      )}
    </main>
  );
}
