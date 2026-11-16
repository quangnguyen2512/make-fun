'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Home,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { CameraPreset, HudSnapshot } from '@/lib/game/types';
import { type EngineController, initSolarWardenEngine } from '@/lib/three/engine';

interface SolarWarden3DProps {
  autostart?: boolean;
  shot?: string | null;
  seed?: number;
}

const INITIAL_HUD: HudSnapshot = {
  mode: 'title',
  outcome: null,
  hull: 4,
  maxHull: 4,
  novaPct: 35,
  score: 0,
  bestScore: 0,
  combo: 1,
  waveNumber: 1,
  totalWaves: 5,
  waveTitle: 'SECTOR I · SOLAR DRIFT',
  waveBannerVisible: false,
  parriesLanded: 0,
  enemiesDefeated: 0,
  bossHpPct: null,
};

function HullSocketIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
      <path
        d="M12 2.5L20 6.2V12.2C20 16.9 16.6 20.4 12 22C7.4 20.4 4 16.9 4 12.2V6.2L12 2.5Z"
        fill={filled ? '#38d9a9' : '#0b1224'}
        stroke="#050814"
        strokeWidth="2"
      />
      <path
        d="M12 4.6L17.8 7.3V12.1C17.8 15.6 15.3 18.3 12 19.7C8.7 18.3 6.2 15.6 6.2 12.1V7.3L12 4.6Z"
        fill={filled ? '#86efac' : '#16203d'}
        fillOpacity={filled ? 0.45 : 0.6}
      />
      {filled && (
        <path
          d="M7.5 8.1L12 5.9L16.5 8.1"
          stroke="#ecfdf5"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

function TitleEmblemSvg() {
  return (
    <svg
      viewBox="0 0 380 112"
      className="w-full max-w-[360px] select-none"
      role="img"
      aria-label="Solar Warden"
    >
      {/* Celestial Astrolabe Crest */}
      <g transform="translate(46, 56)">
        <circle cx="0" cy="0" r="34" fill="#0d152e" stroke="#e5b363" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="24" fill="none" stroke="#38d9a9" strokeWidth="1.4" strokeDasharray="5 4" />
        <polygon points="0,-29 7,-7 29,0 7,7 0,29 -7,7 -29,0 -7,-7" fill="#fde3a7" stroke="#080d1e" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="6" fill="#38d9a9" stroke="#080d1e" strokeWidth="1.5" />
      </g>

      {/* Bespoke Display Typography */}
      <text
        x="96"
        y="48"
        fill="#f4eee1"
        stroke="#060a17"
        strokeWidth="5"
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '34px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          paintOrder: 'stroke fill',
        }}
      >
        SOLAR
      </text>
      <text
        x="96"
        y="84"
        fill="#e5b363"
        stroke="#060a17"
        strokeWidth="5"
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '34px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          paintOrder: 'stroke fill',
        }}
      >
        WARDEN
      </text>
      <line x1="96" y1="96" x2="348" y2="96" stroke="#e5b363" strokeOpacity="0.45" strokeWidth="1.5" />
    </svg>
  );
}

