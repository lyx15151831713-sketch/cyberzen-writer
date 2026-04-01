/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CloudRain, 
  Snowflake, 
  Settings, 
  Download, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2,
  Type,
  ChevronDown,
  RotateCcw,
  Play,
  Pause,
  Save,
  Trash2,
  Check
} from 'lucide-react';
import { cn } from './lib/utils';
import { RainShader, SnowShader } from './components/BackgroundShader';

// --- Types ---
type Mode = 'rain' | 'snow';
type FontSize = 'small' | 'medium' | 'large';
type FontFamily = 'serif' | 'sans' | 'mono' | 'klee';

// --- Components ---

import { useTexture } from '@react-three/drei';

const Background = ({ mode, intensity, mouse }: { mode: Mode; intensity: number; mouse: THREE.Vector2 }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, viewport } = useThree();
  const lerpedMouse = useRef(new THREE.Vector2());
  
  // Load background textures
  const rainTexture = useTexture('https://images.unsplash.com/photo-1428592953211-077101b2021b?auto=format&fit=crop&w=1920&q=80');
  const snowTexture = useTexture('https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1920&q=80');
  
  useEffect(() => {
    if (rainTexture) {
      rainTexture.wrapS = THREE.RepeatWrapping;
      rainTexture.wrapT = THREE.RepeatWrapping;
    }
    if (snowTexture) {
      snowTexture.wrapS = THREE.RepeatWrapping;
      snowTexture.wrapT = THREE.RepeatWrapping;
    }
  }, [rainTexture, snowTexture]);
  
  const shader = useMemo(() => {
    const s = mode === 'rain' ? { ...RainShader } : { ...SnowShader };
    if (s.uniforms.iResolution) s.uniforms.iResolution.value.set(size.width, size.height);
    
    if (s.uniforms.iChannel0) {
      s.uniforms.iChannel0.value = mode === 'rain' ? rainTexture : snowTexture;
    }
    return s;
  }, [mode, size, rainTexture, snowTexture]);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      const time = state.clock.getElapsedTime();
      
      // Update standard uniforms
      if (material.uniforms.uTime) material.uniforms.uTime.value = time;
      if (material.uniforms.iTime) material.uniforms.iTime.value = time;
      if (material.uniforms.uIntensity) material.uniforms.uIntensity.value = intensity;
      
      // Smooth mouse movement (lerp) for a more natural, soothing feel
      lerpedMouse.current.lerp(mouse, 0.05);
      if (material.uniforms.iMouse) material.uniforms.iMouse.value.copy(lerpedMouse.current);
    }
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        key={mode}
        vertexShader={shader.vertexShader}
        fragmentShader={shader.fragmentShader}
        uniforms={shader.uniforms}
      />
    </mesh>
  );
};

