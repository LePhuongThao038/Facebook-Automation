@echo off
setlocal
set "videoenv=%LOCALAPPDATA%\PostResearch\video-env"
if not exist "%videoenv%\Scripts\python.exe" python -m venv "%videoenv%"
if errorlevel 1 goto failed
"%videoenv%\Scripts\python.exe" -c "import yt_dlp,imageio_ffmpeg" 2>nul
if errorlevel 1 "%videoenv%\Scripts\python.exe" -m pip install yt-dlp imageio-ffmpeg
if errorlevel 1 goto failed
"%videoenv%\Scripts\python.exe" "%~dp0video-helper.py"
:failed
pause
