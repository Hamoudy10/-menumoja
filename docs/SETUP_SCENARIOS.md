# Setting Up a Client — Cheapest Production-Ready Scenarios

**The goal:** get a client live with as little cost as possible, but still safe (backups, HTTPS, real payments).
There are two ways to do it. This guide explains both, with costs and step-by-step instructions.

---

## Which option should you pick?

| | Option 1: Cloud (one system for all) | Option 2: Dedicated server (one per client) |
|---|---|---|
| Cost | ~KES 5,500/month total, shared | ~KES 1,000/month per client |
| Best for | Most clients, growing with you | Clients who want their own server (hotels, groups) |
| Who maintains it | You (one system) | You (one per client) |
| Setup time | ~30 minutes once | ~1–2 hours per client |
| Break-even | Best at 3+ clients | Best at 1–3 clients |

---

## OPTION 1: Cloud (recommended default)

Everything runs on YOUR servers. Clients just use their menus. You manage one system — updates and backups are done once for everyone.

### Costs (per month, all clients together)

| Item | Cost | Notes |
|---|---|---|
| Supabase Pro (PostgreSQL database) | ~USD 25 (~KES 3,500) | 8GB database, daily backups, never pauses |
| Backend hosting (Render/Railway — or a small VPS) | ~USD 5–20 (~KES 700–2,800) | Your API + M-Pesa callback |
| Frontend (Vercel free tier) | USD 0 | Your website + menu pages |
| Custom domain (optional) | USD 10 (~KES 1,400) | E.g., `menu.yourbrand.co.ke` |
| **Total** | **~USD 30–55 (~KES 4,200–7,700)/month** | For ALL clients combined |

### Step-by-step (one-time setup)

1. **Create a Supabase project** (supabase.com → New project). Copy the `DATABASE_URL`.
2. **Create a Render/Railway account** (or buy a VPS). Deploy the backend with these environment variables:
   - `DATABASE_URL` (from Supabase)
   - `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` (long random strings)
   - `ENCRYPTION_KEY` (32-character string)
   - `DEEPSEEK_API_KEY` (for AI features)
   - `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_CALLBACK_URL` (yours)
   - `FRONTEND_URL` (your website address)
3. **Deploy the frontend to Vercel** (free) and set `VITE_API_URL` to your backend address.
4. **Each new client** then only needs:
   - Their restaurant account created in the dashboard
   - Their logo, menu items, and brand colors added
   - Their **M-Pesa till/paybill number + passkey** entered in Settings (see MPESA_INTEGRATION.md)
   - QR codes printed (the system generates them for download)
5. **Backups:** Supabase Pro backs up automatically every day. That's it.

**You're done. ~30 minutes, and every future client costs you almost nothing extra.**

---

## OPTION 2: Dedicated server per client (when they ask for it)

The client gets their OWN copy of the system on their own server. Their data never mixes with anyone else's.

### Costs (per client, per month)

| Item | Cost | Notes |
|---|---|---|
| Small VPS (1 CPU, 2GB RAM, Ubuntu) — Hetzner/DigitalOcean/Contabo | ~USD 5–6 (~KES 700–1,000) | 2GB RAM is plenty for this system |
| Domain | ~KES 100–200/month (billed yearly ~KES 1,200–2,400) | E.g., `theirname.co.ke` |
| Off-site backup (Backblaze B2, optional) | ~KES 100–200 | Nightly database dump stored safely |
| **Total** | **~KES 1,000–1,400/month** | Per client |

### What you need before starting

- A domain (buy one for the client, e.g., on Namecheap/Truehost for ~KES 1,200–2,400/year).
- The client's **till/paybill number + passkey** (for M-Pesa — see MPESA_INTEGRATION.md).
- Docker installed on the server.

### Step-by-step (per client, ~1–2 hours)

1. **Buy the VPS** (Hetzner or DigitalOcean, Ubuntu 24.04, 2GB RAM, ~USD 5/month).
2. **Point the domain** to the server's IP address (set an A record, e.g., `clientname` → `123.45.67.89`). Wait up to an hour for it to activate.
3. **Log into the server** (SSH) and install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo apt install -y docker-compose-plugin
   ```
4. **Create the project folder** and paste this `docker-compose.yml` (provided by BadikuuTech):
   ```yaml
   services:
     db:
       image: postgres:16
       restart: always
       environment:
         POSTGRES_USER: menumoja
         POSTGRES_PASSWORD: <strong-password>
         POSTGRES_DB: menumoja
       volumes:
         - db-data:/var/lib/postgresql/data
     backend:
       build: ./backend
       restart: always
       environment:
         DATABASE_URL: postgresql://menumoja:<strong-password>@db:5432/menumoja
         JWT_ACCESS_SECRET: <random>
         JWT_REFRESH_SECRET: <random>
         ENCRYPTION_KEY: <32-char-random>
         DEEPSEEK_API_KEY: <your-key>
         MPESA_CONSUMER_KEY: <your-key>
         MPESA_CONSUMER_SECRET: <your-secret>
         MPESA_CALLBACK_URL: https://clientname.co.ke/api/v1/payments/mpesa/callback
         FRONTEND_URL: https://clientname.co.ke
       depends_on:
         - db
     frontend:
       build: ./frontend
       restart: always
     caddy:
       image: caddy:2
       restart: always
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile
         - caddy-data:/data
       depends_on:
         - backend
         - frontend
   volumes:
     db-data: {}
     caddy-data: {}
   ```
5. **Create the `Caddyfile`** (Caddy gives free HTTPS certificates automatically):
   ```
   clientname.co.ke {
       handle /api/* {
           reverse_proxy backend:3001
       }
       handle {
           reverse_proxy frontend:80
       }
   }
   ```
6. **Start everything**:
   ```bash
   docker compose up -d --build
   ```
7. **Set up M-Pesa** in the client's dashboard: Settings → Payments → enter their till/paybill number + passkey.
8. **Set up the nightly backup** (non-negotiable — this is their business data):
   ```bash
   # add to cron (crontab -e), runs at 3am daily
   0 3 * * * docker exec $(docker ps -qf name=db) pg_dump -U menumoja menumoja | gzip > /root/backups/menumoja-$(date +\%F).sql.gz
   # keep the last 14 backups
   0 4 * * * find /root/backups -name "*.sql.gz" -mtime +14 -delete
   ```
9. **Test the whole flow** before the client pays: open the menu link, place a test order, pay with M-Pesa, check the kitchen screen.

### Updating a client's system later

```bash
cd /root/menumoja && git pull && docker compose up -d --build
```

---

## Production checklist (both options)

- [ ] HTTPS works (padlock icon) on the menu link
- [ ] M-Pesa test payment arrives in the client's till/paybill
- [ ] Kitchen display shows a test order
- [ ] Receipt prints correctly
- [ ] Backups running (nightly)
- [ ] Client's logo and colors on the menu
- [ ] Staff have their PINs and know how to log in

## Warning — things clients ask for that you should avoid

- **Free tier database for real clients** — it has no backups and goes to sleep after 7 days. Pay the ~USD 25 for Pro once you have paying clients.
- **Skipping backups** — if their data is lost, you lose the client (and your reputation).
- **Using their home internet as a "server"** — power cuts and downtime will kill the deal. Always use a real cloud server.
