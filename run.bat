@echo off
setlocal

cd /d "%~dp0\java-backend"

set "JAVA_CMD=java"
set "JAVAC_CMD=javac"

echo ========================================================
echo Checking Java Environment...
echo ========================================================

:: 1. Kiểm tra xem máy đã cài Java chưa
where javac >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Da tim thay Java tren may tinh nay.
    goto compile
)

:: 2. Kiểm tra xem đã có sẵn thư mục JDK portable chưa
if exist "..\jdk\bin\javac.exe" (
    echo [OK] Da tim thay Portable Java trong thu muc du an.
    set "JAVA_CMD=..\jdk\bin\java.exe"
    set "JAVAC_CMD=..\jdk\bin\javac.exe"
    goto compile
)

:: 3. Nếu chưa có thì tự động tải về
echo [CANH BAO] May tinh nay chua cai dat Java!
echo [TUDONG] Dang tu dong tai Portable Java (JDK 17) ve du an cho ban...
echo Quá trinh nay co the mat vai phut tuy theo toc do mang. Xin vui long doi!
echo.

if not exist "..\jdk" mkdir "..\jdk"

:: URL tải JDK 17 cho Windows
set "JDK_URL=https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
set "ZIP_FILE=..\jdk\jdk.zip"

echo [1/3] Dang tai JDK...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%JDK_URL%' -OutFile '%ZIP_FILE%'"

echo [2/3] Dang giai nen JDK...
powershell -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '..\jdk\extracted' -Force"

echo [3/3] Dang cau hinh Portable Java...
for /d %%I in ("..\jdk\extracted\*") do (
    xcopy /e /y "%%I\*" "..\jdk\" >nul
)
rmdir /s /q "..\jdk\extracted"
del "%ZIP_FILE%"

echo [THANH CONG] Da chuan bi xong moi truong Java!
set "JAVA_CMD=..\jdk\bin\java.exe"
set "JAVAC_CMD=..\jdk\bin\javac.exe"
echo.

:compile
echo ========================================================
echo Compiling Java source code...
echo ========================================================
if not exist bin mkdir bin
"%JAVAC_CMD%" -d bin -cp "lib\mssql-jdbc.jar" src\main\java\vn\emarket\App.java

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Compilation failed! Please check your source code.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Compilation successful. Starting E-Market Backend...
start "" "http://localhost:8080/index.html"
"%JAVA_CMD%" -cp "bin;lib\mssql-jdbc.jar" vn.emarket.App

pause
