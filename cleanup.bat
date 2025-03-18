@echo off
echo ===================================================
echo        INVENTORY MANAGEMENT SYSTEM CLEANUP
echo ===================================================
echo.
echo This will delete:
echo  - node_modules (all dependencies)
echo  - .next (build files)
echo  - prisma/dev.db (database)
echo  - public/uploads/* (uploaded files)
echo  - public/downloads/* (downloadable files)
echo  - backups/* (database backups)
echo.
echo All data will be lost!
echo.

set /p confirm=Are you sure you want to continue? (y/n): 
if /i not "%confirm%"=="y" (
    echo.
    echo Cleanup cancelled.
    exit /b
)

echo.
echo Cleaning up...

:: Stop any running Node.js processes
taskkill /f /im node.exe >nul 2>&1

:: Remove node_modules
if exist node_modules (
    echo Removing node_modules...
    rmdir /s /q node_modules
)

:: Remove .next folder
if exist .next (
    echo Removing .next folder...
    rmdir /s /q .next
)

:: Remove database
if exist prisma\dev.db (
    echo Removing database...
    del /f /q prisma\dev.db
)

:: Clean uploads directory
if exist public\uploads (
    echo Cleaning uploads directory...
    del /f /q public\uploads\* 2>nul
)

:: Clean downloads directory
if exist public\downloads (
    echo Cleaning downloads directory...
    del /f /q public\downloads\* 2>nul
)

:: Clean backups directory
if exist backups (
    echo Cleaning backups directory...
    del /f /q backups\* 2>nul
)

echo.
echo Cleanup completed successfully!
echo.
echo You can now run launch-app.bat to set up the application again.
echo.
pause 