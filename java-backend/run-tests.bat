@echo off
setlocal

cd /d "%~dp0"

if not exist src\test\java\vn\emarket\AppTest.java (
  echo [ERROR] Test file not found.
  exit /b 1
)

set "JAVA_CMD=java"
set "JAVAC_CMD=javac"

where javac >nul 2>nul
if %ERRORLEVEL% neq 0 (
  if exist "..\jdk\bin\javac.exe" (
    set "JAVA_CMD=..\jdk\bin\java.exe"
    set "JAVAC_CMD=..\jdk\bin\javac.exe"
  ) else (
    echo [ERROR] javac not found.
    exit /b 1
  )
)

if not exist bin mkdir bin

"%JAVAC_CMD%" -encoding UTF-8 -d bin -cp "lib\mssql-jdbc.jar" src\main\java\vn\emarket\App.java src\test\java\vn\emarket\AppTest.java
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Compilation failed.
  exit /b %ERRORLEVEL%
)

"%JAVA_CMD%" -cp "bin;lib\mssql-jdbc.jar" vn.emarket.AppTest
set "ERROR_CODE=%ERRORLEVEL%"
echo.
echo Press any key to exit...
pause >nul
exit /b %ERROR_CODE%
