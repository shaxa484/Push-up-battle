"use client";

export interface ResultsData {
  myReps: number;
  oppReps: number;
  eloChange: number;
  winner: string;
}

interface User { name: string; elo: number; }

interface ResultsScreenProps {
  results: ResultsData;
  user: User;
  onFindNewMatch: () => void; // Changed from onRematch
  onDashboard: () => void;
}

export default function ResultsScreen({ results, user, onFindNewMatch, onDashboard }: ResultsScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className={`text-6xl md:text-8xl font-display font-extrabold mb-8 tracking-tight ${user.name === results.winner ? 'text-green-light' : 'text-red-400'}`}>
        {user.name === results.winner ? "VICTORY" : "DEFEAT"}
      </div>

      <div className="bg-surface border border-slate-800 rounded-xl p-8 w-full max-w-md mb-8">
        <div className="grid grid-cols-2 gap-8 text-center mb-8">
          <div className="border-r border-slate-800">
            <h3 className="text-blue-light font-bold mb-2">{user.name}</h3>
            <div className="text-5xl font-display font-extrabold text-white mb-2">{results.myReps}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500">Reps</div>
          </div>
          <div>
            <h3 className="text-green-light font-bold mb-2">Opponent</h3>
            <div className="text-5xl font-display font-extrabold text-white mb-2">{results.oppReps}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500">Reps</div>
          </div>
        </div>

        <div className="text-center pt-6 border-t border-slate-800">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">ELO Change</div>
          <div className={`text-3xl font-display font-bold ${results.eloChange > 0 ? 'text-green-light' : 'text-red-400'}`}>
            {results.eloChange > 0 ? '+' : ''}{results.eloChange}
          </div>
          <div className="text-sm text-slate-400 mt-1">New ELO: {user.elo}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button 
          onClick={onDashboard}
          className="flex-1 bg-surface border border-slate-700 hover:border-slate-500 text-white font-bold py-4 rounded-lg transition-colors"
        >
          BACK TO DASHBOARD
        </button>
        <button 
          onClick={onFindNewMatch}
          className="flex-1 bg-blue-primary hover:bg-blue-light text-white font-bold py-4 rounded-lg transition-colors shadow-lg shadow-blue-primary/30"
        >
          FIND NEW MATCH
        </button>
      </div>
    </div>
  );
}