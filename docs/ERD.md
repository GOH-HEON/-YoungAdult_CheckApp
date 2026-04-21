# ERD 설명

## 핵심 설계 원칙

- 인증은 Supabase Auth(`auth.users`)를 사용하고, 앱 권한 정보는 `public.users`로 분리합니다.
- 개인정보(이름, 연락처)를 포함할 수 있으므로 RLS를 전제로 설계합니다.
- 삭제는 soft delete 대신 `is_active` 중심으로 운영합니다.
- 출석 데이터 무결성을 위해 `attendance_records (meeting_id, member_id)` 유니크를 강제합니다.

## 테이블 관계 요약

- `users` 1 : N `meetings` (`created_by`)
- `users` 1 : N `attendance_records` (`checked_by`)
- `departments` 1 : N `members`
- `members` 1 : 0..1 `newcomer_profiles`
- `meeting_types` 1 : N `meetings`
- `meetings` 1 : N `attendance_records`
- `members` 1 : N `attendance_records`

## Mermaid ERD 코드

```mermaid
erDiagram
    USERS ||--o{ MEETINGS : creates
    USERS ||--o{ ATTENDANCE_RECORDS : checks
    DEPARTMENTS ||--o{ MEMBERS : belongs_to
    MEMBERS ||--o| NEWCOMER_PROFILES : has_profile
    MEETING_TYPES ||--o{ MEETINGS : classifies
    MEETINGS ||--o{ ATTENDANCE_RECORDS : has
    MEMBERS ||--o{ ATTENDANCE_RECORDS : tracked

    USERS {
      uuid id PK
      text email
      text name
      text role
      boolean is_active
      timestamptz created_at
      timestamptz updated_at
    }

    DEPARTMENTS {
      bigint id PK
      text name
      boolean is_active
      timestamptz created_at
      timestamptz updated_at
    }

    MEMBERS {
      uuid id PK
      text name
      text gender
      int birth_year
      date salvation_date
      text phone
      bigint department_id FK
      boolean is_active
      boolean is_newcomer
      timestamptz created_at
      timestamptz updated_at
    }

    NEWCOMER_PROFILES {
      uuid id PK
      uuid member_id FK
      text inviter_name
      text notes
      timestamptz registered_at
      timestamptz created_at
      timestamptz updated_at
    }

    MEETING_TYPES {
      bigint id PK
      text name
      boolean is_active
      timestamptz created_at
      timestamptz updated_at
    }

    MEETINGS {
      uuid id PK
      bigint meeting_type_id FK
      date meeting_date
      text title
      uuid created_by FK
      timestamptz created_at
      timestamptz updated_at
    }

    ATTENDANCE_RECORDS {
      uuid id PK
      uuid meeting_id FK
      uuid member_id FK
      text status
      text note
      uuid checked_by FK
      timestamptz checked_at
      timestamptz updated_at
    }
```
