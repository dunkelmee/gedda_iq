# Gedda IQ Arena - Setup Script
Write-Host "=== Gedda IQ Arena Setup ===" -ForegroundColor Cyan

# Backend
Write-Host "`n[1/2] Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "Backend install failed" -ForegroundColor Red; exit 1 }
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created backend/.env from example" -ForegroundColor Green
}
Set-Location ..

# Frontend
Write-Host "`n[2/2] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend install failed" -ForegroundColor Red; exit 1 }
if (-not (Test-Path ".env.local")) {
    "NEXT_PUBLIC_BACKEND_URL=http://localhost:4000" | Out-File ".env.local" -Encoding utf8
    Write-Host "Created frontend/.env.local" -ForegroundColor Green
}
Set-Location ..

Write-Host "`n=== Setup complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start the app:" -ForegroundColor Cyan
Write-Host "  Terminal 1: cd backend  && npm run dev   (runs on :4000)" -ForegroundColor White
Write-Host "  Terminal 2: cd frontend && npm run dev   (runs on :3000)" -ForegroundColor White
Write-Host ""
Write-Host "Then open http://localhost:3000 in two browser tabs to test!" -ForegroundColor Yellow
