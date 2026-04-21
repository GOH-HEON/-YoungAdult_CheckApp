# 보안 설계

## 접근 통제 원칙

- 기본 원칙: `anon/public`은 데이터 테이블 접근 금지
- 앱 데이터는 `authenticated` 사용자 중 `public.users.role = 'admin'` + `is_active = true`만 접근 허용
- 정책 함수: `public.is_admin_user()`
- 모든 주요 테이블(`members`, `newcomer_profiles`, `meetings`, `attendance_records`, `departments`, `meeting_types`, `users`)에 RLS 활성화

## 테이블별 RLS 방향

- `members`: 관리자만 조회/등록/수정 가능
- `newcomer_profiles`: 관리자만 조회/등록/수정 가능
- `meetings`: 관리자만 생성/조회/수정 가능
- `attendance_records`: 관리자만 생성/조회/수정 가능
- `departments`: 관리자만 관리 가능
- `meeting_types`: 관리자만 관리 가능
- `users`: 관리자 계정 정보만 관리자에게 노출

## 민감정보 보호 방향

- 연락처(`phone`)는 UI에서 마스킹 표시를 기본값으로 사용
- 클라이언트에 service role key 전달 금지
- `NEXT_PUBLIC_` 환경변수에는 anon key만 사용
- Server Component / Route Handler 경계에서만 서버 키 사용 가능

## 하드코딩 금지 원칙

- 로그인 계정/비밀번호 하드코딩 금지
- API 키/DB 연결값 하드코딩 금지
- 모든 민감값은 `.env.local` 또는 배포 플랫폼 시크릿으로 관리
