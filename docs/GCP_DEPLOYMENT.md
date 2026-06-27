# GCP Deployment — Compute Engine VM + Docker Compose (reverse-proxied)

This deploys the whole stack to **one Google Compute Engine VM** running `docker compose`, reached
through a single public URL. It documents the exact process used for the live demo, including how the
app is run **side-by-side with an existing application on the same VM** without disturbing it.

> **Live demo reference:** project `hunaru-two`, zone `us-central1-a`, instance `hunaruone001`
> (Ubuntu 22.04, e2-medium / 2 vCPU / 4 GB), external IP `34.121.111.10`,
> URL **http://dsa.34.121.111.10.nip.io**. Substitute your own values throughout.

---

## 0. Prerequisites

- A GCP project + a running **Compute Engine VM** (Ubuntu 22.04, ≥ 2 GB RAM; 4 GB comfortable).
- The `gcloud` CLI installed and authenticated as an account with access to the project:
  ```bash
  gcloud auth login you@example.com
  ```
- **Firewall** allowing inbound `tcp:80` (and `tcp:443` if you add TLS) to the VM. In the demo the VM
  carries the `web-server` tag and the project has a rule `allow-http-https` for `tcp:80,443` from
  `0.0.0.0/0`. SSH is via **IAP** (`allow-iap-ssh`, `35.235.240.0/20` → `tcp:22`, tag `iap-ssh`) — the
  VM has **no public SSH**, so all SSH below uses `--tunnel-through-iap`.

Verify the VM and firewall:
```bash
gcloud compute instances describe hunaruone001 --zone us-central1-a --project hunaru-two \
  --format="value(status, networkInterfaces[0].accessConfigs[0].natIP, tags.items.list())"
gcloud compute firewall-rules list --project hunaru-two \
  --format="table(name,direction,sourceRanges.list(),allowed[].map().firewall_rule().list(),targetTags.list())"
```

---

## 1. Connect to the VM (over IAP)

```bash
gcloud compute ssh hunaruone001 --zone us-central1-a --project hunaru-two \
  --account you@example.com --tunnel-through-iap
```

`scp` works the same way:
```bash
gcloud compute scp ./local-file hunaruone001:/tmp/ \
  --zone us-central1-a --project hunaru-two --account you@example.com --tunnel-through-iap
```

---

## 2. Coexisting with an existing app on the VM (important)

The demo VM already runs a separate site, **zavhy.com** (a Next.js app on `:3003` fronted by the host's
**nginx** on `:80`/`:443` with a Let's Encrypt cert) plus a local MongoDB on `127.0.0.1:27017`. To avoid
collisions we **do not** let this app take host ports 80/443. Instead:

- The app's own nginx (from `docker-compose.yml`) is bound to **`127.0.0.1:8080`** (loopback only).
- A **new, separate** server block is added to the **host** nginx that proxies our demo hostname →
  `127.0.0.1:8080`. The existing `zavhy.com` config is never edited.
- The app uses its **own Dockerized Mongo/Redis** (internal compose network) — it does *not* touch the
  host's MongoDB.

Check what already listens before you start:
```bash
sudo ss -ltnp           # look at :80 :443 :3003 :27017
sudo nginx -t           # confirm existing config is valid first
```

---

## 3. One-shot deploy script

Save as `/tmp/deploy-on-vm.sh` on the VM (or `scp` it up), then `sudo bash /tmp/deploy-on-vm.sh`.
It installs Docker, clones the **public** repo, isolates the port, writes `.env`, builds, and seeds.

```bash
#!/bin/bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

APP_DIR=/opt/dsa-sheet
REPO=https://github.com/raktimZee/dsa-sheet.git
DOMAIN="dsa.34.121.111.10.nip.io"     # <-- your hostname (see step 5)

# base tools + Docker Engine + compose plugin
apt-get update -y
apt-get install -y ca-certificates curl git openssl
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

# clone app
rm -rf "$APP_DIR"; git clone "$REPO" "$APP_DIR"; cd "$APP_DIR"

# bind the app's nginx to loopback:8080 (no clash with host nginx on 80/443)
sed -i 's#- "80:80"#- "127.0.0.1:8080:80"#' docker-compose.yml

# .env (fresh app secrets; fill MAIL_* with a Gmail App Password for OTP email)
cat > .env <<EOF
JWT_SECRET=$(openssl rand -hex 32)
INTERNAL_KEY=$(openssl rand -hex 16)
MONGO_URL=mongodb://mongo:27017
REDIS_URL=redis://redis:6379
GOOGLE_CLIENT_ID=
MAIL_USER=your-account@gmail.com
MAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM_NAME=AlgoSheet
ADMIN_EMAIL=admin@dsa.local
ADMIN_PASSWORD=Admin@12345
VITE_API_BASE=/api
VITE_GOOGLE_CLIENT_ID=
EOF

# build, start, seed
docker compose up -d --build
for i in $(seq 1 24); do
  if docker compose exec -T content node services/content/src/seed.js; then echo SEED_OK; break; fi
  sleep 10
done
docker compose ps
```

---

## 4. Host nginx reverse-proxy (separate server block)

Create `/etc/nginx/sites-available/dsa-sheet` (additive — does not touch the existing site):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dsa.34.121.111.10.nip.io;   # your hostname

    client_max_body_size 5m;                  # avatar uploads

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
}
```

Enable, validate, reload (never reload on a bad config):
```bash
sudo ln -sf /etc/nginx/sites-available/dsa-sheet /etc/nginx/sites-enabled/dsa-sheet
sudo nginx -t && sudo systemctl reload nginx
```

Because our `server_name` is specific, requests for that hostname route to our app while the existing
`default_server` (e.g. `zavhy.com`) keeps serving everything else.

---

## 5. Domain

- **Free / instant (used for the demo):** [`nip.io`](https://nip.io) wildcard DNS — `nip.io` resolves
  `<anything>.<ip>.nip.io` straight to that IP with **no registration**. The demo used
  `dsa.34.121.111.10.nip.io`. Just put it in `server_name`.
- **Your own domain:** create an **A record** for `dsa.yourdomain.com` → the VM's external IP, set it as
  the `server_name`, and reload nginx.

---

## 6. HTTPS (optional — for a real domain)

`nip.io` isn't worth a certificate for a short demo (and Let's Encrypt rate-limits it). With a **real
domain** pointed at the VM:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dsa.yourdomain.com     # adds 443 + auto-renew to our server block
```
(Requires `tcp:443` open in the GCP firewall.)

