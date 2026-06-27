# AWS Deployment — single EC2 + Docker Compose

This deploys the whole stack to **one EC2 instance** running `docker compose`, giving you a single
public link (the instance's public DNS). It's the fastest path to the "live AWS link" deliverable and
costs almost nothing on a `t3.small`. The production-grade path (ECR + ECS Fargate + Atlas + ElastiCache)
is described at the end.

> **What I need from you to do this live:** AWS region, an EC2 **key pair** name, and whether you want a
> custom domain (optional). Everything below is copy-paste once the instance exists.

---

## 1. Provision the EC2 instance (console or CLI)

**Console:** EC2 → Launch instance
- **AMI:** Amazon Linux 2023 (or Ubuntu 22.04)
- **Type:** `t3.small` (2 GB RAM is comfortable for Mongo + Redis + 7 containers; `t3.micro` works for a demo)
- **Key pair:** select/create one (you'll SSH with it)
- **Security group — inbound rules:**
  | Type | Port | Source | Why |
  |------|------|--------|-----|
  | SSH | 22 | *your IP* | admin |
  | HTTP | 80 | 0.0.0.0/0 | the app |
  | HTTPS | 443 | 0.0.0.0/0 | (if you add TLS) |
- **Storage:** 20 GB gp3

**CLI equivalent** (fill in your values):
```bash
aws ec2 run-instances \
  --image-id ami-xxxxxxxx \           # Amazon Linux 2023 in your region
  --instance-type t3.small \
  --key-name YOUR_KEYPAIR \
  --security-group-ids sg-xxxxxxxx \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":20}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=dsa-sheet}]'
```

Note the **Public IPv4 DNS** (e.g. `ec2-3-110-x-x.ap-south-1.compute.amazonaws.com`) — that's your link.

---

## 2. Install Docker on the instance

```bash
ssh -i ~/path/to/key.pem ec2-user@<PUBLIC_DNS>

# Amazon Linux 2023:
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# Docker Compose v2 plugin:
sudo mkdir -p /usr/libexec/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/libexec/docker/cli-plugins/docker-compose
sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose

exit && ssh -i ~/path/to/key.pem ec2-user@<PUBLIC_DNS>   # re-login so the docker group applies
docker compose version
```

---

## 3. Get the code onto the instance

```bash
# Option A — git (push this repo to GitHub first, then):
git clone https://github.com/<you>/dsa-sheet.git && cd dsa-sheet

# Option B — copy from your laptop (no GitHub needed):
#   from your machine:
#   rsync -av --exclude node_modules --exclude .git ./dsa-sheet ec2-user@<PUBLIC_DNS>:~/
```

---

## 4. Configure secrets

```bash
cp .env.example .env
# Set strong values:
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/^INTERNAL_KEY=.*/INTERNAL_KEY=$(openssl rand -hex 24)/" .env
# MONGO_URL / REDIS_URL in .env are ignored by compose (it uses the internal service names),
# so you don't need to touch them for the single-EC2 setup.
```

> Using **MongoDB Atlas** instead of the in-compose Mongo? Remove the `mongo` service from
> `docker-compose.yml` and set each service's `MONGO_URL` to your Atlas SRV string. Same idea for
> **ElastiCache** Redis via `REDIS_URL`.

---

## 5. Build, start, seed

```bash
docker compose up -d --build
docker compose ps                                   # all services Up; mongo/redis healthy
docker compose exec content node services/content/src/seed.js   # load the DSA sheet
```

Open **`http://<PUBLIC_DNS>/`** in a browser — register, and you're live.
Register your first account → it becomes **admin**.

---

## 6. (Optional) HTTPS with a domain

If you point a domain at the instance, add TLS with Caddy or certbot. Simplest is to drop a
**Caddy** container in front (auto-Let's-Encrypt):

```yaml
# add to docker-compose.yml, and change nginx to not publish :80 directly
caddy:
  image: caddy:2
  ports: ["80:80", "443:443"]
  command: caddy reverse-proxy --from your.domain.com --to nginx:80
  volumes: [caddy_data:/data]
```

---

## 7. Operations cheat-sheet

```bash
docker compose logs -f gateway          # tail a service
docker compose restart progress         # restart one service (nginx re-resolves automatically)
docker compose pull && docker compose up -d --build   # deploy an update
docker compose down                     # stop everything (data persists in the mongo_data volume)
```

---

## 8. Production-grade path (beyond the assignment)

The code needs **no changes** — only where things run:

| Component | Single-EC2 (now) | Production |
|---|---|---|
| Compute | one EC2 + compose | **ECS Fargate**, one task/service, auto-scaled |
| Ingress | nginx on the box | **ALB** (TLS via ACM) → gateway target group |
| Images | built on the box | **ECR** (CI builds & pushes) |
| MongoDB | container | **MongoDB Atlas** (multi-AZ) |
| Redis | container | **ElastiCache** |
| Static SPA | nginx `web` container | **S3 + CloudFront** |
| Secrets | `.env` | **SSM Parameter Store / Secrets Manager** |

Because every dependency is injected via env vars (`*_URL`, `JWT_SECRET`, `INTERNAL_KEY`) and the
services are stateless, this is a configuration change, not a rewrite.
