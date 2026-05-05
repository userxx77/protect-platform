# VPS public domain and TLS (Caddy)

Single place to go from “default Caddy page” or broken HTTPS to **dashboard on `https://dashboard…`**, **API on `https://api…`**, with **Docker Compose** on **127.0.0.1:3000** (web) and **:3001** (api).

Scope: **Linux VPS** (Ubuntu-style), **system Caddy** on **80/443**, **no desktop required** — everything via SSH.

Related files in this repo:

- Example config: [`infra/caddy/Caddyfile.example`](../../infra/caddy/Caddyfile.example)
- On-server checks: [`scripts/verify-vps-routing.sh`](../../scripts/verify-vps-routing.sh)
- Optional boot helper: [`infra/systemd/protect-compose.service.example`](../../infra/systemd/protect-compose.service.example)

## 1. Diagnose (why you see the default Caddy page)

Caddy’s welcome page usually means **no site block matched** the request `Host`, **nothing listens on 443** for your daemon, or traffic never hits your Caddy.

Run from the repo root on the VPS (or anywhere with `docker` and `curl`):

```bash
chmod +x scripts/verify-vps-routing.sh
./scripts/verify-vps-routing.sh
```

Manual equivalents:

```bash
# Who owns 80 / 443 / app ports (expect caddy on 80+443; docker on 3000+3001)
sudo ss -tlnp | grep -E ':80 |:443|:3000|:3001' || true

# Compose project status
cd ~/protect-platform   # your clone path
docker compose ps

# Next.js and API without TLS (direct to published ports)
curl -sI -H 'Host: dashboard.sentra.gg' http://127.0.0.1:3000/api/health
curl -sI http://127.0.0.1:3001/ready

# Caddy / cert
sudo journalctl -u caddy -n 80 --no-pager
```

**If Docker does not listen on 3000/3001**, check `.env` for `WEB_PUBLISH_PORT` / `API_PUBLISH_PORT` and make your Caddyfile `reverse_proxy` targets match (often still `127.0.0.1:3000` and `127.0.0.1:3001`).

## 2. DNS and Cloudflare (TLS that actually works)

- Create **A records** (or AAAA if you use IPv6 end-to-end) for:
  - apex (`@`), `www`, `dashboard`, `api` → your VPS **public** IP.
- **Let’s Encrypt HTTP-01** (Caddy default) requires Cloudflare **DNS only (grey cloud)** on those hostnames **or** reachable plain HTTP from the internet to your origin on **:80**.
- If you must keep **proxied (orange cloud)**, use either:
  - **Cloudflare Origin Certificate** on Caddy (see comments in [`infra/caddy/Caddyfile.example`](../../infra/caddy/Caddyfile.example)), **or**
  - **DNS-01** (more setup; not covered here).

Without one of these, certificates fail or browsers show errors while Caddy still falls back to odd defaults.

## 3. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 4. No port conflicts

Only one stack should bind **80** and **443**. If **nginx**, **apache**, or a second **caddy** is installed:

```bash
sudo systemctl status nginx apache2 caddy 2>/dev/null | sed -n '1,5p'
```

Stop/disable the service you are **not** using for termination, then continue with Caddy.

## 5. Install Caddy and install the Caddyfile

**Ubuntu (official Caddy package)** — adjust if your distro differs:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Copy the example from your **cloned** repo (edit hostnames and ports first if needed):

```bash
cd ~/protect-platform
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d%H%M) 2>/dev/null || true
sudo cp infra/caddy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # set dashboard.* / api.* and apex redirects
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable caddy
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

TLS is automatic for public hostnames once DNS points here and :80 is reachable for ACME (unless you switched to Origin cert).

## 6. Application and `.env`

```bash
cd ~/protect-platform
git pull origin main
```

Ensure `.env` (use `./setup.sh` or your own template) has:

- `NEXTAUTH_URL` / `WEB_URL` = `https://dashboard.<your-domain>` (no trailing slash)
- `API_PUBLIC_URL` / `NEXT_PUBLIC_API_URL` = `https://api.<your-domain>`
- `API_BASE_URL=http://api:3001` for Compose services

Discord Developer Portal redirect:

`https://dashboard.<your-domain>/api/auth/callback/discord`

Then:

```bash
docker compose up -d --build
```

After changing **`NEXT_PUBLIC_*`**, rebuild web: `docker compose up -d --build web`.

## 7. Verify externally

On the VPS:

```bash
curl -sI "https://dashboard.sentra.gg/api/health"    # replace host
curl -sI "https://api.sentra.gg/ready"
```

Expect **HTTP 200** (or 302 to `/api/auth/signin` for browser HTML — health should still be OK).

In a browser: open the dashboard URL; you should see the Protect/Sentra UI, not Caddy’s default page.

## 8. Optional: ensure Compose after reboot

Containers use `restart: unless-stopped`, but Compose must have been started once. To bring the stack up automatically:

- See [`infra/systemd/protect-compose.service.example`](../../infra/systemd/protect-compose.service.example) — copy to `/etc/systemd/system/`, fix `WorkingDirectory` and user, then `systemctl enable --now protect-compose.service`.

## If it still fails

Collect **non-secret** output:

- `caddy version`
- First ~40 lines of `/etc/caddy/Caddyfile` (redact nothing — there should be no secrets)
- `sudo ss -tlnp | grep -E ':80|:443|:3000|:3001'`
- `docker compose ps`
- Last 50 lines: `sudo journalctl -u caddy -n 50 --no-pager`

Use that to see Host mismatch, ACME errors, or wrong upstream ports.