---

## 7. Verify

```bash
# externally
curl -s -o /dev/null -w "%{http_code}\n" http://dsa.34.121.111.10.nip.io/            # 200
curl -s -o /dev/null -w "%{http_code}\n" http://dsa.34.121.111.10.nip.io/api/content/sheet  # 401 (auth enforced)
# OTP email path (202 = email sent, 502 = mail broken)
curl -s -X POST http://dsa.34.121.111.10.nip.io/api/auth/register \
  -H 'content-type: application/json' -d '{"email":"you@example.com","password":"Test1234","name":"T"}' -w "\n%{http_code}\n"
```
The **first account to complete signup becomes admin**; everyone after is a student.

---

## 8. Updating after a code change

```bash
gcloud compute ssh hunaruone001 --zone us-central1-a --project hunaru-two \
  --account you@example.com --tunnel-through-iap --command '
  cd /opt/dsa-sheet && sudo git pull origin main &&
  sudo docker compose up -d --build <service>   # e.g. auth, or omit to rebuild all'
```
> Note: `docker-compose.yml` is locally modified on the VM (the `:8080` bind from step 3), so `git pull`
> stays clean as long as that file isn't changed upstream. If it is, re-apply the `sed` or use a
> `docker-compose.override.yml` instead.

---

## 9. Teardown (leaves the other app untouched)

```bash
gcloud compute ssh hunaruone001 --zone us-central1-a --project hunaru-two \
  --account you@example.com --tunnel-through-iap --command '
  cd /opt/dsa-sheet && sudo docker compose down -v
  sudo rm -rf /opt/dsa-sheet
  sudo rm -f /etc/nginx/sites-enabled/dsa-sheet /etc/nginx/sites-available/dsa-sheet
  sudo nginx -t && sudo systemctl reload nginx'
```

---

## Notes / gotchas

- **Secrets:** keep real values only in the VM's `.env` (gitignored). Never commit `.env`; rotate the
  Gmail App Password if it's ever exposed.
- **RAM:** Mongo + Redis + 5 Node services + nginx is fine on 4 GB. On 1–2 GB add a swap file
  (`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`).
- **OTP email in Spam:** Gmail-sent OTP often lands in **Spam/Promotions** of the recipient — check there.
- **Production-grade path:** GKE or Cloud Run for the services + MongoDB Atlas + Memorystore (Redis),
  fronted by a Google HTTP(S) Load Balancer. The single-VM compose setup above is the fast demo path.
