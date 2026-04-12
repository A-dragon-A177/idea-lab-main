# ─── Neesh AI Service Startup Script ───────────────────────────────────────
# Kills any stale process on port 3000 before starting to prevent EADDRINUSE.
# Run from: ai-service directory
# Usage:    .\start-ai-service.ps1

Write-Host "[Startup] Checking for stale process on port 3000..." -ForegroundColor Cyan

$existing = netstat -ano | Select-String ":3000\s+.*LISTENING"
if ($existing) {
    # Extract PID from netstat output (last column)
    $pid3000 = ($existing -split '\s+')[-1]
    Write-Host "[Startup] Found process PID $pid3000 on port 3000. Killing it..." -ForegroundColor Yellow
    try {
        Stop-Process -Id $pid3000 -Force -ErrorAction Stop
        Start-Sleep -Seconds 2
        Write-Host "[Startup] Killed PID $pid3000." -ForegroundColor Green
    } catch {
        Write-Host "[Startup] Could not kill PID ${pid3000}: $_" -ForegroundColor Red
    }
} else {
    Write-Host "[Startup] Port 3000 is free." -ForegroundColor Green
}

# Build TypeScript
Write-Host "[Startup] Building TypeScript..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Startup] Build FAILED. Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "[Startup] Build successful." -ForegroundColor Green

# Stop any existing PM2 ai-service instance
Write-Host "[Startup] Stopping any existing PM2 ai-service instance..." -ForegroundColor Cyan
npx pm2 stop ai-service 2>$null
npx pm2 delete ai-service 2>$null

Start-Sleep -Seconds 2

# Start fresh with PM2
Write-Host "[Startup] Starting ai-service with PM2..." -ForegroundColor Cyan
npx pm2 start ecosystem.config.js

Write-Host "[Startup] AI Service started. Tailing logs:" -ForegroundColor Green
npx pm2 logs ai-service --lines 30
