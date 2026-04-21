# 청년부 출석 관리 웹앱 (관리자용 MVP)

교회 청년부 관리자를 위한 출석 관리 웹앱입니다.

- 기술 스택: Next.js(App Router), TypeScript, Tailwind CSS, Supabase, Recharts
- UI 언어: 한국어
- 용어 규칙:
  - "예배" 대신 "모임"
  - "청년" 대신 "형제/자매"
  - 성별 값은 "형제", "자매"만 사용

## 전체 기능 범위 (1~12단계 반영)

- 프로젝트 초기 세팅 및 공통 레이아웃/네비게이션
- DB 스키마/seed/ERD/RLS 초안
- Supabase Auth 로그인/로그아웃/보호 라우트
- 소속부서/모임 종류 관리 CRUD(활성/비활성 중심)
- 형제/자매 명단 CRUD + 검색/필터
- 새가족 등록(`members` + `newcomer_profiles` 연동)
- 출석 체크(모임 생성/조회 + upsert 저장)
- 출석 조회 전용 화면
- 운영 대시보드 요약 카드
- 리포트 차트(날짜별/모임별 + 추세선) 및 결석 누적자
- 보안/RLS 문서화
- 2차/3차 확장 설계 문서화

## 프로젝트 폴더 구조

```text
app/
  (admin)/
    attendance/
      check/page.tsx
      view/page.tsx
    dashboard/page.tsx
    members/
      [id]/edit/page.tsx
      new/page.tsx
      actions.ts
      page.tsx
    newcomers/
      actions.ts
      page.tsx
    reports/page.tsx
    settings/
      actions.ts
      page.tsx
    layout.tsx
  api/
    attendance/save/route.ts
  login/
    actions.ts
    page.tsx
  layout.tsx
  page.tsx
components/
  attendance/attendance-check-form.tsx
  layout/
    admin-nav.tsx
    admin-shell.tsx
  reports/attendance-report-charts.tsx
  ui/page-title.tsx
lib/
  auth/
    actions.ts
    session.ts
  constants/domain.ts
  reports/attendance-stats.ts
  supabase/
    client.ts
    env.ts
    middleware.ts
    server.ts
  utils/format.ts
supabase/
  schema.sql
  seed.sql
  rls.sql
docs/
  ERD.md
  security.md
  extensions.md
proxy.ts
```

## 페이지 라우트

- `/login`
- `/dashboard`
- `/members`
- `/members/new`
- `/members/[id]/edit`
- `/attendance/check`
- `/attendance/view`
- `/newcomers`
- `/reports`
- `/settings`

## 로컬 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 환경변수

`.env.local.example`를 복사해 `.env.local` 작성:

```bash
cp .env.local.example .env.local
```

필수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

선택(서버 전용):

- `SUPABASE_SERVICE_ROLE_KEY`

주의:

- `service role key`는 절대 클라이언트에 노출하면 안 됩니다.
- 클라이언트에는 `NEXT_PUBLIC_*` 값만 사용합니다.

## Supabase 연결 방법

1. Supabase 프로젝트 생성
2. Authentication에서 이메일/비밀번호 로그인 활성화
3. SQL Editor에 `supabase/schema.sql` 실행
4. 필요 시 `supabase/seed.sql` 실행
5. 최소 1개 관리자 계정을 `auth.users` + `public.users`에 준비

`public.users` 부트스트랩 예시:

```sql
insert into public.users (id, email, name, role, is_active)
select id, email, '관리자', 'admin', true
from auth.users
where email = 'admin@example.com'
on conflict (id) do nothing;
```

## DB 구조

- 스키마: `supabase/schema.sql`
- 시드: `supabase/seed.sql`
- RLS 예시: `supabase/rls.sql`
- ERD 설명 + Mermaid: `docs/ERD.md`

핵심 무결성:

- `attendance_records (meeting_id, member_id)` unique
- `attendance_records.status` 허용값: `정상출석`, `지각`, `결석`, `행사`
- `updated_at` 트리거 기반 자동 관리
- soft delete 대신 `is_active` 중심

## 인증/권한 구조

- 로그인: Supabase Auth(email/password)
- 보호 라우트: `proxy.ts` + `(admin)` 레이아웃 세션 검사
- 로그아웃: 서버 액션
- role 확장 여지:
  - 현재 `public.users`의 `role`, `is_active` 필드로 확장 가능 구조 제공

## 보안 주의사항

자세한 내용: `docs/security.md`

핵심 원칙:

- 민감정보 하드코딩 금지
- anon/public 직접 접근 차단(RLS)
- 관리자만 접근 가능한 정책 적용
- 연락처 UI 마스킹 기본 적용
- 서버/클라이언트 코드 경계 명확화

## 배포 방법

### Vercel 배포 예시

1. Git 저장소 연결 후 Vercel 프로젝트 생성
2. 환경변수 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Build Command: `npm run build`
4. Output: Next.js 기본 설정 사용
5. 배포 후 `/login`에서 관리자 계정 로그인 확인

## 리포트 계산 로직

- 위치: `lib/reports/attendance-stats.ts`
- 출석률 계산:
  - `(정상출석 + 지각 + 행사) / 전체 대상 인원`
- 추세선:
  - 선형 회귀 기반 trend line 계산
- 확장 가능:
  - 추후 SQL View/Stored Procedure 또는 서버 전용 통계 API로 이관 용이

## 2차/3차 확장 포인트

자세한 내용: `docs/extensions.md`

- 2차: `member_notes` 기반 형제/자매 특이사항 히스토리
- 3차: `message_logs` 기반 카카오 알림 자동화/감사 로그

## 참고 문서

- ERD: `docs/ERD.md`
- 보안: `docs/security.md`
- 확장: `docs/extensions.md`
