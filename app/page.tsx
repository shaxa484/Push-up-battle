"use client";
import { useState, useEffect } from "react";
import Dashboard from "@/components/Dashboard";
import MatchScreen,{MatchData} from "@/components/MatchScreen";
import ResultsScreen,{ResultsData} from "@/components/ResultsScreen";
import UsernameScreen from "@/components/UsernameScreen";
import { socket } from "@/lib/socket";

export default function Home() {
  const [screen, setScreen] = useState<"username" | "dashboard" | "match" | "results">("username");
  const [user, setUser] = useState<{ name: string; elo: number } | null>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);

  useEffect(() => {
    socket.connect();

    socket.on("registered", (data: { name: string; elo: number }) => {
      setUser(data);
      setScreen("dashboard");
    });

    socket.on("match_found", (data: MatchData) => {
      setMatchData(data);
      setScreen("match");
    });

    socket.on("match_end", (data: ResultsData) => {
      setResults(data);
      setScreen("results");
      if (user) {
        setUser({ ...user, elo: user.elo + data.eloChange });
      }
    });

    return () => {
      socket.off("registered");
      socket.off("match_found");
      socket.off("match_end");
    };
  }, [user]);

  const handleRegister = (username: string) => {
    socket.emit("register", username);
  };

  const handleFindMatch = (duration: number) => {
    socket.emit("find_match", duration);
  };

  return (
    <main className="min-h-screen">
      {screen === "username" && <UsernameScreen onRegister={handleRegister} />}
      {screen === "dashboard" && user && <Dashboard user={user} onFindMatch={handleFindMatch} />}
      {screen === "match" && matchData && user && (
        <MatchScreen 
          user={user} 
          duration={matchData.duration} 
          matchData={matchData}
          onMatchEnd={() => {}} // Server handles this via "match_end" event
          onExit={() => setScreen("dashboard")} 
        />
      )}
      {screen === "results" && results && user && (
        <ResultsScreen 
          results={results} 
          user={user}
          onRematch={() => handleFindMatch(matchData ? matchData.duration : 60)}
          onDashboard={() => setScreen("dashboard")} 
        />
      )}
    </main>
  );
}