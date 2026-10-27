# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 2단계: 메모를 Supabase로 이동

- 가상 메모 4개를 Supabase의 public.notes 테이블에 저장했습니다.
- owner_id는 uuid 형식이며 아직 외래키를 연결하지 않았습니다.
- RLS를 활성화하고 anon과 authenticated의 테이블 접근 권한을 제거했습니다.
- 서버는 SUPABASE_URL과 SUPABASE_SECRET_KEY 환경변수로 DB에 연결합니다.
- 첫 화면은 /api/notes에서 메모를 불러오도록 변경했습니다.
- 현재 API에는 로그인 검사가 없으므로 누구나 가상 메모를 조회할 수 있습니다.
- data.json 두 개를 삭제하고 빌드 시 공개 메모 파일 복사를 중단했습니다.
- 배포 식별 파일 /aleph.json의 자동 생성은 유지합니다.
- X-Content-Type-Options: nosniff 헤더를 추가했습니다.

### 배포 후 확인할 항목

1. 첫 화면과 /api/notes에서 가상 메모 4개가 표시되는지 확인합니다.
2. /data.json이 404를 반환하는지 확인합니다.
3. /aleph.json의 step이 2이고 최신 커밋을 가리키는지 확인합니다.
4. 첫 화면 응답에 X-Content-Type-Options: nosniff가 있는지 확인합니다.
5. GitHub 최신 코드에서 이전 메모 본문과 실제 비밀키가 남아 있는지 검색합니다.

현재 변경 사항은 아직 배포 검증 전입니다.
이전 GitHub 커밋과 과거 배포에 공개된 메모 복사본은 남아 있을 수 있습니다.

## 3단계: 실제 로그인과 메모 관리

현재 구현 상태는 이 절을 기준으로 합니다. 위의 1·2단계 설명은 이전 단계 기록입니다.

- Supabase Auth로 회원가입·로그인·로그아웃 화면을 구현했습니다.
- 브라우저에는 프로젝트 URL과 Publishable key만 사용합니다.
- 서버 전용 키는 Vercel 환경변수에서만 읽습니다.
- /api/notes는 src/verify-login.mjs로 로그인 토큰을 검증합니다.
- 비로그인 요청과 유효하지 않은 토큰은 JSON 오류로 거부합니다.
- 새 메모의 owner_id는 서버가 검증한 사용자 ID로 저장합니다.
- 작성한 메모의 수정·삭제는 owner_id 조건으로 제한합니다.
- 로그인 사용자의 타인 메모 조회 제한은 4단계에서 추가할 예정입니다.
- 기존 가상 메모 4개와 DB의 RLS를 유지합니다.
- DB의 id 자동 생성과 service_role 쓰기 권한을 설정했습니다.
- /aleph.json 자동 생성과 nosniff 헤더를 유지합니다.

### API 경로

- GET /api/notes: 목록 조회
- GET /api/notes?id=숫자ID: 단건 조회
- POST /api/notes: 메모 추가
- PUT /api/notes?id=숫자ID: 작성한 메모 수정
- DELETE /api/notes?id=숫자ID: 작성한 메모 삭제

추가·수정 요청은 JSON으로 title과 content를 보냅니다.
content 대신 body도 지원합니다.
메모 추가 응답의 id를 이후 조회·수정·삭제에 사용합니다.

### 확인 방법

1. npm ci
2. npm run build -- --local
3. 배포 후 시크릿 창에서 비로그인 상태와 API 거부 확인
4. 회원가입·이메일 인증·로그인 후 시험용 가상 메모 추가·수정·삭제 확인
5. 로그아웃 후 목록이 사라지는지 확인
6. 저장점 커밋의 배포 완료 후 npm run bundle

로컬 문법 검사와 빌드는 통과했습니다.
3단계의 실제 배포·로그인·메모 관리 동작은 아직 확인 전입니다.
과거 커밋과 이전 배포의 공개 메모 복사본은 남아 있을 수 있습니다.


