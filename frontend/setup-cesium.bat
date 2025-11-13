@echo off
REM Setup script for Cesium assets - Windows
REM This copies Cesium static assets from node_modules to public folder

echo.
echo ===============================================
echo   Copying Cesium Assets to Public Folder
echo ===============================================
echo.

REM Check if node_modules exists
if not exist "node_modules\cesium\Build\Cesium" (
    echo ERROR: Cesium package not found in node_modules
    echo Please run 'npm install' first
    exit /b 1
)

REM Copy Cesium assets to public folder
echo Copying Cesium assets...
xcopy /E /I /Y "node_modules\cesium\Build\Cesium" "public\cesium" >nul

if %errorlevel% == 0 (
    echo.
    echo SUCCESS: Cesium assets copied successfully!
    echo Location: public/cesium/
    echo.
    echo You can now start the development server with 'npm start'
    echo.
) else (
    echo.
    echo ERROR: Failed to copy Cesium assets
    exit /b 1
)

