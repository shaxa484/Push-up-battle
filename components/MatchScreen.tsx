"use client";
import { useState, useEffect, useRef } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

// 1. Define strict interfaces instead of using 'any'
interface User {
  name: string;
  elo: number;
}

interface MatchScreenProps {
  user: User;
  duration: number;
  onMatchEnd: (playerAReps: number, playerBReps: number) => void;
  onExit: () => void;
}

export default function MatchScreen({ user, duration, onMatchEnd, onExit }: MatchScreenProps) {
  // App Phases: loading -> calibrating -> countdown -> playing
  const [phase, setPhase] = useState<"loading" | "calibrating" | "countdown" | "playing">("loading");
  const [countdown, setCountdown] = useState<number>(3);
  const [timeLeft, setTimeLeft] = useState<number>(duration);
  
  const [playerAReps, setPlayerAReps] = useState<number>(0);
  const [playerBReps, setPlayerBReps] = useState<number>(0);
  const [badForm, setBadForm] = useState<boolean>(false);

  // Refs for MediaPipe and Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  
  // --- ANTI-CHEAT REFS ---
  const isDownRef = useRef<boolean>(false);
  const baselineYDistanceRef = useRef<number>(0);
  const baselineHipYRef = useRef<number>(0);
  const baselineKneeYRef = useRef<number>(0);
  const calibrationStartTimeRef = useRef<number>(0);

  // 1. Initialize MediaPipe Pose Landmarker
  useEffect(() => {
    async function setupLandmarker() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1
      });
      landmarkerRef.current = landmarker;
      
      if (navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            videoRef.current?.play();
            setPhase("calibrating");
          };
        }
      }
    }
    setupLandmarker();
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 2. Calibration Timer (2 Seconds)
  useEffect(() => {
    if (phase === "calibrating") {
      calibrationStartTimeRef.current = performance.now();
      const timer = setTimeout(() => {
        setPhase("countdown");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // 3. The AI Detection & Anti-Cheat Loop
  useEffect(() => {
    if (phase !== "calibrating" && phase !== "playing" && phase !== "countdown") return;
    
    const detectPose = () => {
      if (!landmarkerRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(detectPose);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // 2. Fix: Canvas null check
      if (!canvas) {
        rafRef.current = requestAnimationFrame(detectPose);
        return;
      }
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(detectPose);
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const results = landmarkerRef.current.detectForVideo(video, performance.now());
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawingUtils = new DrawingUtils(ctx);
      
      if (results.landmarks.length > 0) {
        const lm = results.landmarks[0];
        
        // Draw skeleton
        drawingUtils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: "#4ADE80", lineWidth: 4 });
        drawingUtils.drawLandmarks(lm, { color: "#22C55E", radius: 4 });

        // --- CORE CALCULATIONS ---
        const vis = (idx: number) => lm[idx].visibility !== undefined && lm[idx].visibility > 0.5;
        if (vis(11) && vis(12) && vis(15) && vis(16) && vis(23) && vis(24) && vis(25) && vis(26)) {
          
          const avg_shoulder_y = (lm[11].y + lm[12].y) / 2;
          const avg_wrist_y = (lm[15].y + lm[16].y) / 2;
          const avg_hip_y = (lm[23].y + lm[24].y) / 2;
          const avg_knee_y = (lm[25].y + lm[26].y) / 2;

          const current_y_distance = avg_wrist_y - avg_shoulder_y;

          // --- PHASE 1: CALIBRATION ---
          if (phase === "calibrating") {
            baselineYDistanceRef.current = current_y_distance;
            baselineHipYRef.current = avg_hip_y;
            baselineKneeYRef.current = avg_knee_y;
          } 
          // --- PHASE 2: PLAYING STATE MACHINE ---
          else if (phase === "playing") {
            const baseline_y_distance = baselineYDistanceRef.current;
            
            if (baseline_y_distance > 0) {
              const down_threshold = baseline_y_distance * 0.50;
              const up_threshold = baseline_y_distance * 0.85;
              const anti_cheat_buffer = baseline_y_distance * 0.15;

              // GOING DOWN
              if (current_y_distance < down_threshold && !isDownRef.current) {
                isDownRef.current = true;
              } 
              // COMING UP
              else if (current_y_distance > up_threshold && isDownRef.current) {
                
                const isSagging = avg_hip_y > (baselineHipYRef.current + anti_cheat_buffer);
                const isKneesDropped = avg_knee_y > (baselineKneeYRef.current + anti_cheat_buffer);

                if (isSagging || isKneesDropped) {
                  isDownRef.current = false;
                  setBadForm(true);
                  setTimeout(() => setBadForm(false), 2000);
                } else {
                  isDownRef.current = false;
                  setPlayerAReps((prev: number) => prev + 1);
                }
              }
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(detectPose);
    };

    rafRef.current = requestAnimationFrame(detectPose);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  // 4. Mock Opponent Logic
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setPlayerBReps((prev: number) => prev + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, [phase]);

  // 5. Countdown & Timer Logic
  useEffect(() => {
    if (phase === "countdown") {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown((c: number) => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setPhase("playing");
      }
    }
  }, [countdown, phase]);

  useEffect(() => {
    if (phase === "playing" && timeLeft > 0) {
      // 3. Fix: explicitly type 't' as number
      const timer = setInterval(() => setTimeLeft((t: number) => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && phase === "playing") {
      onMatchEnd(playerAReps, playerBReps);
    }
  }, [phase, timeLeft, playerAReps, playerBReps, onMatchEnd]);

  // Tug of War Math
  const totalReps = playerAReps + playerBReps;
  const growA = totalReps === 0 ? 1 : playerAReps;
  const growB = totalReps === 0 ? 1 : playerBReps;
  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2, '0')}`;

  return (
    <div className="h-screen w-screen flex flex-col bg-background relative overflow-hidden">
      
      {/* Top Navbar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex justify-between items-center p-4 bg-gradient-to-b from-background to-transparent">
        <button onClick={onExit} className="text-slate-400 hover:text-white text-sm font-bold border border-slate-700 px-3 py-1 rounded">
          EXIT
        </button>
        <div className="text-center">
          <div className="text-xs uppercase text-slate-400 tracking-widest font-bold">Time Remaining</div>
          <div className="text-4xl font-display font-extrabold text-white tabular-nums">
            {formatTime(timeLeft)}
          </div>
        </div>
        <div className="w-[60px]"></div>
      </div>

      {/* Bad Form Warning */}
      {badForm && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white font-bold px-6 py-3 rounded-lg shadow-lg animate-pulse">
          BAD FORM! KEEP HIPS & KNEES UP
        </div>
      )}

      {/* Tug of War Container */}
      <div className="flex flex-col h-full w-full">
        
        {/* Player B (Opponent - Green - Top) */}
        <div 
          className="relative bg-green-primary/20 border-b-4 border-green-primary flex items-center justify-center transition-all duration-500 ease-out"
          style={{ flexGrow: growB, flexBasis: 0 }}
        >
          <div className="text-center z-10">
            <div className="text-green-light text-xl font-bold mb-2">OPPONENT</div>
            <div className="text-green-light text-8xl font-display font-extrabold drop-shadow-lg">
              {playerBReps}
            </div>
          </div>
        </div>

        {/* Player A (User - Blue - Bottom) */}
        <div 
          className="relative bg-blue-primary/10 border-t-4 border-blue-primary flex items-center justify-center transition-all duration-500 ease-out overflow-hidden"
          style={{ flexGrow: growA, flexBasis: 0 }}
        >
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-40" playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

          <div className="text-center z-10 mt-10 pointer-events-none">
            <div className="text-blue-light text-8xl font-display font-extrabold drop-shadow-lg">
              {playerAReps}
            </div>
            <div className="text-blue-light text-xl font-bold mt-2">{user.name.toUpperCase()}</div>
          </div>
        </div>
      </div>

      {/* Loading / Calibrating / Countdown Overlays */}
      {phase !== "playing" && (
        <div className="absolute inset-0 bg-background/90 z-40 flex flex-col items-center justify-center backdrop-blur-sm">
          {phase === "loading" && (
            <div className="text-3xl font-display font-bold text-slate-400 animate-pulse">
              INITIALIZING AI TRACKER...
            </div>
          )}
          
          {phase === "calibrating" && (
            <div className="text-center">
              <h2 className="text-2xl text-blue-light font-bold mb-4 uppercase tracking-widest animate-pulse">
                CALIBRATING BASELINE
              </h2>
              <p className="text-slate-300 text-lg">Hold a strict UP plank position</p>
              <div className="mt-4 w-64 h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-blue-primary animate-[progress_2s_linear_infinite]" style={{animationName: 'progress'}}></div>
              </div>
            </div>
          )}
          
          {phase === "countdown" && (
            <>
              <h2 className="text-2xl text-slate-400 font-bold mb-4 uppercase tracking-widest">Get Ready</h2>
              <div className="text-9xl font-display font-extrabold text-green-light animate-ping-once">
                {countdown === 0 ? "GO!" : countdown}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}