export function SolarWarden3D({ autostart = false, shot = null, seed = 42 }: SolarWarden3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EngineController | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    ...INITIAL_HUD,
    mode: autostart ? 'playing' : 'title',
  }));
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('tactical');
  const [autoFire, setAutoFire] = useState(true);
  const [muted, setMuted] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const optsRef = useRef({ autostart, shot, seed });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const controller = initSolarWardenEngine(
      el,
      {
        autostart: optsRef.current.autostart,
        shot: optsRef.current.shot,
        seed: optsRef.current.seed,
      },
      (snapshot) => {
        setHud(snapshot);
      },
    );
    engineRef.current = controller;

    return () => {
      controller.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyM') {
        setMuted((prev) => {
          const next = !prev;
          engineRef.current?.setMuted(next);
          return next;
        });
      } else if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyF') {
        setAutoFire((prev) => {
          const next = !prev;
          engineRef.current?.setAutoFire(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const handleCameraChange = (preset: CameraPreset, e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    setCameraPreset(preset);
    engineRef.current?.setCameraPreset(preset);
  };

  const handleAutoFireToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    setAutoFire((prev) => {
      const next = !prev;
      engineRef.current?.setAutoFire(next);
      return next;
    });
  };

  const handleMuteToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  };

  const showHud = hud.mode === 'playing' || hud.mode === 'paused';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070b18] text-[#f4eee1] select-none">
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={mountRef}
        data-testid="webgl-viewport"
        className="fixed inset-0 z-0"
      />

      {/* Full-Viewport Pointer-Pass-Through Game Shell */}
      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
        {/* TITLE SCREEN OVERLAY */}
        {hud.mode === 'title' && (
          <>
            <div className="flex flex-1 items-center">
              <div className="pointer-events-auto ml-2 max-w-[380px] sm:ml-8">
                <TitleEmblemSvg />
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#cbd5e1] [text-shadow:0_2px_8px_rgba(3,6,18,0.95)]">
                  Defend the Celestial Astrolabe. Deflect incoming volleys with Aegis Parry and shatter the Eclipse armada.
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    data-start="true"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      engineRef.current?.startRun();
                    }}
                    className="inline-flex items-center gap-2.5 border border-[#f6d08a] bg-[#e5b363] px-7 py-3.5 text-sm font-bold tracking-[0.14em] text-[#080d1e] uppercase shadow-[0_8px_24px_rgba(0,0,0,0.65)] transition-transform hover:scale-[1.02] hover:bg-[#fde3a7] active:scale-[0.98]"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Launch Sortie
                  </button>
                  {hud.bestScore > 0 && (
                    <div className="border border-[#e5b363]/40 bg-[#0b1224]/88 px-3.5 py-2.5 text-right">
                      <div className="text-[10px] tracking-[0.16em] text-[#e5b363] uppercase">Best</div>
                      <div className="font-mono text-base font-bold tabular-nums text-[#f4eee1]">
                        {hud.bestScore}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="pb-1 text-center text-xs tracking-[0.14em] text-[#94a3b8] uppercase [text-shadow:0_2px_6px_rgba(0,0,0,0.95)]">
              WASD Move · Mouse Aim · Space Parry · Q Solar Nova · P Pause
            </div>
          </>
        )}

        {/* PLAYING / PAUSED PERIMETER HUD */}
        {showHud && (
          <>
            <div className="flex items-start justify-between gap-4">
              {/* Top-Left: Hull Integrity & Solar Nova Gauge */}
              <div className="border border-[#e5b363]/35 bg-[#0a1024]/88 px-3.5 py-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.55)]">
                <div className="flex items-center gap-1.5">
                  <span className="mr-1.5 text-[10px] font-semibold tracking-[0.18em] text-[#e5b363] uppercase">
                    Hull
                  </span>
                  {Array.from({ length: hud.maxHull }).map((_, i) => (
                    <HullSocketIcon key={i} filled={i < hud.hull} />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-[0.16em] text-[#94a3b8] uppercase">
                    Nova [Q]
                  </span>
                  <div className="h-2 w-28 overflow-hidden bg-[#16203d] ring-1 ring-[#e5b363]/30">
                    <div
                      className={`h-full transition-[width] duration-150 ${
                        hud.novaPct >= 100 ? 'bg-[#fde3a7]' : 'bg-[#38d9a9]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, hud.novaPct))}%` }}
                    />
                  </div>
                  <span className="w-9 text-right font-mono text-xs font-bold tabular-nums text-[#f4eee1]">
                    {hud.novaPct}%
                  </span>
                </div>
              </div>

              {/* Top-Center: Sector Badge, Boss Health Bar & Wave Banner */}
              <div className="flex flex-col items-center gap-2">
                <div className="border border-[#e5b363]/35 bg-[#0a1024]/88 px-4 py-1.5 text-center shadow-[0_6px_20px_rgba(0,0,0,0.55)]">
                  <div className="text-[10px] tracking-[0.18em] text-[#e5b363] uppercase">
                    Sector {hud.waveNumber} / {hud.totalWaves}
                  </div>
                </div>
                {hud.waveBannerVisible && (
                  <div className="border-y border-[#e5b363]/60 bg-[#0a1024]/88 px-6 py-1.5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
                    <div className="text-xs font-bold tracking-[0.22em] text-[#fde3a7] uppercase">
                      {hud.waveTitle}
                    </div>
                  </div>
                )}
                {hud.bossHpPct !== null && (
                  <div className="w-64 border border-[#ff5a4f]/50 bg-[#0a1024]/92 px-3 py-2 shadow-[0_6px_20px_rgba(0,0,0,0.65)] sm:w-80">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-[0.16em] text-[#ffb4a2] uppercase">
                      <span>Eclipse Leviathan</span>
                      <span className="font-mono tabular-nums">{hud.bossHpPct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden bg-[#23101a]">
                      <div
                        className="h-full bg-[#ff5a4f] transition-[width] duration-150"
                        style={{ width: `${hud.bossHpPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Top-Right: Tabular Score + Combo + Utility Buttons */}
              <div className="flex items-start gap-2.5">
                <div className="border border-[#e5b363]/35 bg-[#0a1024]/88 px-3.5 py-2 text-right shadow-[0_6px_20px_rgba(0,0,0,0.55)]">
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.18em] text-[#e5b363] uppercase">
                      Score
                    </span>
                    <span className="font-mono text-xl font-bold tabular-nums text-[#f4eee1]">
                      {hud.score}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-end gap-3 text-[11px] text-[#94a3b8]">
                    <span className="font-mono font-bold tabular-nums text-[#38d9a9]">
                      ×{hud.combo} Combo
                    </span>
                    <span className="font-mono tabular-nums">Best {hud.bestScore}</span>
                  </div>
                </div>

                <div className="pointer-events-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                    title="Mute [M]"
                    onClick={handleMuteToggle}
                    className="flex h-10 w-10 items-center justify-center border border-[#e5b363]/40 bg-[#0a1024]/90 text-[#f4eee1] hover:border-[#e5b363] hover:text-[#fde3a7]"
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Pause game"
                    title="Pause [P]"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      engineRef.current?.togglePause();
                    }}
                    className="flex h-10 w-10 items-center justify-center border border-[#e5b363]/40 bg-[#0a1024]/90 text-[#f4eee1] hover:border-[#e5b363] hover:text-[#fde3a7]"
                  >
                    <Pause className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Restart sortie"
                    title="Restart [R]"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      engineRef.current?.startRun();
                    }}
                    className="flex h-10 w-10 items-center justify-center border border-[#e5b363]/40 bg-[#0a1024]/90 text-[#f4eee1] hover:border-[#e5b363] hover:text-[#fde3a7]"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsible Unified Bottom Control Dock */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                tabIndex={-1}
                aria-expanded={!dockCollapsed}
                aria-label={dockCollapsed ? 'Show controls' : 'Hide controls'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setDockCollapsed((prev) => !prev);
                }}
                className="pointer-events-auto inline-flex items-center gap-1.5 border border-b-0 border-[#e5b363]/40 bg-[#0a1024]/92 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-[#cbd5e1] uppercase hover:text-[#fde3a7]"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Controls [H]
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Hide Controls [H]
                  </>
                )}
              </button>

              <div
                className={`pointer-events-auto overflow-hidden transition-all duration-200 ${
                  dockCollapsed ? 'max-h-0 opacity-0' : 'max-h-24 opacity-100'
                }`}
              >
                <div className="flex flex-wrap items-center justify-center gap-2 border border-[#e5b363]/40 bg-[#0a1024]/92 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.75)]">
                  <div className="flex items-center gap-1 border-r border-[#e5b363]/25 pr-2.5">
                    <Camera className="mr-1 h-3.5 w-3.5 text-[#e5b363]" />
                    {(['tactical', 'cinematic', 'overhead'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => handleCameraChange(preset, e)}
                        className={`px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors ${
                          cameraPreset === preset
                            ? 'bg-[#e5b363] text-[#080d1e]'
                            : 'bg-[#131c38] text-[#cbd5e1] hover:text-[#f4eee1]'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={handleAutoFireToggle}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase ${
                      autoFire
                        ? 'bg-[#38d9a9]/25 text-[#38d9a9] ring-1 ring-[#38d9a9]/60'
                        : 'bg-[#131c38] text-[#94a3b8]'
                    }`}
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    Auto-Fire [F]
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      engineRef.current?.triggerParry();
                    }}
                    className="inline-flex items-center gap-1.5 bg-[#131c38] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#38d9a9] uppercase ring-1 ring-[#38d9a9]/40 hover:bg-[#1a274d]"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Parry [Space]
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={hud.novaPct < 100}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      engineRef.current?.triggerNova();
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase ${
                      hud.novaPct >= 100
                        ? 'bg-[#e5b363] text-[#080d1e]'
                        : 'bg-[#131c38] text-[#64748b] opacity-70'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Nova [Q]
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* PAUSED MODAL */}
        {hud.mode === 'paused' && (
          <div className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-[#040712]/72 p-4">
            <div className="w-full max-w-sm border border-[#e5b363]/55 bg-[#0b1226] p-6 text-center shadow-[0_18px_48px_rgba(0,0,0,0.85)]">
              <div className="text-xs font-semibold tracking-[0.2em] text-[#e5b363] uppercase">
                Sortie Suspended
              </div>
              <h2 className="mt-1 font-serif text-2xl font-bold tracking-wide text-[#f4eee1]">
                PAUSED
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2 border-y border-[#e5b363]/20 py-3">
                <div>
                  <div className="text-[10px] tracking-[0.16em] text-[#94a3b8] uppercase">Score</div>
                  <div className="font-mono text-lg font-bold tabular-nums text-[#f4eee1]">{hud.score}</div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.16em] text-[#94a3b8] uppercase">Sector</div>
                  <div className="font-mono text-lg font-bold tabular-nums text-[#38d9a9]">
                    {hud.waveNumber} / {hud.totalWaves}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.togglePause();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 bg-[#e5b363] py-2.5 text-xs font-bold tracking-[0.15em] text-[#080d1e] uppercase hover:bg-[#fde3a7]"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Resume Sortie
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.startRun();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 border border-[#e5b363]/45 bg-[#121c3a] py-2.5 text-xs font-semibold tracking-[0.15em] text-[#f4eee1] uppercase hover:border-[#e5b363]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.returnTitle();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 border border-[#64748b]/40 bg-transparent py-2 text-xs font-semibold tracking-[0.15em] text-[#94a3b8] uppercase hover:text-[#f4eee1]"
                >
                  <Home className="h-4 w-4" />
                  Return to Title
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VICTORY / GAME OVER MODAL */}
        {hud.mode === 'gameover' && (
          <div className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-[#040712]/78 p-4">
            <div className="w-full max-w-md border border-[#e5b363]/60 bg-[#0b1226] p-7 text-center shadow-[0_20px_54px_rgba(0,0,0,0.88)]">
              <div
                className={`text-xs font-semibold tracking-[0.22em] uppercase ${
                  hud.outcome === 'victory' ? 'text-[#38d9a9]' : 'text-[#ff5a4f]'
                }`}
              >
                {hud.outcome === 'victory' ? 'Eclipse Leviathan Vanquished' : 'Bastion Breached'}
              </div>
              <h2 className="mt-1.5 font-serif text-3xl font-bold tracking-wider text-[#f4eee1]">
                {hud.outcome === 'victory' ? 'SECTOR SECURED' : 'SORTIE LOST'}
              </h2>

              <div className="mt-5 grid grid-cols-3 gap-2 border-y border-[#e5b363]/25 py-3.5">
                <div>
                  <div className="text-[10px] tracking-[0.14em] text-[#94a3b8] uppercase">Score</div>
                  <div className="font-mono text-xl font-bold tabular-nums text-[#fde3a7]">
                    {hud.score}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.14em] text-[#94a3b8] uppercase">Parries</div>
                  <div className="font-mono text-xl font-bold tabular-nums text-[#38d9a9]">
                    {hud.parriesLanded}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.14em] text-[#94a3b8] uppercase">
                    {hud.outcome === 'victory' ? 'Destroyed' : 'Sector'}
                  </div>
                  <div className="font-mono text-xl font-bold tabular-nums text-[#f4eee1]">
                    {hud.outcome === 'victory' ? hud.enemiesDefeated : `${hud.waveNumber}/${hud.totalWaves}`}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs tracking-[0.12em] text-[#94a3b8] uppercase">
                Best Record: <span className="font-mono font-bold tabular-nums text-[#e5b363]">{hud.bestScore}</span>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.startRun();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 bg-[#e5b363] py-3 text-xs font-bold tracking-[0.16em] text-[#080d1e] uppercase hover:bg-[#fde3a7]"
                >
                  <RotateCcw className="h-4 w-4" />
                  {hud.outcome === 'victory' ? 'Play Again' : 'Try Again'}
                </button>
                {hud.outcome === 'victory' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      engineRef.current?.continueEndless();
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 border border-[#38d9a9]/55 bg-[#10262b] py-2.5 text-xs font-bold tracking-[0.14em] text-[#38d9a9] uppercase hover:bg-[#143339]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Continue Endless Drift
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.returnTitle();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 border border-[#64748b]/40 py-2 text-xs font-semibold tracking-[0.14em] text-[#94a3b8] uppercase hover:text-[#f4eee1]"
                >
                  <Home className="h-4 w-4" />
                  Return to Title
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