## 4단계: 메모 소유자별 접근 제한

이 절은 이전 단계 설명보다 우선합니다.

- 서버가 검증한 사용자 ID와 notes.owner_id를 비교하여 목록·개별 조회·수정·삭제를 본인 메모로 제한합니다.
- 추가 시 owner_id는 검증된 사용자 ID로 저장합니다.
- URL·본문의 owner_id 지정 요청은 거부합니다.
- 수정은 기존 행의 소유자를 검사하고, 새 행의 소유자도 본인으로 유지합니다.
- 개별 메모 응답은 {id,title,body}이며 수정 본문은 {title,body}를 지원합니다.
- GET·POST·PUT·DELETE /api/notes를 allowedRoutes에 기록합니다.
- 학습 DB에서 기존 가상 메모 네 건은 A, 시험 메모 한 건은 B에 연결했습니다.
- notes의 RLS를 활성화하고 본인 행에만 SELECT·INSERT·UPDATE·DELETE를 허용하는 정책을 적용했습니다.
- 권한 조회 결과 anon의 표 권한은 없고 authenticated에는 SELECT·INSERT·UPDATE·DELETE만 있습니다.
- 서버 전용 키를 사용하는 앱 API는 RLS와 별도로 소유자를 검사합니다.

확인 상태:
- API 문법 검사와 로컬 빌드 통과.
- 실제 4단계 배포 및 A/B 정상·거부 요청 검사는 아직 미실행.

재실행:
1. npm.cmd ci
2. npm.cmd run build -- --local
3. 커밋·푸시 후 배포 완료 확인.
4. A/B 각각 로그인하여 본인 메모 CRUD와 상대 메모 접근 거부 확인.
5. npm.cmd run bundle 후 artifacts/submission.json 점검.

## 5단계: 메모 요청을 서버 API로 통합

이 절은 이전 단계 설명보다 우선합니다.

- 브라우저의 메모 CRUD는 기존 /api/notes만 사용하므로 호출 코드는 변경하지 않았습니다.
- Supabase Auth 로그인은 유지합니다.
- public.notes의 PUBLIC·anon·authenticated 직접 접근 권한을 회수했습니다.
- 기존 메모, RLS 정책, 서버 전용 권한과 API의 로그인·소유자 검사는 유지합니다.
- originalApiUrl에 쿼리 없는 원본 메모 REST API 주소를 기록했습니다.
- 권한 회수 후 A 계정의 정상 CRUD를 확인했습니다.
- A 로그인 토큰으로 원본 DB 직접 조회가 거부됐습니다.
- 공개 키만 사용한 원본 DB GET·PATCH가 권한 오류로 거부됐습니다.
- 로컬 빌드 통과. 5단계 배포와 공식 채점은 아직 미실행입니다.
- 브라우저 공개 키 제거 가점은 아직 구현하지 않았습니다.

재확인:
1. npm.cmd run build -- --local
2. 커밋·푸시 후 /aleph.json의 단계와 커밋 확인
3. 앱의 정상 CRUD 및 비로그인·타인 메모 접근 거부 확인
4. 원본 DB 직접 접근 거부 확인
5. npm.cmd run bundle 후 점검 결과 확인

### 5단계 추가 개선: 로그인도 서버 API 사용

이 절은 앞의 공개 키 미구현 기록보다 우선합니다.

- 로그인·회원가입·토큰 갱신·로그아웃을 POST /api/auth로 처리하도록 변경했습니다.
- 브라우저의 Supabase SDK와 공개 키 설정 파일을 제거했습니다.
- 인증 서버는 요청마다 별도 클라이언트를 사용하고 허용 출처를 검사합니다.
- 브라우저 세션은 sessionStorage에 보관하며 메모 API의 토큰·소유자 검증은 유지합니다.
- allowedRoutes에 POST /api/auth를 추가했습니다.
- 인증 API와 브라우저 코드 문법 검사, 로컬 빌드, 공개 파일의 키 패턴·삭제 파일 참조 검사 통과.
- 변경 후 실제 로그인·갱신·로그아웃·CRUD 및 공식 재채점은 아직 미실행입니다.
- 배포 후 A/B 로그인과 정상 CRUD, 새로고침, 로그아웃 및 접근 거부를 다시 확인합니다.

