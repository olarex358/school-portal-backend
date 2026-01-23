@echo off
title BAC School Portal
echo ==============================
echo  Starting BAC School Portal
echo ==============================

cd /d %~dp0

echo Starting server...
node server.js

echo.
echo Server stopped.
pause
