// src/components/Dashboard.tsx
"use client";
import { useState, useEffect } from "react";
import { socket } from "@/lib/socket";

interface User { name: string; elo: number; }
interface OnlineUser { username: string; elo: number; }
interface Challenge { fromUsername: string; fromElo: number; duration: number; }

export default function Dashboard({ user, onFindMatch }: { user: User, onFindMatch: (duration: number) => void }) {
  const [duration, setDuration] = useState(60);
  const [isSearching, setIsSearching] = useState(false);
  
  // Search & Notification State
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    // Fetch online users immediately and every 5 seconds
    const fetchUsers = () => socket.emit("get_online_users");
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);

    socket.on("online_users", (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    socket.on("challenge_received", (data: Challenge) => {
      setChallenges(prev => [...prev, data]);
    });

    socket.on("challenge_declined", (data: { by: string }) => {
      alert(`${data.by} declined your challenge.`);
      setIsSearching(false);
    });

    return () => {
      clearInterval(interval);
      socket.off("online_users");
      socket.off("challenge_received");
      socket.off("challenge_declined");
    };
  }, []);

  const handleFindMatch = () => {
    setIsSearching(true);
    onFindMatch(duration);
  };

  const handleCancelSearch = () => {
    socket.emit("cancel_matchmaking");
    setIsSearching(false);
  };

  const handleSendChallenge = (targetUsername: string) => {
    socket.emit("challenge_user", { targetUsername, duration });
    setIsSearching(true);
    alert(`Challenge sent to ${targetUsername}! Waiting for response...`);
  };

  const handleAcceptChallenge = (challenge: Challenge) => {
    socket.emit("respond_to_challenge", { fromUsername: challenge.fromUsername, accepted: true, duration: challenge.duration });
    setChallenges(prev => prev.filter(c => c.fromUsername !== challenge.fromUsername));
  };

  const handleDeclineChallenge = (challenge: Challenge) => {
    socket.emit("respond_to_challenge", { fromUsername: challenge.fromUsername, accepted: false, duration: challenge.duration });
    setChallenges(prev => prev.filter(c => c.fromUsername !== challenge.fromUsername));
  };

  // Filter users based on search query
  const filteredUsers = onlineUsers.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-8">
      {/* Navbar */}
      <nav className="flex justify-between items-center mb-12 pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-display font-extrabold tracking-tight text-white">
          PUSH<span className="text-green-primary">UP</span> BATTLE
        </h1>
        <div className="flex items-center gap-6">
          <span className="text-slate-300 font-medium hidden sm:block">{user.name}</span>
          
          {/* Notification Bell */}
          <div className="relative group">
            <button className="relative p-2 text-slate-300 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {challenges.length > 0 && (
                <span className="absolute top-0 right-0 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {challenges.length}
                </span>
              )}
            </button>
            
            {/* Notification Dropdown */}
            {challenges.length > 0 && (
              <div className="absolute right-0 mt-2 w-80 bg-surface border border-slate-700 rounded-lg shadow-xl z-50">
                <div className="p-3 border-b border-slate-700 font-bold text-white">Pending Challenges</div>
                {challenges.map((c, i) => (
                  <div key={i} className="p-4 border-b border-slate-800 flex flex-col gap-2">
                    <div className="text-white font-medium">{c.fromUsername} <span className="text-slate-500 text-sm">({c.fromElo} ELO)</span></div>
                    <div className="text-xs text-slate-400">Duration: {c.duration}s</div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => handleAcceptChallenge(c)} className="flex-1 bg-green-primary hover:bg-green-light text-white text-sm font-bold py-1 rounded">Accept</button>
                      <button onClick={() => handleDeclineChallenge(c)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold py-1 rounded">Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
          <p className="text-slate-400 mb-8">Select duration and find an opponent, or challenge someone directly.</p>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "1 Minute", value: 60 },
              { label: "3 Minutes", value: 180 },
              { label: "5 Minutes", value: 300 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                disabled={isSearching}
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
              onClick={isSearching ? handleCancelSearch : handleFindMatch}
              className={`w-full font-display font-extrabold text-xl py-4 rounded-lg tracking-wide shadow-lg transition-all duration-200 cursor-pointer ${
                isSearching 
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed animate-pulse" 
                  : "bg-blue-primary hover:bg-blue-light text-white shadow-blue-primary/30"
              }`}
            >
              {isSearching ? "CANCEL SEARCH" : "FIND MATCH"}
            </button>
          </div>
        </div>

        {/* Search & Online Users Panel */}
        <div className="bg-surface rounded-xl border border-slate-800 p-6 flex flex-col">
          <h3 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-primary rounded-full animate-pulse"></span>
            CHALLENGE A PLAYER
          </h3>
          
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username..." 
            className="w-full bg-background border border-slate-700 text-white px-3 py-2 rounded-lg mb-4 focus:outline-none focus:border-blue-primary"
          />

          <div className="flex-grow overflow-y-auto space-y-3 max-h-96 pr-2">
            {filteredUsers.length === 0 ? (
              <p className="text-slate-500 text-center text-sm mt-4">No players found.</p>
            ) : (
              filteredUsers.map((p) => (
                <div key={p.username} className="flex items-center justify-between bg-background p-3 rounded-lg border border-slate-800">
                  <div>
                    <div className="font-bold text-white text-sm">{p.username}</div>
                    <div className="text-xs text-slate-400">{p.elo} ELO</div>
                  </div>
                  <button 
                    onClick={() => handleSendChallenge(p.username)}
                    disabled={isSearching}
                    className="bg-green-primary/20 border border-green-primary text-green-light text-xs font-bold px-3 py-1 rounded hover:bg-green-primary hover:text-white transition-colors disabled:opacity-50"
                  >
                    CHALLENGE
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}