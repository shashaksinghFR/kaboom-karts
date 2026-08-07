# Steel Genesis

Steel Genesis is a browser-based, server-authoritative 1v1 pixel fighter. It uses placeholder geometry so gameplay is usable before art is delivered.

## Run locally

Requires Node.js 20+ and npm.

```powershell
npm install
npm run dev:server
```

In a second terminal:

```powershell
npm run dev:client
```

Open `http://localhost:5173` in two separate browser sessions. Create a room in one session, then enter its five-character code in the other.

Controls are `A/D` to move, `W` to jump, `J` to punch, `K` to kick, and `L` to block. Attacks cannot be used while airborne.

## Verification

```powershell
npm run typecheck
npm run test
npm run build
```

Manual acceptance: verify create/join, the countdown, movement and fighting from both browser sessions, a KO and a time-out round, best-of-three match completion, mutual rematch, leaving, and a temporary disconnect/reload within 30 seconds.

## Deploy

- Deploy `/client` to Vercel. Set `VITE_SERVER_URL` to the public `wss://` server URL and `VITE_API_URL` to its matching `https://` URL.
- Deploy `/server` to Render as a Node web service. Build with `npm install && npm --workspace server run build`; start with `npm --workspace server run start`.
- Set the server's `CLIENT_ORIGIN` to the deployed Vercel URL (or a comma-separated list of permitted client origins) and set `PORT` from Render's supplied value.

Rooms and room codes live in process memory, so they are intentionally lost on server restart. No account or database is used.

## Art handoff

Replace the rectangles in `client/src/FightScene.ts` with supplied sprite-sheet animations. Keep `ARENA` dimensions and the server's fighter hitbox assumptions aligned with the frame layout. Background assets can replace the flat arena rectangles without changing network gameplay.
