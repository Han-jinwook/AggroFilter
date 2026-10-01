# 🛠️ 어그로필터 운영 & 트러블슈팅 가이드 (Operation & Troubleshooting)

본 문서는 어그로필터 로컬 자막 워커 데몬 구동 및 시스템 운영 시 참고하는 트러블슈팅 가이드입니다.

---

## 1. 로컬 자막 워커 데몬 (Caption Daemon) 상시 가동

모바일 및 웹 사용자가 유튜브 자막을 1초 만에 추출하여 즉시 분석할 수 있도록, 사장님 로컬 PC에서 상시 데몬을 가동합니다.

### 실행 방법
```bash
# Windows 상시 가동 배치 파일 (에러 발생 시 5초 자동 재시작)
D:\AggroFilter\run_caption_worker.bat

# 또는 Node.js 단독 실행
cd D:\AggroFilter
node scripts/caption_daemon.mjs
```

### 정상 가동 로그 예시
```
[Caption Daemon] 🚀 로컬 자막 추출 데몬 기동 완료! (간격: 1500ms)
[Caption Daemon] 🎯 일감 1건 접수: bI2JNE5Xljk
[Caption Daemon] ⚡ 자막 추출 성공: bI2JNE5Xljk (1284줄, 1301ms)
[Caption Daemon] 💾 상태 업데이트 완료: READY
```

---

## 2. 장애 상황별 대응 요령

### Q1. 로컬 PC가 꺼져 있거나 데몬이 멈춘 경우
- **시스템 동작**: 유저 화면에 에러(422)를 띄우지 않고, **202 Accepted (대기열 등록)** 카드가 표시됩니다.
- **코인**: 유저 코인은 단 1원도 차감되지 않습니다 (0C).
- **조치**: 사장님이 PC를 켜고 `run_caption_worker.bat`을 실행하면, 데몬이 대기 중인 일감(`PENDING`)을 감지하여 1초 만에 자막을 추출하고 백엔드 AI 분석을 자동 완주한 뒤 유저에게 이메일 알림을 보냅니다.

### Q2. 유튜브 IP 차단(429) 의심 시
- 가정용 초고속 인터넷 IP는 데이터센터(AWS/Netlify) IP와 달리 차단율이 극히 낮습니다.
- 데몬에 3회 연속 실패 감지 로직이 탑재되어 있으며, 장애 지속 시 텔레그램 봇으로 알림이 발송됩니다.
- 일시적 차단 발생 시 공유기 재부팅(IP 갱신) 또는 잠시 대기 후 재가동합니다.

### Q3. 자막 큐 상태 확인 쿼리 (Supabase DB: `iwzwiimyxfduuwulpugu`)
```sql
-- 대기 중인 작업 확인
SELECT f_video_id, f_status, f_created_at, f_error 
FROM t_caption_tasks 
WHERE f_status = 'PENDING' 
ORDER BY f_created_at ASC;

-- 최근 완료된 자막 작업 확인
SELECT f_video_id, f_status, LENGTH(f_transcript) as len, f_updated_at 
FROM t_caption_tasks 
ORDER BY f_updated_at DESC 
LIMIT 10;
```

---

*Last Updated: 2026-10-01 | Merlin Family OS*
