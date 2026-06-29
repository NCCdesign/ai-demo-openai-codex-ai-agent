import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import type { AuthService } from "../services/auth.service.js";

export function attachSocketServer(fastify: FastifyInstance, auth: AuthService): Server {
  const io = new Server(fastify.server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    const user = auth.authenticateHeader(token ? `Bearer ${token}` : undefined);
    if (!user) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.user = user;
    socket.join(`user:${user.id}`);
    next();
  });

  io.on("connection", (socket) => {
    socket.on("session:join", (payload: { sessionId: string }) => {
      socket.join(`session:${payload.sessionId}`);
    });
    socket.on("session:leave", (payload: { sessionId: string }) => {
      socket.leave(`session:${payload.sessionId}`);
    });
  });

  return io;
}
