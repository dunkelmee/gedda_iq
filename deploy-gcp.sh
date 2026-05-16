#!/usr/bin/env bash
# Gedda IQ Arena — Google Cloud Run deployment
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Docker installed and running
#   - A GCP project with billing enabled
#
# Usage:
#   chmod +x deploy-gcp.sh
#   ./deploy-gcp.sh YOUR_PROJECT_ID [REGION]
#
# REGION defaults to europe-west1. Other good choices: us-central1, asia-east1

set -euo pipefail

PROJECT_ID="${1:?'Usage: ./deploy-gcp.sh PROJECT_ID [REGION]'}"
REGION="${2:-europe-west1}"
REPO="gedda-iq"
AR_HOST="${REGION}-docker.pkg.dev"
AR_PATH="${AR_HOST}/${PROJECT_ID}/${REPO}"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Gedda IQ Arena — GCP Deployment        ║"
echo "╚══════════════════════════════════════════╝"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo ""

# ── 1. Enable required APIs ───────────────────────────────────────────────────
echo "▶ Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJECT_ID" --quiet

# ── 2. Artifact Registry repository ──────────────────────────────────────────
echo "▶ Creating Artifact Registry repository (if needed)..."
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" 2>/dev/null || true

gcloud auth configure-docker "$AR_HOST" --quiet

# ── 3. Build & deploy backend ─────────────────────────────────────────────────
echo ""
echo "▶ Building backend image..."
docker build -t "${AR_PATH}/backend:latest" ./backend
docker push "${AR_PATH}/backend:latest"

echo "▶ Deploying backend to Cloud Run..."
gcloud run deploy gedda-iq-backend \
  --image "${AR_PATH}/backend:latest" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated \
  --max-instances 1 \
  --min-instances 1 \
  --timeout 3600s \
  --set-env-vars "NODE_ENV=production" \
  --quiet

BACKEND_URL=$(gcloud run services describe gedda-iq-backend \
  --region "$REGION" --project "$PROJECT_ID" \
  --format="value(status.url)")
echo "  Backend URL: $BACKEND_URL"

# ── 4. Build & deploy frontend ────────────────────────────────────────────────
echo ""
echo "▶ Building frontend image (baking backend URL)..."
docker build \
  --build-arg "NEXT_PUBLIC_BACKEND_URL=${BACKEND_URL}" \
  -t "${AR_PATH}/frontend:latest" \
  ./frontend
docker push "${AR_PATH}/frontend:latest"

echo "▶ Deploying frontend to Cloud Run..."
gcloud run deploy gedda-iq-frontend \
  --image "${AR_PATH}/frontend:latest" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --quiet

FRONTEND_URL=$(gcloud run services describe gedda-iq-frontend \
  --region "$REGION" --project "$PROJECT_ID" \
  --format="value(status.url)")

# ── 5. Update backend CORS with final frontend URL ────────────────────────────
echo ""
echo "▶ Updating backend CORS (FRONTEND_URL)..."
gcloud run services update gedda-iq-backend \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --set-env-vars "NODE_ENV=production,FRONTEND_URL=${FRONTEND_URL}" \
  --quiet

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Deployment complete!                   ║"
echo "╚══════════════════════════════════════════╝"
echo "  Frontend : $FRONTEND_URL"
echo "  Backend  : $BACKEND_URL"
echo ""
echo "  Open $FRONTEND_URL in your browser to play."
echo ""
