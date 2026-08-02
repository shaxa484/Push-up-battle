import { io, Socket } from "socket.io-client";

// Connect to the backend server we created in Step 2
export const socket: Socket = io("http://localhost:3001", {
  autoConnect: false,
});