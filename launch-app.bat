@echo off
title Inventory Management System
color 0A
cls

echo ===================================================
echo        INVENTORY MANAGEMENT SYSTEM LAUNCHER
echo ===================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Set the application directory - use the current directory
set APP_DIR=%~dp0
cd %APP_DIR%

:: Create necessary directories
echo Ensuring all necessary directories exist...
if not exist "public\uploads\" mkdir public\uploads
if not exist "public\downloads\" mkdir public\downloads
if not exist "backups\" mkdir backups
if not exist "backups\temp\" mkdir backups\temp
echo.

:: Check if .env file exists
if not exist ".env" (
    echo Creating .env file...
    echo DATABASE_URL="file:./prisma/dev.db" > .env
    echo PORT=3000 >> .env
    echo JWT_SECRET=your_jwt_secret_key >> .env
    echo SESSION_SECRET=your_session_secret_key >> .env
    echo.
)

:: Always install dependencies to ensure everything is up to date
echo Installing dependencies...
echo This may take a few minutes. Please wait...
echo.
    
call npm install
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo ERROR: Failed to install dependencies.
    echo Please run 'npm install' manually.
    echo.
    pause
    exit /b 1
)
    
echo Dependencies installed successfully!
echo.

:: Generate Prisma client (always do this to ensure it's up to date)
echo Generating Prisma client...
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo ERROR: Failed to generate Prisma client.
    echo.
    pause
    exit /b 1
)

:: Check if prisma directory exists
if not exist "prisma\" (
    color 0C
    echo ERROR: Prisma directory not found.
    echo Please make sure the application files are complete.
    echo.
    pause
    exit /b 1
)

:: Run migrations in development mode to create new migrations if needed
echo Running database migrations...
call node node_modules\prisma\build\index.js migrate dev
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo WARNING: Failed to run migrations in development mode.
    echo Attempting to deploy existing migrations...
)

:: Deploy migrations (this will run even if dev migrations fail)
echo Deploying database migrations...
call node node_modules\prisma\build\index.js migrate deploy
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo ERROR: Failed to deploy migrations.
    echo Please check your database and migration files.
    echo.
    pause
    exit /b 1
)

:: Check if database exists
if not exist "prisma\dev.db" (
    echo Setting up database...
    
    echo Seeding database with initial data...
    call npx prisma db seed
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo WARNING: Failed to seed database automatically.
        echo This might be because the seed command is not properly configured.
        echo Attempting manual seeding...
        echo.
        
        call node prisma/seed.js
        if %ERRORLEVEL% NEQ 0 (
            color 0C
            echo ERROR: Failed to seed database manually.
            echo You may need to run 'node prisma/seed.js' manually.
            echo.
            pause
            exit /b 1
        ) else (
            echo Database seeded successfully using manual method!
        )
    ) else (
        echo Database seeded successfully!
    )
    
    echo Database setup completed successfully!
    echo.
    
    echo First-time setup completed successfully!
    echo.
)

echo Preparing to start the application...
echo.

:: Start the application
echo Starting server...
start "Inventory App Server" /MIN cmd /c "npm run dev"

:: Wait for the server to start
echo Waiting for server to start...
echo This may take a moment...
timeout /t 15 /nobreak >nul

:: Open the browser
echo Opening application in browser...
start http://localhost:3000

echo.
color 0A
echo ===================================================
echo  Application is running at http://localhost:3000
echo ===================================================
echo.
echo  DEFAULT LOGIN CREDENTIALS:
echo  Username: admin
echo  Password: admin123
echo.
echo  The application is now running in a minimized window.
echo  To stop the application, close that window or press
echo  CTRL+C in that window.
echo.
echo  You can close this window now.
echo.
echo  Press any key to exit this launcher...
echo.

pause >nul
exit /b 0 