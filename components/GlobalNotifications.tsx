"use client";
import { useState, useEffect } from "react";
import { socket } from "@/lib/socket";

interface Challenge {
  fromUsername: string;
  fromElo: number;
  duration: number;
}

export default function GlobalNotifications() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    const handleChallenge = (data: Challenge) => {
      setChallenge(data);
    };

    const handleFailed = (data: { message: string }) => {
      alert(data.message);
      setChallenge(null);
    };

    socket.on("challenge_received", handleChallenge);
    socket.on("challenge_failed", handleFailed);

    return () => {
      socket.off("challenge_received", handleChallenge);
      socket.off("challenge_failed", handleFailed);
    };
  }, []);

  const handleAccept = () => {
    if (challenge) {
      console.log("[Client] Accept clicked! Emitting respond_to_challenge for", challenge.fromUsername);  
      socket.emit("respond_to_challenge", { 
        fromUsername: challenge.fromUsername, 
        accepted: true, 
        duration: challenge.duration 
      });
    }
    setChallenge(null);
  };

  const handleDecline = () => {
    if (challenge) {
      socket.emit("respond_to_challenge", { 
        fromUsername: challenge.fromUsername, 
        accepted: false, 
        duration: challenge.duration 
      });
    }
    setChallenge(null);
  };

  if (!challenge) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-slide-in-right">
      <div className="bg-surface border-2 border-blue-primary rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 bg-blue-light rounded-full animate-pulse"></div>
          <h3 className="text-xl font-display font-bold text-white">Challenge Incoming!</h3>
        </div>
        
        <div className="bg-background p-3 rounded-lg border border-slate-700">
          <div className="flex justify-between items-center">
            <span className="font-bold text-white text-lg">{challenge.fromUsername}</span>
            <span className="text-sm text-slate-400 font-bold">{challenge.fromElo} ELO</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Duration: {challenge.duration} seconds</div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleDecline}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg transition-colors"
          >
            Decline
          </button>
          <button 
            onClick={handleAccept}
            className="flex-1 bg-green-primary hover:bg-green-light text-white font-bold py-2 rounded-lg transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}