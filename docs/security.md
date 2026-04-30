# 보안 설계

## 접근 통제 원칙

- 기본 원칙: `anon/public`은 데이터 테이블 접근 금지
- 앱 데이터는 `authenticated` 사용자 중 `public.users.is_active = true`인 계정만 접근 허용
- 권한 분리:
  - `admin`: 조회/등록/수정/삭제 허용
  - `viewer`/`staff`: 조회만 허용
- 정책 함수:
  - `public.is_read_user()`: 조회 권한 판정
  - `public.is_admin_user()`: 쓰기 권한 판정
- 모든 주요 테이블(`members`, `newcomer_profiles`, `meetings`, `attendance_records`, `departments`, `meeting_types`, `users`)에 RLS 활성화

## 테이블별 RLS 방향

- `members`: 활성 계정 조회 허용, 쓰기는 관리자만 허용
- `newcomer_profiles`: 활성 계정 조회 허용, 쓰기는 관리자만 허용
- `meetings`: 활성 계정 조회 허용, 쓰기는 관리자만 허용
- `attendance_records`: 활성 계정 조회 허용, 쓰기는 관리자만 허용
- `departments`: 활성 계정 조회 허용, 쓰기는 관리자만 허용
- `meeting_types`: 활성 계정 조회 허용, 쓰기는 관리자만 허용
- `users`: 본인 행 또는 관리자만 조회, 쓰기는 관리자만 허용

## 민감정보 보호 방향

- 연락처(`phone`)는 UI에서 마스킹 표시를 기본값으로 사용
- 임원(읽기 전용) 계정은 저장/삭제/Import/Export 경로 접근 금지
- 클라이언트에 service role key 전달 금지
- `NEXT_PUBLIC_` 환경변수에는 anon key만 사용
- Server Component / Route Handler 경계에서만 서버 키 사용 가능
- 응답 헤더 하드닝(`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`) 적용

## 하드코딩 금지 원칙

- 로그인 계정/비밀번호 하드코딩 금지
- API 키/DB 연결값 하드코딩 금지
- 모든 민감값은 `.env.local` 또는 배포 플랫폼 시크릿으로 관리
