# Roundtable

A realtime PartyKit game-night app: sign in with Discord or as a guest, browse open tables, split into owner-named teams, or play **Buzz In** with a live, animated big-screen preview.

## Development

Install dependencies:

```bash
npm install
```

Create `.env.local` from [.env.example](./.env.example). `AUTH_SECRET` is required (both Next.js and `partykit dev` read it); the Discord variables are optional — without them only guest sign-in is offered.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Run the web app and PartyKit worker in separate terminals:

```bash
npm run dev
```

```bash
npm run dev:party
```

Open [http://localhost](http://localhost). Next.js runs on port `80` and the local PartyKit worker runs on port `1999`.

## Sign-in

- **Discord** — OAuth2 with the `identify` scope only; just the username and avatar are kept. In the [Discord developer portal](https://discord.com/developers/applications) add the redirect `http://localhost/api/auth/discord/callback` (plus your production URL).
- **Guest** — pick a display name (2–24 characters). Guests can rename themselves from the account menu.

Sessions are HMAC-signed, `httpOnly` cookies. The browser exchanges the session for a 10-minute token (`/api/auth/party-token`) that the PartyKit worker verifies with the same `AUTH_SECRET`, so identities and admin rights can't be spoofed over the socket.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/` | Signed-out visitors | Landing page and sign-in. Signed-in users go straight to `/rooms`. |
| `/rooms` | Signed-in users | All open rooms, room creation, and search. |
| `/rooms/[slug]` | Signed-in users | The room: teams, Buzz In, and host/owner/admin controls. |
| `/rooms/[slug]/preview` | Anyone with the link | Read-only Buzz In board with scores and animated clue, timer, and answer reveals. Answers stay hidden until the host reveals them, so it's safe to cast to a TV. |

## Buzz In

- **Board:** the owner and host build the board in the **Clues** panel: 1–10 categories (5 by default) with 5 clues each. Rename a category inline, click any tile to write its clue and answer, or load prefilled content. Use a column's menu to load one prefilled category, or **Use prefilled board** to fill every column with random prefilled categories. Empty tiles are skipped during play.
- **Prefilled categories** live in [lib/buzz-in/categories](./lib/buzz-in/categories). To add one, create a file there and list it in `PREFILLED_CATEGORIES` in [lib/buzz-in/index.ts](./lib/buzz-in/index.ts).
- Players only receive a clue's text once it's picked, and the answer once it's revealed. The owner and host see everything, so neither can buzz; the host runs the game.
- Players buzz with the button or the <kbd>Space</kbd> key.
- **Game rules** (owner/host): players can either **say** their answer out loud or **type** it after buzzing. Typed answers are shown only to the owner and host, marked as needing judging, correct, or incorrect. Clues can be picked by the **host**, or by **players**: the last player to answer correctly picks the next clue, and the host can always pick instead.
- **Clue timer** (host tools): toggle it on or off, pick 5–180 seconds, and choose whether running out of time reveals the answer or just locks the buzzers. The clock pauses while a player answers and resumes (minimum 3 seconds) after a wrong answer.

## Admins

Admins are Discord accounts listed in `ADMIN_DISCORD_IDS` in [lib/auth/admins.ts](./lib/auth/admins.ts). Admin rights are checked on the PartyKit server. Admins can:

- Delete any room from the room list or from inside the room.
- Use owner controls in any room (rename, privacy, team size, game mode, choose the host, rename teams, move players).
- Remove players from a room (they can't rejoin until someone lets removed players back in).

## Deployment

Deploy the PartyKit worker with `npx partykit deploy` and give it the same secret with `npx partykit env add AUTH_SECRET`. Set `NEXT_PUBLIC_PARTYKIT_HOST` to the worker's host when building the Next.js app (defaults to `localhost:1999`), and set `AUTH_SECRET` and the Discord variables in the web app's environment.

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
