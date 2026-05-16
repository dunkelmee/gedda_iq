#!/usr/bin/env bash
# Gedda IQ Arena — GCP Always Free deployment (Compute Engine e2-micro)
#
# Free tier requirements (must use one of these zones):
#   us-central1-a, us-east1-b, us-west1-a
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Billing enabled on the project (required even for free tier)
#
# Usage:
#   chmod +x deploy-gcp-free.sh
#   ./deploy-gcp-free.sh YOUR_PROJECT_ID

set -euo pipefail

PROJECT_ID="${1:?'Usage: ./deploy-gcp-free.sh PROJECT_ID'}"
ZONE="us-central1-a"      # free-tier eligible zone
VM_NAME="gedda-iq-vm"
REPO_URL="https://github.com/dunkelmee/gedda_iq.git"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Gedda IQ — GCP Free Tier Deployment    ║"
echo "╚══════════════════════════════════════════╝"
echo "  Project : $PROJECT_ID"
echo "  Zone    : $ZONE  (e2-micro, Always Free)"
echo ""

# ── 1. Enable Compute Engine API ──────────────────────────────────────────────
echo "▶ Enabling Compute Engine API..."
gcloud services enable compute.googleapis.com --project="$PROJECT_ID" --quiet

# ── 2. Create the VM (skip if already exists) ─────────────────────────────────
echo "▶ Creating e2-micro VM..."
gcloud compute instances create "$VM_NAME" \
  --project="$PROJECT_ID" \
  --zone="$ZONE" \
  --machine-type=e2-micro \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=gedda-iq-server \
  2>/dev/null \
  && echo "  VM created." \
  || echo "  VM already exists, skipping."

# ── 3. Open firewall rules for ports 3000 and 4000 ───────────────────────────
echo "▶ Configuring firewall..."
gcloud compute firewall-rules create allow-gedda-iq \
  --project="$PROJECT_ID" \
  --allow=tcp:3000,tcp:4000 \
  --target-tags=gedda-iq-server \
  --description="Gedda IQ Arena — frontend (3000) and backend (4000)" \
  2>/dev/null || true

# ── 4. Bootstrap the VM: Docker + app ────────────────────────────────────────
echo "▶ Setting up Docker and deploying app on VM (this takes ~3 min)..."

gcloud compute ssh "$VM_NAME" \
  --zone="$ZONE" \
  --project="$PROJECT_ID" \
  --command="$(cat <<'REMOTE'

set -e

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "[VM] Installing Docker..."
  sudo apt-get update -qq
  sudo apt-get install -y docker.io docker-compose-plugin
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker "$USER"
fi

# ── Swap (e2-micro has 1 GB RAM; Next.js build needs headroom) ────────────────
if [ ! -f /swapfile ]; then
  echo "[VM] Creating 1 GB swap file..."
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# ── Clone / update repo ───────────────────────────────────────────────────────
REPO_DIR="$HOME/gedda_iq"
if [ -d "$REPO_DIR" ]; then
  echo "[VM] Pulling latest code..."
  git -C "$REPO_DIR" pull
else
  echo "[VM] Cloning repo..."
  git clone https://github.com/dunkelmee/gedda_iq.git "$REPO_DIR"
fi
cd "$REPO_DIR"

# ── Detect external IP and write .env for docker compose ─────────────────────
EXTERNAL_IP=$(curl -sf \
  -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip")
echo "[VM] External IP: $EXTERNAL_IP"
echo "FRONTEND_URL=http://$EXTERNAL_IP:3000" > .env

# ── Build and start ───────────────────────────────────────────────────────────
echo "[VM] Building and starting containers..."
sudo -E docker compose up --build -d

echo "[VM] Done."
REMOTE
)"

# ── 5. Get the external IP to print the final URL ────────────────────────────
EXTERNAL_IP=$(gcloud compute instances describe "$VM_NAME" \
  --zone="$ZONE" \
  --project="$PROJECT_ID" \
  --format="value(networkInterfaces[0].accessConfigs[0].natIP)")

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Deployment complete!                   ║"
echo "╚══════════════════════════════════════════╝"
echo "  Frontend : http://$EXTERNAL_IP:3000"
echo "  Backend  : http://$EXTERNAL_IP:4000"
echo ""
echo "  Note: The IP above is ephemeral — it may change if the VM"
echo "  is stopped and restarted. Reserve a static IP in the GCP"
echo "  console (VPC → External IP addresses) to make it permanent."
echo ""
echo "  To redeploy after a git push, just re-run this script."
echo ""
