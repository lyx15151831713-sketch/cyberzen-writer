/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CyberZen Immersive Writing Platform - Integrated Version
 */

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CloudRain, Snowflake, Download, Volume2, Type, RotateCcw, Play, Pause, Save, Trash2, Check
} from 'lucide-react';
import { cn } from './lib/utils';
import { RainShader, SnowShader } from './components/BackgroundShader';
import { useTexture } from '@react-three/drei';

// --- Types ---
type Mode = 'rain' | 'snow';
type FontSize = 'small' | 'medium' | 'large';
type FontFamily = 'serif' | 'sans' | 'mono' | 'klee';

// --- Background Component (WebGL) ---
const Background = ({ mode, intensity, mouse }: { mode: Mode; intensity: number; mouse: THREE.Vector2 }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, viewport } = useThree();
  const lerpedMouse = useRef(new THREE.Vector2());
  
  const rainTexture = useTexture('https://images.unsplash.com/photo-1428592953211-077101b2021b?auto=format&fit=crop&w=1920&q=80');
  const snowTexture = useTexture('https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1920&q=80');
  
  useEffect(() => {
    if (rainTexture) { rainTexture.wrapS = rainTexture.wrapT = THREE.RepeatWrapping; }
    if (snowTexture) { snowTexture.wrapS = snowTexture.wrapT = THREE.RepeatWrapping; }
  }, [rainTexture, snowTexture]);
  
  const shader = useMemo(() => {
    const s = mode === 'rain' ? { ...RainShader } : { ...SnowShader };
    if (s.uniforms.iResolution) s.uniforms.iResolution.value.set(size.width, size.height);
    if (s.uniforms.iChannel0) s.uniforms.iChannel0.value = mode === 'rain' ? rainTexture : snowTexture;
    return s;
  }, [mode, size, rainTexture, snowTexture]);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      const time = state.clock.getElapsedTime();
      if (material.uniforms.uTime) material.uniforms.uTime.value = time;
      if (material.uniforms.iTime) material.uniforms.iTime.value = time;
      if (material.uniforms.uIntensity) material.uniforms.uIntensity.value = intensity;
      lerpedMouse.current.lerp(mouse, 0.05);
      if (material.uniforms.iMouse) material.uniforms.iMouse.value.copy(lerpedMouse.current);
    }
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial key={mode} {...shader} />
    </mesh>
  );
};

