// src/app/page.tsx
"use client";
import { useState, useEffect } from "react";
import Dashboard from "@/components/Dashboard";
import MatchScreen, { MatchData } from "@/components/MatchScreen";
import ResultsScreen, { ResultsData } from "@/components/ResultsScreen";
import UsernameScreen from "@/components/UsernameScreen";
import GlobalNotifications from "@/components/GlobalNotifications";
import { socket } from "@/lib/socket";

export default function Home() {
  const [screen, setScreen] = useState<"username" | "dashboard" | "match" | "results">("username");
  const [user, setUser] = useState<{ name: string; elo: number } | null>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);

  useEffect(() => {
    socket.connect();

    socket.on("registered", (data: { name: string; elo: number }) => {
      console.log("[Client] Registered successfully");
      setUser(data);
      setScreen("dashboard");
    });

    socket.on("match_found", (data: MatchData) => {
      console.log("[Client] match_found received! Changing screen to match...", data);
      setMatchData(data);
      setScreen("match");
    });

    socket.on("match_end", (data: ResultsData) => {
      console.log("[Client] match_end received!");
      setResults(data);
      setScreen("results");
      if (user) {
        setUser({ ...user, elo: user.elo + data.eloChange });
      }
    });

    socket.on("match_aborted", () => {
      console.log("[Client] match_aborted received!");
      alert("Opponent left the match before it started.");
      setMatchData(null);
      setScreen("dashboard");
    });

    return () => {
      socket.off("registered");
      socket.off("match_found");
      socket.off("match_end");
      socket.off("match_aborted");
    };
  }, []);

  const handleRegister = (username: string) => {
    socket.emit("register", username);
  };

  const handleFindMatch = (duration: number) => {
    socket.emit("find_match", duration);
  };

  const handleFindNewMatch = () => {
    setResults(null);
    setScreen("dashboard");
  };

  return (
    <main className="min-h-screen">

      {/* Render globally so it shows on Results, Dashboard, etc */}
      <GlobalNotifications /> 

      {screen === "username" && <UsernameScreen onRegister={handleRegister} />}
      {screen === "dashboard" && user && <Dashboard user={user} onFindMatch={handleFindMatch} />}
      {screen === "match" && matchData && user && (
        <MatchScreen 
          user={user} 
          duration={matchData.duration} 
          matchData={matchData}
          onMatchEnd={() => {}} 
          onExit={() => setScreen("dashboard")} 
        />
      )}
      {screen === "results" && results && user && (
        <ResultsScreen 
          results={results} 
          user={user}
          onFindNewMatch={handleFindNewMatch}
          onDashboard={() => setScreen("dashboard")} 
        />
      )}
    </main>
  );
}