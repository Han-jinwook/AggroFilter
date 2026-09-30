@echo off
title AggroFilter Caption Worker (Resident Daemon)
chcp 65001 > nul
cd /d "%~dp0"

echo ========================================================
echo   [AggroFilter] 24시간 로컬 자막 추출 데몬 기동
echo   - 모바일 및 웹 사용자의 자막 요청을 가정용 초고속망에서 1초 만에 추출합니다.
echo   - 종료하려면 창을 닫거나 Ctrl+C를 누르세요.
echo ========================================================

:loop
node scripts/caption_daemon.mjs
echo [Worker Warning] 데몬이 비정상 종료되었습니다. 5초 후 자동 재시작합니다...
timeout /t 5
goto loop
