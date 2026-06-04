@echo off
REM Wrapper that replaces the x (extract) command with x -snl (store symlinks as files)
REM to avoid symlink permission errors on Windows for electron-builder's winCodeSign extraction
set ARGS=%*
set CMD=%1
if "%CMD%"=="x" (
  "%~dp0..\node_modules\7zip-bin\win\x64\7za.exe" x -snl %ARGS:~2%
  exit /b 0
)
"%~dp0..\node_modules\7zip-bin\win\x64\7za.exe" %*
