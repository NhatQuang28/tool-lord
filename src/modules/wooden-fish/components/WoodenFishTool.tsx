"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";

/** localStorage slots so merit + sound preference survive reloads. */
const MERIT_KEY = "go-mo:merit";
const MUTED_KEY = "go-mo:muted";

/** Every N knocks, the Buddha manifests. */
const BLESS_EVERY = 100;

/** Auspicious phrases that float up on each knock. */
const PHRASES = [
  "Phước +1",
  "Công đức +1",
  "An lạc +1",
  "Bình an +1",
  "May mắn +1",
];

// The mouse cursor becomes a wooden mallet (dùi mõ). Built as an inline SVG
// data URI, rotated so the striking head points toward 10 o'clock (up-left);
// the hotspot (last two numbers) sits at that head.
const MALLET_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='52' height='52' viewBox='0 0 52 52'><g transform='rotate(-60 26 26)'><rect x='22' y='14' width='8' height='34' rx='4' fill='#9a6531' stroke='#4a2a12' stroke-width='2'/><rect x='14' y='3' width='24' height='15' rx='7.5' fill='#bd7f40' stroke='#4a2a12' stroke-width='2'/><rect x='19' y='6' width='9' height='4' rx='2' fill='#e6c393' opacity='.6'/></g></svg>`;
const MALLET_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  MALLET_SVG,
)}") 7 12, pointer`;

interface Pop {
  id: number;
  x: number;
  y: number;
  text: string;
}

export function WoodenFishTool() {
  const reduce = useReducedMotion();
  const [merit, setMerit] = useState(0);
  const [muted, setMuted] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const [blessing, setBlessing] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const idRef = useRef(0);
  const fishRef = useRef<HTMLDivElement>(null);
  const meritRef = useRef(0);
  const blessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore saved merit + sound preference on first mount.
  useEffect(() => {
    try {
      const savedMerit = localStorage.getItem(MERIT_KEY);
      if (savedMerit) {
        const n = parseInt(savedMerit, 10) || 0;
        setMerit(n);
        meritRef.current = n;
      }
      setMuted(localStorage.getItem(MUTED_KEY) === "1");
    } catch {
      /* localStorage may be unavailable */
    }
  }, []);

  const playKnock = useCallback(() => {
    if (muted) return;
    try {
      let ctx = audioRef.current;
      if (!ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctx = new Ctor();
        audioRef.current = ctx;
      }
      if (ctx.state === "suspended") void ctx.resume();

      // A dry "cốc": two pieces of wood struck together. Modelled as a short
      // noise burst (the contact clack) plus a few fast-decaying resonant wood
      // modes. A little per-hit pitch drift keeps repeated knocks natural.
      const now = ctx.currentTime;
      const drift = 0.96 + Math.random() * 0.08; // ±4%

      // 1) Contact click — brief band-passed noise burst.
      const noiseDur = 0.03;
      const frames = Math.max(1, Math.floor(ctx.sampleRate * noiseDur));
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseBP = ctx.createBiquadFilter();
      noiseBP.type = "bandpass";
      noiseBP.frequency.value = 2200 * drift;
      noiseBP.Q.value = 0.9;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0008, now + noiseDur);
      noise.connect(noiseBP).connect(noiseGain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + noiseDur);

      // 2) Woody body — resonant modes with quick, natural decay.
      const modes = [
        { f: 880, g: 0.5, d: 0.14 },
        { f: 1350, g: 0.26, d: 0.09 },
        { f: 2500, g: 0.12, d: 0.05 },
      ];
      for (const m of modes) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const f = m.f * drift;
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 0.86, now + m.d);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(m.g, now + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, now + m.d);
        osc.connect(g).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + m.d + 0.02);
      }
    } catch {
      /* audio may be blocked; the tool still works silently */
    }
  }, [muted]);

  const knock = useCallback(() => {
    // +1 merit (persisted). Track in a ref so we can reliably detect the
    // every-100 milestone without racing React's async state.
    const n = meritRef.current + 1;
    meritRef.current = n;
    setMerit(n);
    try {
      localStorage.setItem(MERIT_KEY, String(n));
    } catch {
      /* ignore */
    }
    // Every 100 knocks, the Buddha manifests for 4 seconds.
    if (n % BLESS_EVERY === 0) {
      setBlessing(true);
      if (blessTimerRef.current) clearTimeout(blessTimerRef.current);
      blessTimerRef.current = setTimeout(() => setBlessing(false), 4000);
    }

    // Spawn a floating "+1" at a random spot within ~500px of the wooden fish.
    const id = idRef.current++;
    const rect = fishRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const RADIUS = 500;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * RADIUS;
    const margin = 60;
    const x = Math.min(
      window.innerWidth - margin,
      Math.max(margin, cx + Math.cos(angle) * dist),
    );
    const y = Math.min(
      window.innerHeight - margin,
      Math.max(margin, cy + Math.sin(angle) * dist),
    );
    const text = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    setPops((prev) => [...prev, { id, x, y, text }]);
    window.setTimeout(
      () => setPops((prev) => prev.filter((p) => p.id !== id)),
      1100,
    );

    playKnock();
  }, [playKnock]);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const reset = () => {
    setMerit(0);
    meritRef.current = 0;
    try {
      localStorage.setItem(MERIT_KEY, "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="gomo-root"
      style={{ cursor: MALLET_CURSOR }}
      onClick={knock}
      role="button"
      tabIndex={0}
      aria-label="Gõ mõ để tích công đức"
    >
      {/* Floating controls (don't count as a knock). */}
      <div
        className="gomo-top"
        style={{ cursor: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gomo-counter">
          <span className="gomo-counter-label">Công đức</span>
          <span className="gomo-counter-value">
            {merit.toLocaleString("vi-VN")}
          </span>
        </div>
        <div className="row" style={{ gap: "var(--space-2)" }}>
          <button
            type="button"
            className="btn small"
            onClick={toggleMute}
            title={muted ? "Bật tiếng mõ" : "Tắt tiếng mõ"}
            aria-pressed={muted}
          >
            {muted ? (
              <VolumeX size={16} strokeWidth={2.2} />
            ) : (
              <Volume2 size={16} strokeWidth={2.2} />
            )}
          </button>
          <button
            type="button"
            className="btn small"
            onClick={reset}
            title="Về 0 công đức"
          >
            <RotateCcw size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* The wooden fish, centered on screen. */}
      <motion.div
        ref={fishRef}
        className="gomo-fish"
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={reduce ? undefined : { scale: 0.92, rotate: -1 }}
        transition={{ type: "spring", stiffness: 700, damping: 22 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="gomo-img"
          src="/mo.png"
          alt="Mõ gỗ"
          draggable={false}
        />
      </motion.div>
      <p className="gomo-hint">Nhấn để gõ mõ · mỗi tiếng mõ một phần phước</p>

      {/* Floating "+1" texts at random screen positions. */}
      {pops.map((p) => (
        <span
          key={p.id}
          className="gomo-pop"
          style={{ left: p.x, top: p.y }}
          aria-hidden
        >
          {p.text}
        </span>
      ))}

      {/* Every 100 knocks: the Buddha manifests with a radiant aura for 4s. */}
      <AnimatePresence>
        {blessing && (
          <motion.div
            className="gomo-bless"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="gomo-bless-rays" aria-hidden />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              className="gomo-bless-img"
              src="/phat.png"
              alt="Phật Tổ hiển linh"
              draggable={false}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
            />
            <motion.p
              className="gomo-bless-text"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Phật Tổ chứng giám · Công đức viên mãn
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
