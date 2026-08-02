"use client";
import { useState } from "react";

export default function UsernameScreen({ onRegister }: { onRegister: (username: string) => void }) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length > 2) {
      onRegister(name.trim());
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <h1 className="text-5xl font-display font-extrabold text-white mb-2 tracking-tight">
        PUSH<span className="text-green-primary">UP</span> BATTLE
      </h1>
      <p className="text-slate-400 mb-8">Enter the 1v1 Fitness Esports Battle</p>
      
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Choose your username..."
          className="bg-surface border border-slate-700 text-white text-lg px-4 py-3 rounded-lg focus:outline-none focus:border-blue-primary"
        />
        <button 
          type="submit" 
          className="bg-blue-primary hover:bg-blue-light text-white font-display font-bold text-lg py-3 rounded-lg transition-colors"
        >
          ENTER BATTLE
        </button>
      </form>
    </div>
  );
}