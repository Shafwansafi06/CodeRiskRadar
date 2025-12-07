@echo off
REM Code Risk Radar - Forge App Setup Script (Windows)
REM Automates the initial setup and deployment

echo ==========================================
echo 🛡️  Code Risk Radar - Forge Setup
echo ==========================================
echo.

REM Step 1: Check prerequisites
echo 📋 Step 1: Checking prerequisites...
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed
    echo Please install Node.js 18+ from https://nodejs.org/
    exit /b 1
)
echo ✅ Node.js installed

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm is not installed
    exit /b 1
)
echo ✅ npm installed

where forge >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Forge CLI not found
    echo Installing Forge CLI globally...
    call npm install -g @forge/cli
    echo ✅ Forge CLI installed
) else (
    echo ✅ Forge CLI installed
)

echo.

REM Step 2: Check Forge authentication
echo 📋 Step 2: Checking Forge authentication...
echo.

forge whoami >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Not logged in to Forge
    echo Please login to Forge...
    forge login
)
echo ✅ Logged in to Forge

echo.

REM Step 3: Copy configuration files
echo 📋 Step 3: Setting up configuration...
echo.

if not exist manifest.yml (
    echo Copying Forge manifest...
    copy manifest.forge.yml manifest.yml
    echo ✅ manifest.yml created
) else (
    echo ⚠️  manifest.yml already exists, skipping
)

if not exist package.json (
    echo Copying package.json...
    copy package.forge.json package.json
    echo ✅ package.json created
) else (
    echo ⚠️  package.json already exists, skipping
)

echo.

REM Step 4: Install dependencies
echo 📋 Step 4: Installing dependencies...
echo.

echo Installing backend dependencies...
call npm install
echo ✅ Backend dependencies installed

echo Installing frontend dependencies...
cd frontend
call npm install
cd ..
echo ✅ Frontend dependencies installed

echo.

REM Step 5: Build frontend
echo 📋 Step 5: Building frontend...
echo.

cd frontend
call npm run build
cd ..

if exist frontend\build (
    echo ✅ Frontend built successfully
) else (
    echo ❌ Frontend build failed
    exit /b 1
)

echo.

REM Step 6: Deploy
echo 📋 Step 6: Deploying to Forge...
echo.

set /p DEPLOY_NOW="Ready to deploy? (y/n): "

if /i "%DEPLOY_NOW%"=="y" (
    forge deploy
    
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Deployment successful
        
        echo.
        echo 📋 Step 7: Installing to workspace...
        echo.
        
        set /p INSTALL_NOW="Install to workspace now? (y/n): "
        
        if /i "!INSTALL_NOW!"=="y" (
            forge install
            
            if !ERRORLEVEL! EQU 0 (
                echo ✅ Installation successful
            ) else (
                echo ❌ Installation failed
                echo You can install later with: forge install
            )
        ) else (
            echo ⚠️  Skipping installation
            echo Install later with: forge install
        )
    ) else (
        echo ❌ Deployment failed
        echo Check the errors above and try again with: forge deploy
        exit /b 1
    )
) else (
    echo ⚠️  Skipping deployment
    echo Deploy later with: forge deploy
)

echo.
echo ==========================================
echo 🎉 Setup Complete!
echo ==========================================
echo.
echo Next steps:
echo 1. Open a PR in your Bitbucket/GitHub repository
echo 2. Look for 'Code Risk Radar' in the PR sidebar
echo 3. Check logs: forge logs
echo.
echo Documentation:
echo - Deployment Guide: FORGE_DEPLOYMENT.md
echo - Frontend Integration: frontend\INTEGRATION_GUIDE.md
echo.
echo Useful commands:
echo   forge tunnel          # Start development tunnel
echo   forge logs            # View logs
echo   forge install --list  # List installations
echo.
echo Happy coding! 🚀

pause
