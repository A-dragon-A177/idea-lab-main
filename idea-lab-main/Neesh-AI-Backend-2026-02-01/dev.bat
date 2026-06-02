@echo off
echo Starting Neesh AI Development Environment...

IF "%SUPABASE_JWT_SECRET%"=="" (
    echo [WARNING] SUPABASE_JWT_SECRET environment variable is not set.
    echo Backend may fail to start.
    echo Please set it using: set SUPABASE_JWT_SECRET=your_secret_here
    pause
)

REM Start Backend
start "Neesh AI Backend" cmd /k "mvn spring-boot:run"

REM Start AI Service
cd ai-service
start "Neesh AI Service" cmd /k "npm run dev"
cd ..

REM Start Frontend
cd ..
start "Neesh AI Frontend" cmd /k "npm run dev"

echo Services starting...
echo AI Service: http://localhost:3000
echo Backend: http://localhost:8081
echo Frontend: http://localhost:7000
