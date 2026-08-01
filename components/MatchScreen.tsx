"use client";
import { useState, useEffect, useRef } from "react";

export default function MatchScreen({ user, duration, onMatchEnd, onExit }: any) {
  const [phase, setPhase] = useState<"countdown" | "playing" | "paused">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(duration);
  
  // Mock Reps State
  const [playerAReps, setPlayerAReps] = useState(0);
  const [playerBReps, setPlayerBReps] = useState(0);

  // Mock Opponent Logic (Auto-increments reps)
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setPlayerBReps(prev => prev + 1);
    }, 2000); // Opponent does a rep every 2 seconds
    return () => clearInterval(interval);
  }, [phase]);

  // Timer Logic
  useEffect(() => {
    if (phase === "countdown") {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setPhase("playing");
      }
    }
  }, [countdown, phase]);

  useEffect(() => {
    if (phase === "playing" && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      onMatchEnd(playerAReps, playerBReps);
    }
  }, [phase, timeLeft, playerAReps, playerBReps, onMatchEnd]);

  // Tug of War Math
  // flex-grow logic requires at least a base value to prevent 0 or negative
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
        <div className="w-[60px]"></div> {/* Spacer for centering */}
      </div>

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
          {/* Camera Placeholder for Opponent (if remote video was shown, but here just color overlay) */}
        </div>

        {/* Player A (User - Blue - Bottom) */}
        <div 
          className="relative bg-blue-primary/20 border-t-4 border-blue-primary flex items-center justify-center transition-all duration-500 ease-out"
          style={{ flexGrow: growA, flexBasis: 0 }}
        >
          {/* Camera Feed Placeholder */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
             {/* In production, <video ref={videoRef} className="w-full h-full object-cover opacity-40" /> goes here */}
             <div className="text-slate-600 text-sm font-bold border-2 border-dashed border-slate-700 p-4 rounded-lg">
               CAMERA FEED (MEDIAPIPE ZONE)
             </div>
          </div>

          <div className="text-center z-10 mt-10">
            <div className="text-blue-light text-8xl font-display font-extrabold drop-shadow-lg">
              {playerAReps}
            </div>
            <div className="text-blue-light text-xl font-bold mt-2">{user.name.toUpperCase()}</div>
          </div>
        </div>

      </div>

      {/* MOCK CONTROLS - For UI Testing Only */}
      {phase === "playing" && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex gap-4">
          <button 
            onClick={() => setPlayerAReps(r => r + 1)}
            className="bg-blue-primary hover:bg-blue-light text-white font-bold py-4 px-8 rounded-lg shadow-lg shadow-blue-primary/50 transition-transform active:scale-95"
          >
            DO PUSHUP (YOU)
          </button>
        </div>
      )}

      {/* Countdown Overlay */}
      {phase === "countdown" && (
        <div className="absolute inset-0 bg-background/90 z-40 flex flex-col items-center justify-center backdrop-blur-sm">
          <h2 className="text-2xl text-slate-400 font-bold mb-4 uppercase tracking-widest">Get Ready</h2>
          <div className="text-9xl font-display font-extrabold text-green-light animate-ping-once">
            {countdown === 0 ? "GO!" : countdown}
          </div>
        </div>
      )}

    </div>
  );
}