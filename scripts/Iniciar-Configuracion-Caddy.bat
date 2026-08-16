@echo off
setlocal
cd /d "%~dp0"
echo Iniciando el asistente de configuracion del servicio Caddy (BandesUpdates)...
echo Si Windows pide permisos de administrador, acepta.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0caddy-service-setup.ps1"
endlocal