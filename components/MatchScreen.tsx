"use client";
import { useState, useEffect, useRef } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { socket } from "@/lib/socket";

interface User {
  name: string;
  elo: number;
}

export interface MatchData {
  matchId: string;
  opponentName: string;
  opponentElo: number;
  duration: number;
  startTime: number;
}

interface MatchScreenProps {
  user: User;
  duration: number;
  matchData: MatchData;
  onMatchEnd: () => void;
  onExit: () => void;
}

export default function MatchScreen({ user, duration, matchData, onMatchEnd, onExit }: MatchScreenProps) {
  const [phase, setPhase] = useState<"loading" | "calibrating" | "waiting" | "countdown" | "playing" | "ended">("loading");
  const [countdown, setCountdown] = useState<number>(3);
  const [timeLeft, setTimeLeft] = useState<number>(duration);
  
  const [playerAReps, setPlayerAReps] = useState<number>(0);
  const [playerBReps, setPlayerBReps] = useState<number>(0);
  const [badForm, setBadForm] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>("Waiting for AI...");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const isDownRef = useRef<boolean>(false);
  const baselineYDistanceRef = useRef<number>(0);
  const baselineHipYRef = useRef<number>(0);
  const baselineKneeYRef = useRef<number>(0);

  // 1. Initialize MediaPipe
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
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
          streamRef.current = stream; 
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadeddata = () => {
              videoRef.current?.play();
              setPhase("calibrating");
              
              // Tell the server your camera is on!
              if (matchData?.matchId) {
                socket.emit("player_ready", matchData.matchId);
              }
            };
          }
        } catch (err) {
          console.error("Camera access denied or failed", err);
          alert("Camera access is required to play. Please allow camera permissions and try again.");
          if (matchData?.matchId) {
            socket.emit("leave_match", matchData.matchId);
          }
          onExit();
        }
      }
    }
    setupLandmarker();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [matchData, onExit]);

  // 2. Calibration Timer (Runs for 2 seconds, then waits for server)
  useEffect(() => {
    if (phase === "calibrating") {
      const timer = setTimeout(() => setPhase("waiting"), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // 3. Real-time Multiplayer Listeners
  useEffect(() => {
    const handleOpponentRep = (reps: number) => setPlayerBReps(reps);
    socket.on("opponent_rep_update", handleOpponentRep);

    // Listen for server synced countdown
    socket.on("start_countdown", () => {
      setPhase("countdown");
    });

    // Listen for the server's command to actually start playing!
    socket.on("start_match", () => {
      setPhase("playing");
    });

    return () => {
      socket.off("opponent_rep_update", handleOpponentRep);
      socket.off("start_countdown");
      socket.off("start_match");
    };
  }, []);

  // 4. Local Countdown Math (3, 2, 1, GO!)
  useEffect(() => {
    if (phase === "countdown") {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown((c: number) => c - 1), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [countdown, phase]);

  // 5. Match Timer
  useEffect(() => {
    if (phase === "playing" && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t: number) => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && phase === "playing") {
      setPhase("ended");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      const failsafe = setTimeout(() => onExit(), 5000);
      return () => clearTimeout(failsafe);
    }
  }, [phase, timeLeft, onExit]);

  // 6. AI Detection & Anti-Cheat Loop
  useEffect(() => {
    if (phase !== "calibrating" && phase !== "playing") return;
    
    const detectPose = () => {
      if (!landmarkerRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(detectPose);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!canvas) {
        rafRef.current = requestAnimationFrame(detectPose);
        return;
      }
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(detectPose);
        return;
      }
      
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      const results = landmarkerRef.current.detectForVideo(video, performance.now());
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawingUtils = new DrawingUtils(ctx);
      
      if (results.landmarks.length > 0) {
        const lm = results.landmarks[0];
        
        const bodyConnections = PoseLandmarker.POSE_CONNECTIONS.filter(
          (connection: { start: number; end: number }) => connection.start >= 11 && connection.end >= 11
        );
        drawingUtils.drawConnectors(lm, bodyConnections, { color: "#4ADE80", lineWidth: 6 });
        const bodyLandmarks = lm.slice(11);
        drawingUtils.drawLandmarks(bodyLandmarks, { color: "#22C55E", radius: 5 });

        const vis = (idx: number) => lm[idx] && lm[idx].visibility !== undefined && lm[idx].visibility > 0.3;
        
        if (vis(11) && vis(12) && vis(15) && vis(16)) {
          const avg_shoulder_y = (lm[11].y + lm[12].y) / 2;
          const avg_wrist_y = (lm[15].y + lm[16].y) / 2;
          const avg_hip_y = lm[23] && lm[24] ? (lm[23].y + lm[24].y) / 2 : 0;
          const avg_knee_y = lm[25] && lm[26] ? (lm[25].y + lm[26].y) / 2 : 0;

          const current_y_distance = Math.abs(avg_wrist_y - avg_shoulder_y);

          if (phase === "calibrating") {
            baselineYDistanceRef.current = current_y_distance;
            baselineHipYRef.current = avg_hip_y;
            baselineKneeYRef.current = avg_knee_y;
          } else if (phase === "playing") {
            const baseline_y_distance = baselineYDistanceRef.current;
            
            if (baseline_y_distance > 0.01) {
              const down_threshold = baseline_y_distance * 0.50;
              const up_threshold = baseline_y_distance * 0.85;
              const anti_cheat_buffer = baseline_y_distance * 0.15;

              setDebugInfo(`Dist: ${current_y_distance.toFixed(2)} | Down: ${down_threshold.toFixed(2)} | Up: ${up_threshold.toFixed(2)} | State: ${isDownRef.current}`);

              if (current_y_distance < down_threshold && !isDownRef.current) {
                isDownRef.current = true;
              } else if (current_y_distance > up_threshold && isDownRef.current) {
                const isSagging = lm[23] && lm[24] && avg_hip_y > (baselineHipYRef.current + anti_cheat_buffer);
                const isKneesDropped = lm[25] && lm[26] && avg_knee_y > (baselineKneeYRef.current + anti_cheat_buffer);

                if (isSagging || isKneesDropped) {
                  isDownRef.current = false;
                  setBadForm(true);
                  setTimeout(() => setBadForm(false), 2000);
                } else {
                  isDownRef.current = false;
                  setPlayerAReps((prev: number) => {
                    const newReps = prev + 1;
                    socket.emit("rep_update", matchData.matchId, newReps);
                    return newReps;
                  });
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
  }, [phase, matchData]);

  const handleExit = () => {
    if (matchData?.matchId) {
      socket.emit("leave_match", matchData.matchId);
    }
    onExit();
  };

  const totalReps = playerAReps + playerBReps;
  const growA = totalReps === 0 ? 1 : playerAReps;
  const growB = totalReps === 0 ? 1 : playerBReps;
  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2, '0')}`;

  return (
    <div className="h-screen w-screen flex flex-col bg-background relative overflow-hidden">
      
      {/* Top Navbar */}
      <div className="flex-shrink-0 flex justify-between items-center p-4 z-30 bg-background border-b border-slate-800">
        <button onClick={handleExit} className="text-slate-400 hover:text-white text-sm font-bold border border-slate-700 px-3 py-1 rounded">
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

      {/* TUG OF WAR BAR */}
      <div className="flex-shrink-0 flex h-32 md:h-40 w-full border-b-4 border-slate-900 shadow-2xl z-20">
        <div 
          className="relative bg-green-primary/30 border-r-4 border-green-primary flex flex-col items-center justify-center transition-all duration-500 ease-out overflow-hidden"
          style={{ flexGrow: growB, flexBasis: 0 }}
        >
          <div className="text-green-light text-sm md:text-lg font-bold uppercase tracking-wider">Opponent</div>
          <div className="text-green-light text-5xl md:text-7xl font-display font-extrabold drop-shadow-lg">
            {playerBReps}
          </div>
        </div>

        <div 
          className="relative bg-blue-primary/30 border-l-4 border-blue-primary flex flex-col items-center justify-center transition-all duration-500 ease-out overflow-hidden"
          style={{ flexGrow: growA, flexBasis: 0 }}
        >
          <div className="text-blue-light text-sm md:text-lg font-bold uppercase tracking-wider">{user.name}</div>
          <div className="text-blue-light text-5xl md:text-7xl font-display font-extrabold drop-shadow-lg">
            {playerAReps}
          </div>
        </div>
      </div>

      {/* AI DEBUG HUD */}
      <div className="absolute top-20 left-4 z-40 bg-black/70 text-green-light font-mono text-xs px-3 py-2 rounded-lg border border-slate-700 pointer-events-none">
        {debugInfo}
      </div>

      {/* Bad Form Warning */}
      {badForm && (
        <div className="absolute top-48 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white font-bold px-6 py-3 rounded-lg shadow-lg animate-pulse text-lg">
          BAD FORM! KEEP HIPS & KNEES UP
        </div>
      )}

      {/* FIXED CAMERA CONTAINER */}
      <div className="flex-grow relative bg-black flex items-center justify-center overflow-hidden">
        <video 
          ref={videoRef} 
          className="absolute h-full w-full object-cover" 
          style={{ transform: 'scaleX(-1)' }} 
          playsInline 
        />
        <canvas 
          ref={canvasRef} 
          className="absolute h-full w-full object-cover" 
          style={{ transform: 'scaleX(-1)' }} 
        />
        
        <div className="absolute bottom-6 right-6 z-10 bg-background/70 backdrop-blur-sm px-6 py-3 rounded-xl border border-blue-primary text-right pointer-events-none">
          <div className="text-xs uppercase text-slate-400 tracking-widest font-bold">Your Reps</div>
          <div className="text-5xl font-display font-extrabold text-blue-light tabular-nums">
            {playerAReps}
          </div>
        </div>
      </div>

      {/* Overlays */}
      {phase !== "playing" && (
        <div className="absolute inset-0 bg-background/95 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
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
              <div className="mt-6 w-64 h-2 bg-surface rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-blue-primary w-full origin-left animate-[progress_2s_linear_infinite]" style={{transform: 'scaleX(0)'}}></div>
              </div>
            </div>
          )}

          {phase === "waiting" && (
            <div className="text-center">
              <h2 className="text-2xl text-blue-light font-bold mb-4 uppercase tracking-widest animate-pulse">
                WAITING FOR OPPONENT...
              </h2>
              <p className="text-slate-300 text-lg">Opponent is enabling their camera</p>
            </div>
          )}
          
          {phase === "countdown" && (
            <>
              <h2 className="text-2xl text-slate-400 font-bold mb-4 uppercase tracking-widest">Get Ready</h2>
              <div key={countdown}className="text-9xl font-display font-extrabold text-green-light animate-ping-once">
                {countdown === 0 ? "GO!" : countdown}
              </div>
            </>
          )}

          {phase === "ended" && (
            <div className="text-3xl font-display font-bold text-green-light animate-pulse">
              CALCULATING RESULTS...
            </div>
          )}
        </div>
      )}
    </div>
  );
}