"use client";
import { useState } from "react";
import Dashboard from "@/components/Dashboard";
import MatchScreen from "@/components/MatchScreen";
import ResultsScreen from "@/components/ResultsScreen";

export default function Home() {
  const [screen, setScreen] = useState<"dashboard" | "match" | "results">("dashboard");
  const [duration, setDuration] = useState(60);
  const [user, setUser] = useState({ name: "PlayerOne", elo: 1200 });
  
  // Mock match results for Step 1
  const [results, setResults] = useState<{won: boolean, myReps: number, oppReps: number, eloChange: number} | null>(null);

  const handleFindMatch = (selectedDuration: number) => {
    setDuration(selectedDuration);
    setScreen("match");
  };

  const handleMatchEnd = (myReps: number, oppReps: number) => {
    const won = myReps > oppReps;
    const eloChange = won ? 15 : -15; // Mock ELO change
    setUser(prev => ({ ...prev, elo: prev.elo + eloChange }));
    setResults({ won, myReps, oppReps, eloChange });
    setScreen("results");
  };

  return (
    <main className="min-h-screen">
      {screen === "dashboard" && <Dashboard user={user} onFindMatch={handleFindMatch} />}
      {screen === "match" && (
        <MatchScreen 
          user={user} 
          duration={duration} 
          onMatchEnd={handleMatchEnd} 
          onExit={() => setScreen("dashboard")} 
        />
      )}
      {screen === "results" && results && (
        <ResultsScreen 
          results={results} 
          user={user}
          onRematch={() => setScreen("match")}
          onDashboard={() => setScreen("dashboard")} 
        />
      )}
    </main>
  );
}