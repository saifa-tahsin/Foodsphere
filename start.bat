@echo off
REM Foodsphere Meal Planner - simple launcher for Windows.
REM Starts a tiny local web server and opens the app in your browser.
REM (You can also just double-click index.html - the server is optional.)
cd /d "%~dp0"
echo.
echo  Foodsphere Meal Planner
echo  -----------------------
where python >nul 2>nul
if %errorlevel%==0 goto usepython
where py >nul 2>nul
if %errorlevel%==0 goto usepy
where npx >nul 2>nul
if %errorlevel%==0 goto usenode
goto nothing

:usepython
echo Starting with Python at http://localhost:8000  (close this window to stop)
start "" "http://localhost:8000/index.html"
python -m http.server 8000
goto end

:usepy
echo Starting with Python at http://localhost:8000  (close this window to stop)
start "" "http://localhost:8000/index.html"
py -m http.server 8000
goto end

:usenode
echo Starting with Node.js at http://localhost:8000  (close this window to stop)
npx --yes http-server -p 8000 -o /index.html
goto end

:nothing
echo.
echo  Python or Node.js was not found - that is fine!
echo  Just double-click index.html to open the app in your browser.
echo.
pause

:end