## 6단계 저장점

- src/decider.mjs에 device_registered 규칙을 구현했습니다.
- 엔진이 검증해 전달한 deviceRegistered가 정확히 true일 때만 허용합니다.
- false이거나 필드가 없으면 deny와 device_not_registered를 반환합니다.
- 응답은 schema, requestId, decision, reasonCode, ruleIds의 다섯 필드를 유지합니다.
- aleph.config.json과 빌드·배포 식별·공격 점검의 단계 번호를 6으로 맞췄습니다.

### 재현 절차와 확인 결과

1. npm.cmd run decider:test
   - 등록 기기의 정상 가상 요청: 통과
   - 미등록 기기의 가상 요청: 통과
2. npm.cmd run build -- --local
   - 빌드 통과

가상 요청 테스트는 실제 기기 등록·mTLS 연결 또는 공식 심판 통과의 증거가 아닙니다.

## 7단계 저장점

- 기존 device_registered 규칙을 유지했습니다.
- 출처가 judge_fixture인 가상 신호에서 새벽 시간(0~5시), 낯선 네트워크, 최근 300초 안의 risk_signal 20건 이상이 모두 겹치면 step_up_required 규칙으로 추가 인증을 요구합니다.
- 지역 하나만으로 차단하지 않으며, 없거나 출처가 불명확한 신호를 정상값으로 만들어 채우지 않습니다.
- 엔진이 전달한 stepUp.verified가 true이고 authAgeSeconds가 0~900초이면 복합 이상 요청을 허용합니다.
- 토큰 원문을 기록하지 않습니다.

### 재현 절차와 결과

1. npm.cmd run decider:test
   - 등록 기기 정상 요청: 통과
   - 미등록 기기 거부: 통과
   - 복합 이상 요청 추가 인증: 통과
   - 재인증 확인값이 있는 복합 이상 요청 허용: 통과
2. npm.cmd run fixture:7
   - 정상 사건: allow
   - 복합 이상 사건: step_up
3. npm.cmd run build -- --local
   - 빌드 통과

위 결과는 가상 요청 테스트입니다.
실제 엔진의 같은 사용자 재로그인 확인 계약과 실제 자료 차단·재로그인 후 허용 흐름은 아직 검증하지 않았습니다.

## 8단계 저장점

- 메모 한 건 경로 /api/notes/:id를 추가했습니다.
- 기존 메모 API의 검증된 사용자와 owner_id 비교를 재사용합니다.
- 가상 반 공지 class-welcome을 /api/notices/:id로 구분했습니다.
- 공지 API는 로그인한 사용자의 GET만 허용합니다.
- resource_scope 규칙으로 메모 한 건과 공지 읽기를 구분합니다.
- 메모 전체 목록, export, 공지 쓰기, 강사 자료, 미등록 서비스, 중첩 경로, 경로 모양 불일치를 판정기에서 거부합니다.
- 기존 기기 등록 검사와 복합 이상 접속 추가 인증 규칙을 유지했습니다.
- allowedRoutes에는 GET /api/notes/:id와 GET /api/notices/:id만 등록했습니다.

### 확인 결과

- npm.cmd run decider:test: 4개 가상 테스트 통과
- npm.cmd run fixture:7: 정상 allow, 복합 이상 step_up
- 자원 경로 가상 테스트: 9개 통과
- npm.cmd run build -- --local: 통과

새 경로의 실제 배포 후 API 동작과 A/B 소유자 분리는 아직 확인하지 않았습니다.
resource_not_allowed 이유 코드의 운영 등록부 호환 여부는 아직 확인하지 못했습니다.
가상 테스트 통과를 실제 API 검사나 공식 심판 통과로 간주하지 않습니다.