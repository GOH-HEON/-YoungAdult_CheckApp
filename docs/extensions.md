# 2차/3차 확장 포인트

## 2차 확장: 형제/자매별 특이사항 누적

### 권장 테이블: `member_notes`

- `id`
- `member_id`
- `note_type`
- `content`
- `recorded_by`
- `recorded_at`
- `is_private`

### 설계 방향

- 임원모임 공유 내용을 `member_notes`에 누적 저장
- 시간순 히스토리 조회(`member_id`, `recorded_at desc` 인덱스)
- `is_private`로 민감도 구분
- role 기반으로 조회 범위 분리(예: 전체 관리자 / 담당자 한정)

## 3차 확장: 카카오톡 알림 자동화

### 권장 테이블: `message_logs`

- `id`
- `member_id` 또는 수신자 식별 정보
- `message_type`
- `payload`
- `status`
- `sent_by`
- `sent_at`
- `external_response_id`

### 설계 방향

- 카카오 연동은 반드시 서버 측에서 처리
- 외부 API 키 하드코딩 금지, 서버 시크릿으로 관리
- 발송 결과/실패 사유를 `message_logs`에 저장
- 관리자 승인 기반 발송 플로우(미리보기 -> 승인 -> 발송) 권장
