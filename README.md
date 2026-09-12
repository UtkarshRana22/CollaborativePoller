# Collaborative Poller

A live, multi-user polling app built for the **GitHub Community SRM (GCSRM) Recruitment 2026 — Technical Track: Web Development**, **Option A: Build a Mini Collaborative App**.

**Live demo:** https://collaborative-poller-jchhyslmf-rsmsiss.vercel.app/

Users sign up, create polls with multiple options (single-choice or multi-select), vote in real time, and watch results update live across every open browser without a refresh — powered by Supabase Realtime.

## Features

- **Auth** — email/password signup and login via Supabase Auth.
- **Poll creation** — a question (3–280 chars) and 2–10 options, with an optional "allow multiple selections" toggle.
- **Voting** — single-choice (radio) or multi-select (checkbox) depending on the poll, with double-voting prevented per user per poll.
- **Ownership & permissions** — only a poll's creator can edit or delete it; everyone else can vote once.
- **Real-time sync** — the home feed and each poll's detail page subscribe to Postgres changes over Supabase Realtime, so new polls, vote count updates, edits, and deletions appear instantly for every connected user with no polling or manual refresh.
- **Edit polls** — owners can rename the question, add/remove/rename options, and toggle multi-select after creation. Options left with unchanged text keep their existing votes; reworded or new options start at zero.
- **Soft delete** — deleting a poll archives its final question, options, and results into a `deleted_polls` table (rather than destroying the data outright), and the owner can review their deleted polls' results later from a dedicated page.
- **Image uploads** — up to 4 images can be attached to a poll at creation time, stored in Supabase Storage and shown on both the feed and the poll's detail page.
- **Search** — a search box on the home feed filters polls by question or option text.
- **Responsive UI** — works down to phone width.
- **Graceful states** — loading skeletons, empty states, and error banners for failed loads, plus client-side form validation on poll creation/editing (length limits, option count, uniqueness).
- **Dark mode** — a theme toggle with the choice persisted and applied before first paint (no flash of the wrong theme).

## Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4
- **Backend/data:** Supabase — Postgres, Auth, Realtime, and Storage
- **Business logic:** Postgres `SECURITY DEFINER` functions (`cast_vote`, `edit_poll`, `delete_poll`) are the only write path for cross-cutting operations, so vote validation, ownership checks, and count/percentage math are enforced at the database layer rather than trusted to the client.
- **Deployment:** Vercel

## Architecture

```
src/
  app/
    layout.js              root layout, theme init script
    page.js                home feed — poll list, search, realtime subscription
    login/, signup/         auth pages
    new/                    poll creation (question, options, multiple toggle, image upload)
    poll/[pollid]/          poll detail — voting, owner edit/delete, realtime updates
    deleted/                a user's archived/deleted polls and their final results
  components/
    ThemeToggle.js          dark mode toggle
  lib/
    supabase.js             Supabase browser client
```

### Data model

- **`polls`** — `pollid`, `question`, `uid` (creator), `options[]`, `count[]`, `percentage[]`, `voters` (distinct people who've voted), `multiple`, `images[]`, `created_at`.
- **`users`** — `uid`, `votes[]` (poll ids voted on), `polls[]` (poll ids created), `deleted_polls[]` (poll ids deleted), `created_at`. Auto-created on signup via a trigger.
- **`deleted_polls`** — a frozen snapshot of a poll's final state at the moment it was deleted (mirrors `polls`, plus `deleted_at`).

Row Level Security is enabled on every table; the `SECURITY DEFINER` functions above are what let a vote or an edit safely touch rows/columns beyond what a user could otherwise write directly (e.g. incrementing another poll's vote counts), while still enforcing ownership and validation server-side.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Supabase credentials are configured in `src/lib/supabase.js`.

## Deliverables

- **GitHub repository:** this repo
- **Live demo:** https://collaborative-poller-jchhyslmf-rsmsiss.vercel.app/
- **Video walkthrough:** demonstrates two sessions voting on the same poll and seeing each other's results update live (see submission)
