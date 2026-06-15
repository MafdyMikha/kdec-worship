# KDEC Worship Platform v2 — Setup Guide

## Quick Start

```bash
npm install
npm run dev          # http://localhost:5173
```

## Supabase Setup (5 steps)

### 1. Create project
Go to supabase.com → New Project → choose Europe (Frankfurt) region

### 2. Run full schema
Supabase Dashboard → SQL Editor → paste `supabase-schema-FULL.sql` → Run

### 3. Add environment variables
Create `.env` in project root:
```
VITE_SUPABASE_URL=https://YOUR-ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```
Get these from: Supabase → Settings → API

### 4. Create admin account
- Supabase → Authentication → Users → Invite user (your email)
- Check email, set password, log in
- Supabase → Table Editor → profiles → set `is_admin = true` on your row

### 5. Invite your team
App → Invitations → Send Invitation → WhatsApp or Email

---

## Features

### Admin
- **Dashboard** — Overview with events + attendance quick links
- **Services** — Create/manage with setlist builder (drag, key edit, notes blocks)
- **Songs** — Bilingual library (English + Arabic)
- **People** — Full team directory with availability (7-day week)
- **Schedule** — Monthly calendar + list view
- **Attendance** — Generate QR codes, track check-in/check-out, reports
- **Events** — Create conferences/camps with RSVP polls (bilingual)
- **Reports** — 4 tabs: Overview, Songs, Team, Services
- **WhatsApp** — Notify team members directly from service detail
- **Invitations** — Invite via WhatsApp or Email

### Members (non-admin)
- **My Home** — Animated instrument display, upcoming services, confirm/excuse/sub buttons
- **Check In** — Scan QR or tap to check into attendance sessions
- **Events** — See events and RSVP
- **Profile** — Edit info, availability (full 7-day), password

### Service Detail
- **Setlist** — Drag to reorder, inline key editor, notes blocks (📝 Note, 🙏 Prayer, 📖 Reading, ⏸ Break)
- **Team** — Confirm/decline, request substitute with dropdown of available players
- **Practice** — Schedule practice, track attendance per member
- **Notes** — Rich service notes

---

## Deploy to Production

### Cloudflare Pages (FREE)
1. Push to GitHub
2. pages.cloudflare.com → Connect repo
3. Build: `npm run build`, Output: `dist`
4. Add env vars: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
5. Deploy

### Custom Domain
- Buy `.org` on Namecheap (~$12/yr)
- Add to Cloudflare Pages → Custom Domains
- SSL automatic

## Monthly Cost
| Tier | Cost |
|------|------|
| Starter (free Supabase + Cloudflare) | ~$1/mo (domain only) |
| Production (Supabase Pro + Cloudflare) | ~$26/mo |
| Self-hosted VPS (Hetzner) | ~$6/mo |
