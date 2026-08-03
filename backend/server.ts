import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

interface User {
  id: string;
  username: string;
  elo: number;
  inMatch: boolean;
}

interface Match {
  id: string;
  players: string[];
  duration: number;
  scores: Record<string, number>;
  startTime: number;
  readyPlayers: string[];
}

let users: Record<string, User> = {};
let matchQueue: string[] = [];
let activeMatches: Record<string, Match> = {};

const calculateElo = (winnerElo: number, loserElo: number) => {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  return {
    winner: Math.round(24 * (1 - expectedWinner)),
    loser: Math.round(24 * (0 - expectedLoser))
  };
};

const startMatchLogic = (p1: User, p2: User, duration: number) => {
  const matchId = `match-${Date.now()}`;
  const match: Match = {
    id: matchId,
    players: [p1.id, p2.id],
    duration,
    scores: { [p1.id]: 0, [p2.id]: 0 },
    startTime: 0,
    readyPlayers:[]
  };

  activeMatches[matchId] = match;
  p1.inMatch = true;
  p2.inMatch = true;

  io.to(p1.id).emit("match_found", {
    matchId, opponentName: p2.username, opponentElo: p2.elo, duration, startTime: match.startTime
  });
  io.to(p2.id).emit("match_found", {
    matchId, opponentName: p1.username, opponentElo: p1.elo, duration, startTime: match.startTime
  });

  setTimeout(() => {
    if (activeMatches[matchId]) {
      io.to(p1.id).emit("start_match");
      io.to(p2.id).emit("start_match");
    }
  }, 4000);

  setTimeout(() => endMatch(matchId), 4000 + (duration * 1000));
};

io.on("connection", (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);
  const broadcastOnlineUsers = () => {
    const onlineUsers = Object.values(users)
      .filter(u => !u.inMatch)
      .map(u => ({ username: u.username, elo: u.elo }));
    io.emit("online_users", onlineUsers);
  };

  socket.on("get_online_users", () => {
    broadcastOnlineUsers();
  });

  socket.on("register", (username: string) => {
    users[socket.id] = { id: socket.id, username, elo: 1000, inMatch: false };
    
    // FIX: Send 'name' instead of 'username' so the frontend can read it
    socket.emit("registered", { name: username, elo: users[socket.id].elo });
    
    broadcastOnlineUsers();
  });

  // 2. Standard Matchmaking
  socket.on("find_match", (duration: number) => {
    const user = users[socket.id];
    if (!user || user.inMatch) return;

    const opponentId = matchQueue.find(id => users[id] && !users[id].inMatch && id !== socket.id);

    if (opponentId) {
      const opponent = users[opponentId];
      matchQueue = matchQueue.filter(id => id !== opponentId);
      startMatchLogic(user, opponent, duration);
    } else {
      if (!matchQueue.includes(socket.id)) matchQueue.push(socket.id);
      socket.emit("searching");
    }
  });

  // 3. Direct Challenge System
  socket.on("challenge_user", (data: { targetUsername: string, duration: number }) => {
    const challenger = users[socket.id];
    const target = Object.values(users).find(u => u.username === data.targetUsername && !u.inMatch);
    
    if (challenger && target) {
      io.to(target.id).emit("challenge_received", {
        fromUsername: challenger.username,
        fromElo: challenger.elo,
        duration: data.duration
      });
    }
  });

  socket.on("respond_to_challenge", (data: { fromUsername: string, accepted: boolean, duration: number }) => {
    const target = users[socket.id];
    const challenger = Object.values(users).find(u => u.username === data.fromUsername);
    
    if (target && challenger && !challenger.inMatch && !target.inMatch) {
      if (data.accepted) {
        startMatchLogic(challenger, target, data.duration);
      } else {
        io.to(challenger.id).emit("challenge_declined", { by: target.username });
      }
    }
  });
  socket.on("cancel_matchmaking", () => {
    matchQueue = matchQueue.filter(id => id !== socket.id);
  });

  // Leave Match Early (Quit)
  socket.on("leave_match", (matchId: string) => {
    const match = activeMatches[matchId];
    if (match) {
      const leaverId = socket.id;
      const winnerId = match.players.find(id => id !== leaverId);
      
      if (winnerId) {
        // Force the leaver to have 0 reps, and give the winner 1 rep so they win
        match.scores[leaverId] = 0;
        match.scores[winnerId] = Math.max(1, match.scores[winnerId]);
        endMatch(matchId); // End the match immediately
      }
    }
  });

  // Sync: Wait for both players to have their cameras ready
  socket.on("player_ready", (matchId: string) => {
    const match = activeMatches[matchId];
    if (match && !match.readyPlayers.includes(socket.id)) {
      match.readyPlayers.push(socket.id);
      
      // If both players are ready, start the countdown!
      if (match.readyPlayers.length === 2) {
        io.to(match.players[0]).emit("start_countdown");
        io.to(match.players[1]).emit("start_countdown");
        
        // Start the match timer
        setTimeout(() => {
          if (activeMatches[matchId]) {
            io.to(match.players[0]).emit("start_match");
            io.to(match.players[1]).emit("start_match");
          }
        }, 4000); // 4 seconds for 3-2-1 countdown

        setTimeout(() => endMatch(matchId), 4000 + (match.duration * 1000));
      }
    }
  });

  // 4. Real-time Rep Updates
  socket.on("rep_update", (matchId: string, reps: number) => {
    const match = activeMatches[matchId];
    if (match && match.players.includes(socket.id)) {
      match.scores[socket.id] = reps;
      const opponentId = match.players.find(id => id !== socket.id);
      if (opponentId) io.to(opponentId).emit("opponent_rep_update", reps);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    matchQueue = matchQueue.filter(id => id !== socket.id);
    delete users[socket.id];
    broadcastOnlineUsers();
  });
});

function endMatch(matchId: string) {
  const match = activeMatches[matchId];
  if (!match) return;

  const [p1, p2] = match.players;
  const p1Reps = match.scores[p1] || 0;
  const p2Reps = match.scores[p2] || 0;

  const user1 = users[p1];
  const user2 = users[p2];


  if (!user1 || !user2) {
    const winner = user1 || user2;
    const winnerId = winner ? winner.id : null;
    
    if (winner && winnerId) {
      winner.inMatch = false;
      const myReps = match.scores[winnerId] || 0;
      io.to(winnerId).emit("match_end", {
        myReps: myReps,
        oppReps: 0,
        eloChange: 0, 
        winner: winner.username
      });
    }
    delete activeMatches[matchId];
    return;
  }

  // Normal match end logic (both players present)
  user1.inMatch = false;
  user2.inMatch = false;

  let p1EloChange = 0, p2EloChange = 0;
  let winner = "";

  if (p1Reps > p2Reps) {
    winner = user1.username;
    const elo = calculateElo(user1.elo, user2.elo);
    p1EloChange = elo.winner; p2EloChange = elo.loser;
    user1.elo += p1EloChange; user2.elo += p2EloChange;
  } else if (p2Reps > p1Reps) {
    winner = user2.username;
    const elo = calculateElo(user2.elo, user1.elo);
    p2EloChange = elo.winner; p1EloChange = elo.loser;
    user2.elo += p2EloChange; user1.elo += p1EloChange;
  }

  io.to(p1).emit("match_end", { myReps: p1Reps, oppReps: p2Reps, eloChange: p1EloChange, winner });
  io.to(p2).emit("match_end", { myReps: p2Reps, oppReps: p1Reps, eloChange: p2EloChange, winner });
  
  delete activeMatches[matchId];

}

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Battle Server running on http://localhost:${PORT}`);
});