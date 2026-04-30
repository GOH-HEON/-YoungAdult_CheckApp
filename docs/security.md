# 보안 설계

## 접근 통제 원칙

- 기본 원칙: `anon/public`은 데이터 테이블 접근 금지
- 앱 데이터는 `authenticated` 사용자 중 `public.users.is_active = true`인 계정만 접근 허용
- 첫 로그인 사용자를 자동으로 관리자 승격하지 않음
- 관리자 계정은 반드시 운영자가 `auth.users` + `public.users`에 명시적으로 매핑
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
- `service role` 기반 조회 우회는 운영 DB의 읽기 전용 RLS 반영 전까지 페이지 단위로만 제한적으로 허용
- Server Action / Route Handler에서는 세션 클라이언트를 기본값으로 사용하고, `service role`을 일반 세션 대체용으로 사용하지 않음
- 응답 헤더 하드닝(`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`) 적용

## 운영 체크리스트

- Supabase Auth에서 공개 회원가입을 비활성화하거나 초대 기반으로만 운영
- 관리자 계정은 수동으로만 생성/매핑
- `supabase/ops/01_enable_readonly_roles.sql`를 운영 DB에 실제 반영
- Vercel에는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 프로젝트 환경변수로 저장
- 임원 계정 비밀번호는 공용으로 오래 유지하지 말고 주기적으로 교체

## 하드코딩 금지 원칙

- 로그인 계정/비밀번호 하드코딩 금지
- API 키/DB 연결값 하드코딩 금지
- 모든 민감값은 `.env.local` 또는 배포 플랫폼 시크릿으로 관리
