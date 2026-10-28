@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo   Family-Planner: Aenderungen hochladen
echo ==========================================
echo.
where git >/dev/null 2>nul
if errorlevel 1 (
  echo Git ist nicht installiert. Bitte zuerst Git installieren, siehe ANLEITUNG.md
  pause
  exit /b 1
)
if not exist ".git" (
  git init -b main
  git remote add origin https://github.com/leibi-tech/family-planner.git
)
git config user.name "leibi-tech"
git config user.email "leibi-tech@users.noreply.github.com"
git add -A
git commit -q -m "Update %date% %time%"
echo Hole zuerst den neusten Stand von GitHub ...
git pull --rebase origin main
if errorlevel 1 (
  echo FEHLER beim Abgleich mit GitHub. Bitte ein Foto dieses Fensters an Claude schicken.
  pause
  exit /b 1
)
git push -u origin main
echo.
if errorlevel 1 (
  echo FEHLER beim Hochladen. Bitte ein Foto dieses Fensters an Claude schicken.
) else (
  echo Fertig! In 1-2 Minuten ist die neue Version online:
  echo https://leibi-tech.github.io/family-planner/
)
echo.
pause
