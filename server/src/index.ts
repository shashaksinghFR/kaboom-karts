import cors from "cors";
import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Server, matchMaker } from "colyseus";
import { KartRoom } from "./KartRoom.js";
import { FightRoom } from "./FightRoom.js";
import { createCode, resolveCode } from "./roomCodes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT ?? 2567);
const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => (o.startsWith("http") ? o : `https://${o}`));

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes("*") ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
  })
);

app.use(express.json());

// 1. Health check
app.get("/health", (_req, res) => res.json({ ok: true, timestamp: Date.now() }));

// 2. Create a new Kart room with a unique 4-6 char room code
app.post("/rooms", async (_req, res, next) => {
  try {
    const roomCode = createCode();
    const reservation = await matchMaker.create("kart", { roomCode, code: roomCode });
    res.status(201).json({ roomId: reservation.room.roomId, roomCode });
  } catch (error) {
    next(error);
  }
});

// 3. Resolve room code to active roomId
app.get("/rooms/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const roomId = resolveCode(code);
  if (!roomId) {
    return res.status(404).json({ error: "Room code not found or expired." });
  }
  return res.json({ roomId, roomCode: code });
});

// 4. Robust Static Client Discovery across all build environments
const candidatePaths = [
  path.resolve(__dirname, "../../../../client/dist"),
  path.resolve(__dirname, "../../../client/dist"),
  path.resolve(__dirname, "../../client/dist"),
  path.resolve(__dirname, "../client/dist"),
  path.resolve(process.cwd(), "client/dist"),
  path.resolve(process.cwd(), "../client/dist"),
  path.resolve(process.cwd(), "../../client/dist"),
  path.resolve("/opt/render/project/src/client/dist"),
];

let clientDistPath: string | null = null;
for (const cand of candidatePaths) {
  try {
    if (fs.existsSync(cand) && fs.existsSync(path.join(cand, "index.html"))) {
      clientDistPath = cand;
      break;
    }
  } catch (_e) {}
}

if (clientDistPath) {
  console.log(`📦 Found and serving client build from: ${clientDistPath}`);
  app.use(express.static(clientDistPath, { index: "index.html" }));
  
  app.get("/", (_req, res) => {
    res.sendFile(path.join(clientDistPath!, "index.html"));
  });

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/rooms") || req.path.startsWith("/health") || req.path.startsWith("/colyseus")) {
      return next();
    }
    res.sendFile(path.join(clientDistPath!, "index.html"));
  });
} else {
  console.warn("⚠️ Client dist directory not found. Checked paths:", candidatePaths);
  app.get("/", (_req, res) => {
    res.send("<h1>🏎️ Kaboom Karts Server is Running</h1><p>Client build is initializing...</p>");
  });
}

const server = http.createServer(app);
const gameServer = new Server({ server });

// Register Game Rooms
gameServer.define("kart", KartRoom).filterBy(["code"]);
gameServer.define("fight", FightRoom).filterBy(["code"]);

gameServer.listen(port);
console.log(`🏎️ Kaboom Karts server listening on :${port}`);
