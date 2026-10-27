# LabFlow

학생 연구자를 위한 개인 연구 노트입니다. 프로젝트별 실험 프로토콜과 연구 일정을 Supabase에 저장합니다.

- 사이트: https://lab-flow-theta.vercel.app
- 저장소: https://github.com/suhcab/LabFlow

## 제출 버전의 기능

| 구분 | 기능 | 동작 |
| --- | --- | --- |
| 메인 | 실험 프로토콜 작성·관리 | 실험 목적, 단계별 제목·준비물·장비·조건·주의 사항 입력, 단계 추가·순서 변경·삭제, 저장·조회 |
| 서브 1 | 연구 프로젝트 관리 | 프로젝트 생성, 목록 조회, 프로젝트명·주제·분야 검색 |
| 서브 2 | 연구 일정 관리 | 날짜·시간·종류·메모 입력, 일정 추가·수정·삭제·완료 처리 |
| 서브 3 | 회원 인증과 개인별 기록 | 이메일 회원가입·확인·로그인·로그아웃, 소유자별 접근 제한 |

데이터 분석, 실제 AI 검토, 프로젝트 진행률 편집은 제출 버전에 포함하지 않습니다. 미구현 메뉴와 고정 응답 AI 화면은 제거했습니다.

## 사용 순서

1. 사이트에서 회원가입하고 이메일의 확인 링크를 누른 뒤 로그인합니다.
2. **새 프로젝트**에서 프로젝트명·연구 주제·분야·선택 날짜를 입력하고 저장합니다.
3. 프로젝트 카드를 눌러 **실험 프로토콜**을 엽니다. 목적과 단계를 입력하고 **프로토콜 저장**을 누릅니다.
4. **연구 일정**에서 **일정 추가**를 눌러 날짜와 제목을 입력하고 저장합니다. 목록에서 수정·완료·삭제할 수 있습니다.
5. 새로고침하거나 로그아웃 후 다시 로그인하여 저장된 기록이 유지되는지 확인합니다.

저장하지 않은 기록이 있으면 이동·로그아웃·새로고침 전에 확인 메시지를 표시합니다.

## 실행과 검증

```bash
npm ci
npm run dev
```

Vercel용 검증:

```bash
npx tsc --noEmit
npx oxlint app/page.tsx components/auth-gate.tsx components/project-records.tsx lib/project.ts lib/supabase.ts
npm run build:vercel
```

`npm run build`는 기존 Cloudflare 빌드입니다. Vercel은 `vercel.json`에 따라 `npm run build:vercel`을 실행하고 `dist/vercel`을 배포합니다.

## Supabase 연결

로컬 `.env.local`과 Vercel Production 환경에 같은 프로젝트의 값을 설정합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

기존 프로젝트의 `NEXT_PUBLIC_SUPABASE_ANON_KEY`도 지원합니다. Secret key나 `service_role` 키는 브라우저 환경 변수에 넣지 않습니다. Vercel 환경 변수 변경 후에는 재배포해야 반영됩니다.

새 DB에서는 SQL Editor에서 `supabase/schema.sql`을 실행합니다. 이 스키마는 프로젝트 소유자 `user_id`와 RLS 정책을 포함하며, 비로그인 사용자의 테이블 접근은 차단합니다. 기존 DB를 변경할 때는 먼저 현재 스키마와 데이터를 확인합니다.

Supabase Authentication의 **Site URL**은 `https://lab-flow-theta.vercel.app`으로 설정합니다. 프로젝트가 일시중지되어 있으면 Dashboard에서 재개한 뒤 로그인과 저장을 확인합니다. 서비스 연결 오류를 해결하기 위해 이메일 확인이나 RLS를 해제하지 않습니다.

## 검증 기록

2026-10-06: DB 트랜잭션에서 본인 프로젝트·프로토콜·일정 저장·조회, 다른 사용자의 기록 차단, 비로그인 권한 차단을 확인했습니다. 검증 데이터는 롤백했습니다.

현재 제출 전 확인 항목과 실제 계정 검증 순서는 [공개 전 점검](docs/pre-public-check.md)에 기록합니다. [3차시 기록](docs/session-3.md)은 로그인 적용 이전의 개발 기록입니다.