// --- Main App ---
export default function App() {
  // --- States with Persistence ---
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('zen-mode') as Mode) || 'rain');
  const [content, setContent] = useState(() => localStorage.getItem('zen-content') || '');
  const [intensity, setIntensity] = useState(0.5);
  const [blur, setBlur] = useState(() => Number(localStorage.getItem('zen-blur')) || 20);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('zen-volume')) || 0.3);
  const [rainVolume, setRainVolume] = useState(() => Number(localStorage.getItem('zen-rain-volume')) || 0.5);
  const [snowVolume, setSnowVolume] = useState(() => Number(localStorage.getItem('zen-snow-volume')) || 0.2);
  
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [fontFamily, setFontFamily] = useState<FontFamily>('sans');
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const [isUIActive, setIsUIActive] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [timer, setTimer] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerFinished, setIsTimerFinished] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [mouse] = useState(() => new THREE.Vector2());

  // Refs
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rainAmbientRef = useRef<HTMLAudioElement | null>(null);
  const snowAmbientRef = useRef<HTMLAudioElement | null>(null);
  const frontGlassRef = useRef<HTMLDivElement>(null);
  const backGlassRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Persistent Savings
  useEffect(() => {
    localStorage.setItem('zen-mode', mode);
    localStorage.setItem('zen-blur', blur.toString());
    localStorage.setItem('zen-content', content);
    localStorage.setItem('zen-volume', volume.toString());
    localStorage.setItem('zen-rain-volume', rainVolume.toString());
    localStorage.setItem('zen-snow-volume', snowVolume.toString());
  }, [mode, blur, content, volume, rainVolume, snowVolume]);

  // Audio Control
  useEffect(() => {
    if (!hasStarted) return;
    
    const playAudio = async () => {
      if (audioRef.current) audioRef.current.volume = volume;
      if (rainAmbientRef.current) rainAmbientRef.current.volume = rainVolume;
      if (snowAmbientRef.current) snowAmbientRef.current.volume = snowVolume;

      try {
        if (mode === 'rain') {
          rainAmbientRef.current?.play();
          snowAmbientRef.current?.pause();
        } else {
          snowAmbientRef.current?.play();
          rainAmbientRef.current?.pause();
        }
        audioRef.current?.play();
      } catch (e) { console.log("Audio waiting for interaction"); }
    };
    playAudio();
  }, [mode, volume, rainVolume, snowVolume, hasStarted]);

  // Mouse & UI Auto-hide
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.set(e.clientX, window.innerHeight - e.clientY);
      setIsUIActive(true);
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
      uiTimeoutRef.current = setTimeout(() => setIsUIActive(false), 3000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouse]);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0) {
      setIsTimerRunning(false);
      setIsTimerFinished(true);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  // --- Handlers ---
  const handleClear = () => {
    if (!content) return;
    setIsClearing(true);
    setTimeout(() => { setContent(''); setIsClearing(false); }, 3000);
  };

  const exportToTxt = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `zen-${new Date().toLocaleDateString()}.txt`;
    a.click();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#050505] text-white selection:bg-white/20">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 1] }}>
          <Suspense fallback={null}><Background mode={mode} intensity={intensity} mouse={mouse} /></Suspense>
        </Canvas>
      </div>

      {/* Audio Sources */}
      <audio ref={audioRef} loop src={mode === 'rain' ? "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" : "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"} />
      <audio ref={rainAmbientRef} loop src="https://actions.google.com/sounds/v1/weather/rain_heavy_quiet_interior.ogg" />
      <audio ref={snowAmbientRef} loop src="https://assets.mixkit.co/active_storage/sfx/2443/2443-preview.mp3" />

      {/* Start Overlay */}
      <AnimatePresence>
        {!hasStarted && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-[#050505]"
          >
            <motion.button 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.05)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setHasStarted(true)}
              className="glass px-12 py-4 rounded-full text-sm tracking-[0.3em] uppercase border border-white/10"
            >
              Enter Flow
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Switcher */}
      <div className="absolute top-0 left-0 right-0 h-32 z-50 flex justify-center items-start pt-12 pointer-events-none">
        <motion.div 
          animate={{ opacity: isUIActive ? 1 : 0, y: isUIActive ? 0 : -20 }}
          className="glass-dark rounded-full px-6 py-3 flex items-center gap-4 border border-white/5 pointer-events-auto"
        >
          <button onClick={() => setMode('rain')} className={cn("flex items-center gap-2 transition-all", mode === 'rain' ? "text-white" : "text-white/40 hover:text-white/60")}>
            <CloudRain size={18} /> <span className="text-sm">Rainy</span>
          </button>
          <div className="w-[1px] h-4 bg-white/10" />
          <button onClick={() => setMode('snow')} className={cn("flex items-center gap-2 transition-all", mode === 'snow' ? "text-white" : "text-white/40 hover:text-white/60")}>
            <Snowflake size={18} /> <span className="text-sm">Snowy</span>
          </button>
        </motion.div>
      </div>

      {/* Left Typography Settings */}
      <div className="absolute left-0 top-0 bottom-0 w-40 z-40 flex items-center justify-center pl-8 pointer-events-none">
        <motion.div animate={{ opacity: isUIActive ? 1 : 0, x: isUIActive ? 0 : -20 }} className="flex flex-col gap-6 p-6 glass-dark rounded-[32px] pointer-events-auto">
           <div className="flex flex-col items-center gap-4">
             <Type size={20} className="opacity-40" />
             
             <div className="flex flex-col gap-1 w-full">
               <span className="text-[9px] uppercase tracking-[0.2em] opacity-20 mb-1 text-center">Font</span>
               {['serif', 'sans', 'mono', 'klee'].map(f => (
                 <button key={f} onClick={() => setFontFamily(f as FontFamily)} className={cn("py-2 px-4 rounded-xl text-[10px] uppercase tracking-widest transition-all", fontFamily === f ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}>
                   {f}
                 </button>
               ))}
             </div>
             
             <div className="w-full h-[1px] bg-white/10" />
             
             <div className="flex flex-col gap-1 w-full">
               <span className="text-[9px] uppercase tracking-[0.2em] opacity-20 mb-1 text-center">Size</span>
               <div className="flex bg-black/20 rounded-xl p-1 gap-1">
                 {(['small', 'medium', 'large'] as FontSize[]).map((s, i) => (
                   <button 
                     key={s} 
                     onClick={() => setFontSize(s)} 
                     className={cn(
                       "flex-1 py-1.5 rounded-lg text-[10px] transition-all",
                       fontSize === s ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                     )}
                   >
                     {['S', 'M', 'L'][i]}
                   </button>
                 ))}
               </div>
             </div>
           </div>
        </motion.div>
      </div>

      {/* Center Editor - The Masterpiece */}
      <main className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div className="flex flex-col items-center gap-5 w-full max-w-3xl pointer-events-none px-4">
          <div className="relative w-full h-[60vh] perspective-1000 pointer-events-auto">
            <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} className="relative w-full h-full preserve-3d">
              
              {/* Front Glass Panel */}
              <div 
                ref={frontGlassRef}
                style={{ '--glass-blur': `${blur}px` } as React.CSSProperties}
                className="absolute inset-0 backface-hidden glass rounded-2xl p-12 flex flex-col z-10"
              >
                <motion.textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  animate={isClearing ? { opacity: 0, y: -100, filter: "blur(40px) brightness(2)" } : { opacity: 1, y: 0, filter: "none" }}
                  transition={{ duration: 3.0 }}
                  placeholder="Start your flow..."
                  className={cn(
                    "w-full h-full bg-transparent border-none outline-none resize-none font-light leading-relaxed placeholder:text-white/10 overflow-y-auto custom-scrollbar",
                    fontSize === 'small' ? "text-sm" : fontSize === 'large' ? "text-2xl" : "text-lg",
                    fontFamily === 'serif' ? "font-serif" : fontFamily === 'mono' ? "font-mono" : fontFamily === 'klee' ? "font-klee" : "font-sans"
                  )}
                />
                <div className="absolute bottom-6 right-8 flex gap-3">
                   <motion.button 
                     whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
                     whileTap={{ scale: 0.95 }}
                     onClick={() => { setIsSaved(true); setTimeout(() => setIsSaved(false), 2000); }} 
                     className="p-2 glass-dark rounded-full transition-all group"
                   >
                     {isSaved ? (
                       <Check size={16} className="text-green-400" />
                     ) : (
                       <Save size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                     )}
                   </motion.button>
                   <motion.button 
                     whileHover={{ scale: 1.1, backgroundColor: "rgba(239, 68, 68, 0.2)" }}
                     whileTap={{ scale: 0.95 }}
                     onClick={handleClear} 
                     className="p-2 glass-dark rounded-full transition-all group"
                   >
                     <Trash2 size={16} className="opacity-40 group-hover:opacity-100 group-hover:text-red-400 transition-all" />
                   </motion.button>
                </div>
              </div>

              {/* Back Panel (Zen Quote) */}
              <div ref={backGlassRef} style={{ '--glass-blur': `${blur}px` } as React.CSSProperties} className="absolute inset-0 backface-hidden glass rounded-2xl p-12 flex flex-col items-center justify-center text-center rotate-y-180 z-10">
                 <h3 className="font-serif italic text-3xl opacity-80 mb-6">Deep Focus</h3>
                 <p className="font-light opacity-60">"The best way to predict the future is to create it."</p>
                 <button onClick={() => setIsFlipped(false)} className="mt-8 px-8 py-3 glass-dark rounded-full text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Return</button>
              </div>
              
            </motion.div>
          </div>

          {/* Timer - Explicitly 20px (gap-5) below editor */}
          <motion.button 
            animate={{ opacity: isUIActive ? 1 : 0, y: isUIActive ? 0 : 20 }}
            whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="px-6 py-2 glass-dark rounded-full text-xs font-mono tracking-widest flex items-center gap-3 border border-white/5 pointer-events-auto transition-colors"
          >
            {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
            <span>{Math.floor(timer/60)}:{String(timer%60).padStart(2,'0')}</span>
          </motion.button>
        </div>
      </main>

      {/* Bottom Control Deck */}
      <div className="absolute bottom-0 left-0 right-0 h-48 z-40 flex flex-col items-center justify-end pb-8 pointer-events-none">
        {/* Vibe Mixer */}
        <motion.div animate={{ opacity: isUIActive ? 1 : 0, y: isUIActive ? 0 : 20 }} className="flex gap-12 glass-dark px-10 py-4 rounded-full border border-white/5 pointer-events-auto">
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[9px] uppercase tracking-tighter opacity-40">Intensity</span>
            <input type="range" min="0" max="1" step="0.01" value={intensity} onChange={(e) => setIntensity(parseFloat(e.target.value))} className="w-24 accent-white/50" />
          </div>
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[9px] uppercase tracking-tighter opacity-40">Blur</span>
            <input 
              type="range" min="0" max="100" step="1" 
              defaultValue={blur}
              onChange={(e) => {
                // 高性能滑动：直接操作 DOM，不触发 React 渲染
                const val = e.target.value;
                frontGlassRef.current?.style.setProperty('--glass-blur', `${val}px`);
                backGlassRef.current?.style.setProperty('--glass-blur', `${val}px`);
              }}
              onMouseUp={(e: any) => setBlur(Number(e.target.value))}
              className="w-24 accent-white/50" 
            />
          </div>
          <div 
            className="relative"
            onMouseEnter={() => setIsAudioSettingsOpen(true)}
            onMouseLeave={() => setIsAudioSettingsOpen(false)}
          >
            <button className={cn("p-2 rounded-full transition-all", isAudioSettingsOpen ? "bg-white/20" : "hover:bg-white/10")}>
              <Volume2 size={18} />
            </button>

            <AnimatePresence>
              {isAudioSettingsOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                  animate={{ opacity: 1, y: -10, scale: 1 }} 
                  exit={{ opacity: 0, y: 10, scale: 0.95 }} 
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 glass-dark p-6 rounded-[32px] flex flex-col gap-4 z-50 min-w-[180px] border border-white/5"
                >
                   <div className="flex flex-col gap-1">
                     <span className="text-[9px] uppercase opacity-40">Music</span>
                     <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full accent-white/50" />
                   </div>
                   <div className="flex flex-col gap-1">
                     <span className="text-[9px] uppercase opacity-40">Ambient</span>
                     <input type="range" min="0" max="1" step="0.01" value={mode === 'rain' ? rainVolume : snowVolume} onChange={(e) => mode === 'rain' ? setRainVolume(parseFloat(e.target.value)) : setSnowVolume(parseFloat(e.target.value))} className="w-full accent-white/50" />
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={exportToTxt} className="p-2 hover:bg-white/10 rounded-full transition-all"><Download size={16} className="opacity-60" /></button>
        </motion.div>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}