export default function App() {
  // --- State ---
  const [mode, setMode] = useState<Mode>('rain');
  const [content, setContent] = useState(() => localStorage.getItem('zen-content') || '');
  const [intensity, setIntensity] = useState(0.5);
  const [blur, setBlur] = useState(20);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('zen-volume')) || 0);
  const [rainVolume, setRainVolume] = useState(() => {
    const saved = localStorage.getItem('zen-rain-volume');
    return saved !== null ? Number(saved) : 0.5;
  });
  const [snowVolume, setSnowVolume] = useState(() => {
    const saved = localStorage.getItem('zen-snow-volume');
    return saved !== null ? Number(saved) : 0.2;
  });
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [fontFamily, setFontFamily] = useState<FontFamily>('sans');
  const [isUIActive, setIsUIActive] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [timer, setTimer] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerFinished, setIsTimerFinished] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [mouse] = useState(() => new THREE.Vector2());

  // Local hover states for specific regions
  const [hoverTop, setHoverTop] = useState(false);
  const [hoverLeft, setHoverLeft] = useState(false);
  const [hoverBottom, setHoverBottom] = useState(false);
  
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rainAmbientRef = useRef<HTMLAudioElement | null>(null);
  const snowAmbientRef = useRef<HTMLAudioElement | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Effects ---

  // Mouse tracking for shader interaction
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.set(e.clientX, window.innerHeight - e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouse]);

  // Auto-save content
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('zen-content', content);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [content]);

  // Save volume settings
  useEffect(() => {
    localStorage.setItem('zen-volume', volume.toString());
    localStorage.setItem('zen-rain-volume', rainVolume.toString());
    localStorage.setItem('zen-snow-volume', snowVolume.toString());
  }, [volume, rainVolume, snowVolume]);

  // Global UI Fade-out logic (still useful for general inactivity)
  useEffect(() => {
    const handleActivity = () => {
      setIsUIActive(true);
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
      uiTimeoutRef.current = setTimeout(() => {
        setIsUIActive(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    handleActivity();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsTimerRunning(false);
      setIsTimerFinished(true);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  // Audio logic
  useEffect(() => {
    const updateAudio = async () => {
      // Background Music
      if (audioRef.current) {
        audioRef.current.volume = volume;
        try {
          // Only play if not already playing or src changed
          if (audioRef.current.paused) {
            await audioRef.current.play();
          }
        } catch (err) {
          console.log("Music play blocked by browser.");
        }
      }

      // Ambient Sounds
      const rain = rainAmbientRef.current;
      const snow = snowAmbientRef.current;

      if (rain && snow) {
        rain.volume = rainVolume;
        snow.volume = snowVolume;

        if (mode === 'rain') {
          try {
            if (rain.paused) await rain.play();
            snow.pause();
          } catch (err) {
            console.log("Rain ambient blocked.");
          }
        } else {
          try {
            if (snow.paused) await snow.play();
            rain.pause();
          } catch (err) {
            console.log("Snow ambient blocked.");
          }
        }
      }
    };

    updateAudio();
  }, [volume, rainVolume, snowVolume, mode]);

  // Ensure audio plays on first interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (audioRef.current) audioRef.current.play().catch(() => {});
      if (rainAmbientRef.current && mode === 'rain') rainAmbientRef.current.play().catch(() => {});
      if (snowAmbientRef.current && mode === 'snow') snowAmbientRef.current.play().catch(() => {});
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [mode]);

  // --- Handlers ---

  const handleSave = () => {
    localStorage.setItem('zen-content', content);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClear = () => {
    if (content.trim() === '') return;
    setIsClearing(true);
    // Wait for smoke animation to finish (slowed down to 3s)
    setTimeout(() => {
      setContent('');
      setIsClearing(false);
    }, 3000);
  };

  const exportToTxt = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zen-writing-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTimerClick = () => {
    if (isTimerFinished) {
      setIsFlipped(!isFlipped);
    } else {
      setIsTimerRunning(!isTimerRunning);
    }
  };

  const handleTimerMouseDown = () => {
    longPressTimerRef.current = setTimeout(() => {
      setTimer(25 * 60);
      setIsTimerRunning(false);
      setIsTimerFinished(false);
      setIsFlipped(false);
    }, 2000);
  };

  const handleTimerMouseUp = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- Render ---

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#050505] text-white selection:bg-white/20">
      {/* WebGL Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 1] }}>
          <Suspense fallback={null}>
            <Background mode={mode} intensity={intensity} mouse={mouse} />
          </Suspense>
        </Canvas>
      </div>

      {/* Audio Elements */}
      <audio 
        ref={audioRef}
        loop
        src={mode === 'rain' 
          ? "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" 
          : "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" 
        }
      />
      <audio 
        ref={rainAmbientRef}
        loop
        src="https://actions.google.com/sounds/v1/weather/rain_heavy_quiet_interior.ogg" 
      />
      <audio 
        ref={snowAmbientRef}
        loop
        src="https://assets.mixkit.co/active_storage/sfx/2443/2443-preview.mp3" 
      />

      {/* Top Switcher Area */}
      <div 
        onMouseEnter={() => setHoverTop(true)}
        onMouseLeave={() => setHoverTop(false)}
        className="absolute top-0 left-0 right-0 h-[100px] z-50 flex justify-center items-start pt-[44px]"
      >
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ 
            opacity: (hoverTop && isUIActive) ? 1 : 0, 
            y: (hoverTop && isUIActive) ? 0 : -10 
          }}
          className="glass-dark rounded-full px-6 py-3 flex items-center gap-4 border border-white/5"
        >
          <button 
            onClick={() => setMode('rain')}
            className={cn(
              "flex items-center gap-2 transition-all duration-300",
              mode === 'rain' ? "text-white" : "text-white/40 hover:text-white/60"
            )}
          >
            <CloudRain size={18} />
            <span className="text-sm font-medium">Rainy</span>
          </button>
          
          <div className="w-[1px] h-4 bg-white/10" />
          
          <button 
            onClick={() => setMode('snow')}
            className={cn(
              "flex items-center gap-2 transition-all duration-300",
              mode === 'snow' ? "text-white" : "text-white/40 hover:text-white/60"
            )}
          >
            <Snowflake size={18} />
            <span className="text-sm font-medium">Snowy</span>
          </button>
        </motion.div>
      </div>

      {/* Left Settings Area */}
      <div 
        onMouseEnter={() => setHoverLeft(true)}
        onMouseLeave={() => setHoverLeft(false)}
        className="absolute left-0 top-[50px] bottom-0 w-[160px] z-40 flex items-center justify-center pl-8"
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ 
            opacity: (hoverLeft && isUIActive) ? 1 : 0, 
            x: (hoverLeft && isUIActive) ? 0 : -20 
          }}
          className="flex flex-col gap-4 p-6 glass-dark rounded-[32px] border border-white/5 min-w-[120px]"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center mb-2">
              <Type size={20} className="opacity-80" />
            </div>
            
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] uppercase tracking-widest opacity-30 mb-2 text-center">字体</span>
              <button 
                onClick={() => setFontFamily('serif')}
                className={cn(
                  "py-2 px-4 rounded-xl text-sm transition-all text-center",
                  fontFamily === 'serif' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                Serif
              </button>
              <button 
                onClick={() => setFontFamily('sans')}
                className={cn(
                  "py-2 px-4 rounded-xl text-sm transition-all text-center",
                  fontFamily === 'sans' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                Sans
              </button>
              <button 
                onClick={() => setFontFamily('mono')}
                className={cn(
                  "py-2 px-4 rounded-xl text-sm transition-all text-center",
                  fontFamily === 'mono' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                Mono
              </button>
              <button 
                onClick={() => setFontFamily('klee')}
                className={cn(
                  "py-2 px-4 rounded-xl text-sm transition-all text-center",
                  fontFamily === 'klee' ? "bg-white/10 text-white font-klee" : "text-white/40 hover:text-white/60 font-klee"
                )}
              >
                Klee
              </button>
            </div>

            <div className="w-full h-[1px] bg-white/10 my-2" />

            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] uppercase tracking-widest opacity-30 mb-2 text-center">字号</span>
              <div className="flex bg-black/20 rounded-xl p-1 gap-1">
                <button 
                  onClick={() => setFontSize('small')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs transition-all",
                    fontSize === 'small' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                >
                  小
                </button>
                <button 
                  onClick={() => setFontSize('medium')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs transition-all",
                    fontSize === 'medium' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                >
                  中
                </button>
                <button 
                  onClick={() => setFontSize('large')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs transition-all",
                    fontSize === 'large' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                >
                  大
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Deck (Editor) */}
      <main className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div className="relative w-full max-w-3xl h-[60vh] perspective-1000 pointer-events-auto">
          <motion.div
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="relative w-full h-full preserve-3d"
          >
            {/* Front: Editor */}
            <div 
              className="absolute inset-0 backface-hidden glass rounded-2xl p-12 flex flex-col"
              style={{ '--glass-blur': `${blur}px` } as React.CSSProperties}
            >
              <motion.textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start your flow..."
                animate={isClearing ? {
                  opacity: 0,
                  y: -200,
                  x: [0, 20, -20, 10, 0],
                  filter: "blur(80px) brightness(3) contrast(0.5)",
                  scale: 1.5,
                  skewX: [0, 15, -15, 5, 0],
                } : {
                  opacity: 1,
                  y: 0,
                  x: 0,
                  filter: "blur(0px) brightness(1) contrast(1)",
                  scale: 1,
                  skewX: 0,
                }}
                transition={{ 
                  duration: 3.0, 
                  ease: "easeOut",
                  x: { duration: 3.0, ease: "linear" },
                  skewX: { duration: 3.0, ease: "linear" }
                }}
                className={cn(
                  "w-full h-full bg-transparent border-none outline-none resize-none font-light leading-relaxed placeholder:text-white/10 overflow-y-auto custom-scrollbar",
                  fontSize === 'small' && "text-sm",
                  fontSize === 'medium' && "text-lg",
                  fontSize === 'large' && "text-2xl",
                  fontFamily === 'serif' && "font-serif",
                  fontFamily === 'sans' && "font-sans",
                  fontFamily === 'mono' && "font-mono",
                  fontFamily === 'klee' && "font-klee"
                )}
              />

              {/* Editor Actions */}
              <div className="absolute bottom-6 right-8 flex items-center gap-3">
                <button 
                  onClick={handleSave}
                  className="p-2 glass-dark rounded-full hover:bg-white/10 transition-all group relative"
                >
                  {isSaved ? <Check size={16} className="text-green-400" /> : <Save size={16} className="opacity-40 group-hover:opacity-80" />}
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {isSaved ? 'Saved' : 'Save'}
                  </span>
                </button>
                <button 
                  onClick={handleClear}
                  className="p-2 glass-dark rounded-full hover:bg-red-500/20 transition-all group relative"
                >
                  <Trash2 size={16} className="opacity-40 group-hover:opacity-80 group-hover:text-red-400" />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Clear
                  </span>
                </button>
              </div>
            </div>

            {/* Back: Flashcard */}
            <div 
              className="absolute inset-0 backface-hidden glass rounded-2xl p-12 flex flex-col items-center justify-center text-center rotate-y-180"
              style={{ '--glass-blur': `${blur}px` } as React.CSSProperties}
            >
              <div className="space-y-6">
                <h3 className="font-serif italic text-3xl text-white/80">Flow Insight</h3>
                <p className="text-lg font-light text-white/60 max-w-md">
                  "The best way to predict the future is to create it." 
                  <br />
                  <span className="text-sm mt-4 block opacity-40">— Peter Drucker</span>
                </p>
                <button 
                  onClick={() => setIsFlipped(false)}
                  className="mt-8 px-8 py-3 glass-dark rounded-full text-xs uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                  Return to Flow
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Bottom Area */}
      <div 
        onMouseEnter={() => setHoverBottom(true)}
        onMouseLeave={() => setHoverBottom(false)}
        className="absolute bottom-0 left-0 right-0 h-[200px] z-40 flex flex-col items-center justify-end pb-8"
      >
        {/* Zen Timer - Moved above Vibe Mixer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ 
            opacity: (isTimerFinished || (hoverBottom && isUIActive)) ? 1 : 0, 
            y: (isTimerFinished || (hoverBottom && isUIActive)) ? 0 : 10 
          }}
          className="mb-4"
        >
          <motion.button
            onClick={handleTimerClick}
            onMouseDown={handleTimerMouseDown}
            onMouseUp={handleTimerMouseUp}
            onMouseLeave={handleTimerMouseUp}
            whileHover="hover"
            initial="initial"
            variants={{
              initial: { scale: 1 },
              hover: { 
                scale: 1.05, 
                backgroundColor: "rgba(255,255,255,0.12)",
                borderColor: "rgba(255,255,255,0.3)",
                boxShadow: "0 0 25px rgba(255,255,255,0.15)"
              }
            }}
            whileTap={{ scale: 0.95 }}
            animate={isTimerFinished ? {
              scale: [1, 1.1, 1],
              backgroundColor: [
                "rgba(255,255,255,0.05)",
                "rgba(255,255,255,0.15)",
                "rgba(255,255,255,0.05)"
              ],
              boxShadow: [
                "0 0 0px rgba(255,255,255,0)",
                "0 0 30px rgba(255,255,255,0.3)",
                "0 0 0px rgba(255,255,255,0)"
              ]
            } : {}}
            transition={isTimerFinished ? {
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            } : {
              type: "spring",
              stiffness: 400,
              damping: 17
            }}
            className={cn(
              "relative px-6 py-2 rounded-full glass-dark text-[13px] font-mono tracking-widest flex items-center gap-3 transition-all duration-300 border border-white/5 cursor-pointer overflow-hidden group",
              isTimerFinished ? "border-white/60 text-white" : "border-white/10 text-white/80"
            )}
          >
            {/* Shimmer effect on hover */}
            <motion.div
              variants={{
                initial: { x: "-100%" },
                hover: { x: "100%" }
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"
            />

            {isTimerFinished ? (
              <span className="flex items-center gap-2 relative z-10">
                <motion.div 
                  variants={{ hover: { rotate: 180 } }}
                  transition={{ duration: 0.5, ease: "backOut" }}
                >
                  <RotateCcw size={12} />
                </motion.div>
                Time to Rest
              </span>
            ) : (
              <div className="flex items-center gap-3 relative z-10">
                <motion.div 
                  variants={{ 
                    hover: { scale: 1.2, color: "#fff" } 
                  }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
                </motion.div>
                <span className="tabular-nums">{formatTime(timer)}</span>
              </div>
            )}
          </motion.button>
        </motion.div>

        {/* Vibe Mixer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ 
            opacity: (hoverBottom && isUIActive) ? 1 : 0, 
            y: (hoverBottom && isUIActive) ? 0 : 10 
          }}
          className="flex gap-12 glass-dark px-10 py-4 rounded-full items-center border border-white/5 relative"
        >
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[9px] uppercase tracking-tighter opacity-40">Intensity</span>
            <input 
              type="range" min="0" max="1" step="0.01" 
              value={intensity} onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-24 accent-white/50"
            />
          </div>
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[9px] uppercase tracking-tighter opacity-40">Blur</span>
            <input 
              type="range" min="0" max="50" step="1" 
              value={blur} onChange={(e) => setBlur(parseInt(e.target.value))}
              className="w-24 accent-white/50"
            />
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsAudioSettingsOpen(!isAudioSettingsOpen)}
              className={cn(
                "p-2 rounded-full transition-all duration-300",
                isAudioSettingsOpen ? "bg-white/20 text-white" : "hover:bg-white/10 text-white/60"
              )}
            >
              <Volume2 size={18} />
            </button>

            <AnimatePresence>
              {isAudioSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: -10, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 glass-dark p-6 rounded-[24px] border border-white/10 flex flex-col gap-6 min-w-[180px]"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-widest opacity-40">Music</span>
                      <span className="text-[10px] font-mono opacity-40">{Math.round(volume * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.01" 
                      value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-full accent-white/50"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-widest opacity-40">Rain Ambient</span>
                      <span className="text-[10px] font-mono opacity-40">{Math.round(rainVolume * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.01" 
                      value={rainVolume} onChange={(e) => setRainVolume(parseFloat(e.target.value))}
                      className="w-full accent-white/50"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-widest opacity-40">Snow Ambient</span>
                      <span className="text-[10px] font-mono opacity-40">{Math.round(snowVolume * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.01" 
                      value={snowVolume} onChange={(e) => setSnowVolume(parseFloat(e.target.value))}
                      className="w-full accent-white/50"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={exportToTxt} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Download size={16} className="opacity-60" />
          </button>
        </motion.div>
      </div>

      {/* Global Styles for 3D */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
