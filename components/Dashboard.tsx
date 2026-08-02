"use client";
import { useState } from "react";

export default function Dashboard({ user, onFindMatch }: any) {
  const [duration, setDuration] = useState(60);
  const [isSearching, setIsSearching] = useState(false); // ADD THIS

  const handleFindMatch = () => {
    setIsSearching(true);
    onFindMatch(duration);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-8">
      {/* Navbar */}
      <nav className="flex justify-between items-center mb-12 pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-display font-extrabold tracking-tight text-white">
          PUSH<span className="text-green-primary">UP</span> ARENA
        </h1>
        <div className="flex items-center gap-6">
          <span className="text-slate-300 font-medium hidden sm:block">{user.name}</span>
          <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-lg border border-slate-700">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">ELO</span>
            <span className="text-xl font-display font-bold text-green-light">{user.elo}</span>
          </div>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Match Setup Card */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-slate-800 p-8 flex flex-col">
          <h2 className="text-3xl font-display font-bold text-white mb-2">Match Setup</h2>
          <p className="text-slate-400 mb-8">Select your challenge duration and find an opponent.</p>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "1 Minute", value: 60 },
              { label: "3 Minutes", value: 180 },
              { label: "5 Minutes", value: 300 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                disabled={isSearching} // Disable changing duration while searching
                className={`p-4 rounded-lg border-2 font-display font-bold text-lg transition-all duration-200 ${
                  duration === opt.value
                    ? "bg-blue-dark/40 border-blue-primary text-white scale-105"
                    : "bg-background border-slate-700 text-slate-400 hover:border-slate-500"
                } ${isSearching ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-auto">
            <button
              onClick={handleFindMatch}
              disabled={isSearching}
              className={`w-full font-display font-extrabold text-xl py-4 rounded-lg tracking-wide shadow-lg transition-all duration-200 ${
                isSearching 
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed animate-pulse" 
                  : "bg-blue-primary hover:bg-blue-light text-white shadow-blue-primary/30"
              }`}
            >
              {isSearching ? "SEARCHING FOR OPPONENT..." : "FIND MATCH"}
            </button>
          </div>
        </div>

        {/* Leaderboard Panel */}
        <div className="bg-surface rounded-xl border border-slate-800 p-6">
          <h3 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-primary rounded-full animate-pulse"></span>
            TOP CHALLENGERS
          </h3>
          <div className="space-y-4">
            {[
              { name: "PushUpKing", elo: 2450 },
              { name: "FitnessBeast", elo: 2310 },
              { name: "IronChest", elo: 2200 },
              { name: "DailyGrind", elo: 2050 },
              { name: "CoreCrusher", elo: 1980 },
            ].map((p, i) => (
              <div key={p.name} className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className={`font-display font-bold w-6 ${i === 0 ? "text-green-light" : "text-slate-500"}`}>{i + 1}</span>
                  <span className="font-medium text-slate-200">{p.name}</span>
                </div>
                <span className="font-display font-bold text-slate-300">{p.elo}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}