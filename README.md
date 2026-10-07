# Roundtable

A realtime game-night app (Next.js + a [PartyServer](https://github.com/cloudflare/partykit/tree/main/packages/partyserver) worker on Cloudflare Durable Objects): sign in with Discord or as a guest, browse open tables, split into owner-named teams, or play **Buzz In** with a live, animated big-screen preview.

## Development

Install dependencies:

```bash
npm install
```

Create `.env.local` from [.env.example](./.env.example). `AUTH_SECRET` is required (both Next.js and `wrangler dev` read it); the Discord variables are optional — without them only guest sign-in is offered.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Run the web app and party worker in separate terminals:

```bash
npm run dev
```

```bash
npm run dev:party
```

Open [http://localhost](http://localhost). Next.js runs on port `80` and the local party worker (`wrangler dev`) runs on port `1999`.

## Sign-in

- **Discord** — OAuth2 with the `identify` scope only; just the username and avatar are kept. In the [Discord developer portal](https://discord.com/developers/applications) add the redirect `http://localhost/api/auth/discord/callback` (plus your production URL).
- **Guest** — pick a display name (2–24 characters). Guests can rename themselves from the account menu.

Sessions are HMAC-signed, `httpOnly` cookies. The browser exchanges the session for a 10-minute token (`/api/auth/party-token`) that the party worker verifies with the same `AUTH_SECRET`, so identities and admin rights can't be spoofed over the socket.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/` | Signed-out visitors | Landing page and sign-in. Signed-in users go straight to `/rooms`. |
| `/rooms` | Signed-in users | All open rooms, room creation, and search. If you're in a room, a drawer at the bottom lets you return to it or leave. |
| `/rooms/[slug]` | Signed-in users | The room. Buzz In rooms are a full-screen stage with small top-right buttons (edit board, game controls, big-screen preview, invite link, **Settings** drawer, leave, account); Teams rooms use the same compact top bar. You stay in the room while browsing `/rooms` until you click **Leave** (or join another room). |
| `/rooms/[slug]/preview` | Anyone with the link | Read-only Buzz In stage: lobby, board with scores, animated clue/timer/answer reveals, Final Buzz In, and the winner podium. Answers stay hidden until the host reveals them, so it's safe to cast to a TV. |

## Buzz In

- **Lobby:** Buzz In rooms open in a lobby. Players mark themselves **Ready** while the owner and host build the board. Once every clue on the board is filled in, the owner or host gets a **Start game** button; if some players aren't ready they can still start after confirming.
- **Board:** the owner and host build the board in **Edit board** mode (top-right pencil, or **Fill the board** in the lobby). The stage turns into an editor where every tile shows its points, question, and answer: 1–10 categories (5 by default) with 5 clues each. Rename a category inline, click any tile to write its clue and answer, or load prefilled content. Use a column's menu to load one prefilled category, or **Use prefilled board** to fill every column with random prefilled categories. Edit mode closes on its own when a clue opens or the game moves to a new phase.
- **Prefilled categories** live in [lib/buzz-in/categories](./lib/buzz-in/categories). To add one, create a file there and list it in `PREFILLED_CATEGORIES` in [lib/buzz-in/index.ts](./lib/buzz-in/index.ts).
- Players only receive a clue's text once it's picked, and the answer once it's revealed. The owner and host see everything, so neither can buzz; the host runs the game.
- Players buzz with the button or the <kbd>Space</kbd> key. Player screens use the same animated stage as the preview (board, clue reveals, timer, and live scores).
- **Game rules** (owner/host, in **Settings → Rules**): players can either **say** their answer out loud or **type** it after buzzing. Typed answers are shown only to the owner and host, marked as needing judging, correct, or incorrect. Clues can be picked by the **host**, or by **players**: the last player to answer correctly picks the next clue, and the host can always pick instead.
- **Judging hints** (owner/host): when judging a typed answer or a Final Buzz In answer, a hint says whether it **looks right**, is **close** (your call), or **doesn't match**, e.g. "Elephant" for "African elephant" is close. Choose **Off**, **Strict**, **Balanced** (default), or **Lenient** in **Settings → Rules**. Matching lives in [lib/answer-match.ts](./lib/answer-match.ts); answers like `Paris / Paree` or `Saturn (accept: the ringed planet)` list alternates.
- **Clue timer** (host, in **Settings → Timers**): toggle it on or off, pick 5–180 seconds, and choose whether running out of time reveals the answer or just locks the buzzers. The clock pauses while a player answers and resumes (minimum 3 seconds) after a wrong answer.
- **Final Buzz In** (owner/host, in **Settings → Timers**, on by default): when the last clue is closed (or the host ends the board early), every player wagers up to their current score and types an answer before the timer runs out (60 seconds by default, 15–300). Use a random hard question from a prefilled category that isn't on the board, or write your own. Wagers and answers stay hidden from other players until the host judges them and reveals the results.
- **Winner screen:** after the Final Buzz In (or the last clue, if it's off) everyone sees an animated podium. **Back to lobby** resets scores and clues for another game.
- **Audio** (everyone, in the account menu → **Audio settings**): **Global**, **Lobby music**, and **Sound effects** each have an on/off switch and a volume slider. Global scales and mutes the other two. Settings are saved in the browser (`localStorage`) and load automatically. Lobby music ([public/audio/lobby.wav](./public/audio/lobby.wav)) loops in the Buzz In lobby. Sound effects play when a clue opens (`buzz-in-clue.wav`) and when the host judges an answer correct or incorrect (`buzz-in-clue-correct.wav` / `buzz-in-clue-incorrect.wav`). Browsers block audio until you interact with the page, so music starts on your first click or key press after a reload.

## Admins

Admins are Discord accounts listed in `ADMIN_DISCORD_IDS` in [lib/auth/admins.ts](./lib/auth/admins.ts). Admin rights are checked on the party worker. Admins can:

- Delete any room from the room list or from inside the room.
- Use the room **Settings** drawer in any room (rename, privacy, team size, game mode, choose the host), plus rename teams and move players.
- Remove players from a room (they can't rejoin until someone lets removed players back in).

## Deployment

The party worker ([party/index.ts](./party/index.ts), configured in [wrangler.json](./wrangler.json)) deploys to your Cloudflare account on the custom domain `roundtable-api.dylandover.dev`, using SQLite-backed Durable Objects (supported on the Workers Free plan).

1. Create a Cloudflare API token from the **Edit Cloudflare Workers** template (it needs access to the account and the `dylandover.dev` zone for the custom domain).
2. Give the worker the same secret as the web app (one-time; it persists across deploys):

   ```bash
   npx wrangler secret put AUTH_SECRET
   ```

3. Deploy with `npm run deploy:party` (with `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` set, or after `npx wrangler login`). Pushes to `main`/`master` also deploy automatically via [.github/workflows/deploy-party.yaml](./.github/workflows/deploy-party.yaml), which needs the `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` repository secrets.

Production builds (`next build`) connect to the worker at `roundtable-api.dylandover.dev`; `next dev` connects to `localhost:1999`. Set `NEXT_PUBLIC_PARTYKIT_HOST` only to override that (for example, to test a production build against a local worker). Set `AUTH_SECRET` and the Discord variables in the web app's environment.

## Checks

```bash
npm run lint
npm run build
```
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
