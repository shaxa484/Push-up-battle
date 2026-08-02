import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- IN-MEMORY DATABASE (MVP) ---
interface User {
  id: string;
  username: string;
  elo: number;
  inMatch: boolean;
}

interface Match {
  id: string;
  players: string[]; // socket ids
  duration: number;
  scores: Record<string, number>;
  startTime: number;
}

let users: Record<string, User> = {};
let matchQueue: string[] = [];
let activeMatches: Record<string, Match> = {};

// ELO Calculation (K-factor 24)
const calculateElo = (winnerElo: number, loserElo: number) => {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  return {
    winner: Math.round(24 * (1 - expectedWinner)),
    loser: Math.round(24 * (0 - expectedLoser))
  };
};

// --- SOCKET.IO LOGIC ---
io.on("connection", (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. User Registration
  socket.on("register", (username: string) => {
    users[socket.id] = { id: socket.id, username, elo: 1000, inMatch: false };
    socket.emit("registered", users[socket.id]);
  });

  // 2. Matchmaking
  socket.on("find_match", (duration: number) => {
    const user = users[socket.id];
    if (!user || user.inMatch) return;

    // Check if someone is already in the queue for the same duration
    const opponentId = matchQueue.find(id => users[id] && !users[id].inMatch);

    if (opponentId && opponentId !== socket.id) {
      // Match found!
      const opponent = users[opponentId];
      matchQueue = matchQueue.filter(id => id !== opponentId);

      const matchId = `match-${Date.now()}`;
      const match: Match = {
        id: matchId,
        players: [socket.id, opponentId],
        duration,
        scores: { [socket.id]: 0, [opponentId]: 0 },
        startTime: Date.now() + 4000 // 4 seconds from now (for 3-2-1 countdown)
      };

      activeMatches[matchId] = match;
      user.inMatch = true;
      opponent.inMatch = true;

      // Notify both players
      io.to(socket.id).emit("match_found", {
        matchId,
        opponentName: opponent.username,
        opponentElo: opponent.elo,
        duration,
        startTime: match.startTime
      });
      io.to(opponentId).emit("match_found", {
        matchId,
        opponentName: user.username,
        opponentElo: user.elo,
        duration,
        startTime: match.startTime
      });

      // Start match timer on server
      setTimeout(() => {
        const activeMatch = activeMatches[matchId];
        if (activeMatch) {
          io.to(socket.id).emit("start_match");
          io.to(opponentId).emit("start_match");
        }
      }, 4000);

      // End match timer on server
      setTimeout(() => {
        endMatch(matchId);
      }, 4000 + (duration * 1000));

    } else {
      // Add to queue
      if (!matchQueue.includes(socket.id)) {
        matchQueue.push(socket.id);
      }
      socket.emit("searching");
    }
  });

  // 3. Real-time Rep Updates
  socket.on("rep_update", (matchId: string, reps: number) => {
    const match = activeMatches[matchId];
    if (match && match.players.includes(socket.id)) {
      match.scores[socket.id] = reps;
      
      // Broadcast to the opponent
      const opponentId = match.players.find(id => id !== socket.id);
      if (opponentId) {
        io.to(opponentId).emit("opponent_rep_update", reps);
      }
    }
  });

  // 4. Disconnect Handling
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    matchQueue = matchQueue.filter(id => id !== socket.id);
    delete users[socket.id];
  });
});

// Helper to end match and calculate ELO
function endMatch(matchId: string) {
  const match = activeMatches[matchId];
  if (!match) return;

  const [p1, p2] = match.players;
  const p1Reps = match.scores[p1] || 0;
  const p2Reps = match.scores[p2] || 0;

  const user1 = users[p1];
  const user2 = users[p2];

  if (user1 && user2) {
    user1.inMatch = false;
    user2.inMatch = false;

    let p1EloChange = 0, p2EloChange = 0;
    let winner = "";

    if (p1Reps > p2Reps) {
      winner = user1.username;
      const elo = calculateElo(user1.elo, user2.elo);
      p1EloChange = elo.winner;
      p2EloChange = elo.loser;
      user1.elo += p1EloChange;
      user2.elo += p2EloChange;
    } else if (p2Reps > p1Reps) {
      winner = user2.username;
      const elo = calculateElo(user2.elo, user1.elo);
      p2EloChange = elo.winner;
      p1EloChange = elo.loser;
      user2.elo += p2EloChange;
      user1.elo += p1EloChange;
    }

    // Send results to both players
    io.to(p1).emit("match_end", {
      myReps: p1Reps, oppReps: p2Reps, eloChange: p1EloChange, winner
    });
    io.to(p2).emit("match_end", {
      myReps: p2Reps, oppReps: p1Reps, eloChange: p2EloChange, winner
    });

    delete activeMatches[matchId];
  }
}

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Arena Server running on http://localhost:${PORT}`);
});