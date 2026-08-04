"use client";
import { useState, useEffect } from "react";
import { socket } from "@/lib/socket";

interface User { name: string; elo: number; }
interface OnlineUser { username: string; elo: number; }

export default function Dashboard({ user, onFindMatch }: { user: User, onFindMatch: (duration: number) => void }) {
  const [duration, setDuration] = useState(60);
  const [isSearching, setIsSearching] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    socket.emit("get_online_users");

    socket.on("online_users", (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    socket.on("challenge_declined", (data: { by: string }) => {
      alert(`${data.by} declined your challenge.`);
      setIsSearching(false);
    });

    socket.on("challenge_failed", () => {
      setIsSearching(false);
    });

    socket.on("match_found", () => {
      setIsSearching(false);
    });

    return () => {
      socket.off("online_users");
      socket.off("challenge_declined");
      socket.off("match_found");
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
  };

  const filteredUsers = onlineUsers.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
    u.username !== user.name
  );

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
                  ? "bg-red-600 hover:bg-red-500 text-white" 
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