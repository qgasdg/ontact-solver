# ontact-solver

문제 사진을 업로드하면 GPT-4o가 해설을 자동 생성하는 교실용 웹앱입니다.  
선생님 화면(`/image`)과 학생 화면(`/solution`)이 실시간으로 연동됩니다.

## 페이지 구성

| 경로 | 역할 |
|------|------|
| `/image` | 문제 이미지 표시 + 판서 여백. 사진 붙여넣기·업로드 가능 |
| `/solution` | GPT 풀이 표시. 사진 붙여넣기·업로드 가능 |
| `/history` | 이전 풀이 목록 (썸네일·이미지·풀이 링크) |
| `/{id}/image` | 특정 문제 이미지 (히스토리에서 연결) |
| `/{id}/gpt` | 특정 문제 풀이 (히스토리에서 연결) |
| `/admin` | 관리자 로그인 (유일한 공개 페이지) |

**연동 방식:** `/image` 또는 `/solution` 어느 쪽에서든 사진을 올리면 두 페이지가 동시에 업데이트됩니다 (2초 폴링).

## 시작하기

### 환경 변수 설정

`.env.local` 파일을 생성합니다.

```bash
# 필수
OPENAI_API_KEY=sk-...        # OpenAI API 키 (GPT-4o vision)

# 인증 (프로덕션 필수)
ADMIN_PASSWORD=...           # 관리자 로그인 비밀번호. 미설정 시 로컬 dev는 인증 생략,
                             #   프로덕션은 503으로 차단(fail-closed)
SESSION_SECRET=...           # 세션 토큰 서명 키. `openssl rand -hex 32`로 생성 권장.
                             #   미설정 시 코드 내 기본 salt가 쓰이므로 반드시 지정할 것

# 프로덕션 저장소 (Vercel KV / Blob — 로컬에서는 불필요, 파일시스템으로 대체됨)
KV_REST_API_URL=...          # 설정 시 문제 목록/현재 상태를 Vercel KV에 저장
BLOB_READ_WRITE_TOKEN=...    # 설정 시 업로드 이미지를 Vercel Blob에 저장
```

> 로그인은 `/admin`에서 하며, 실패 시 IP당 분당 5회로 제한됩니다(KV 환경).
> 비밀번호를 바꾸면 발급된 모든 세션이 무효화됩니다.

### 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 → `/history`로 자동 이동됩니다.

## 데이터 저장 위치

저장 백엔드는 환경에 따라 [`storage.ts`](src/lib/storage.ts)에서 자동 선택됩니다.

| 데이터 | 로컬 dev | 프로덕션 (Vercel) |
|--------|----------|-------------------|
| 업로드 이미지 | `public/uploads/` | Vercel Blob (`BLOB_READ_WRITE_TOKEN`) |
| 문제 목록 | `data/problems.json` | Vercel KV (`KV_REST_API_URL`) |
| 현재 문제 상태 | `data/current.json` | Vercel KV |

> 로컬은 파일시스템을 쓰므로 `data/`·`public/uploads/`가 그대로 보존됩니다.
> 프로덕션은 KV/Blob 환경변수가 설정돼 있어야 영속 저장되며, 미설정 시 파일시스템으로
> 폴백하므로 재배포 시 데이터가 초기화됩니다.

## 기술 스택

- **Next.js 16** (App Router)
- **GPT-4o** (OpenAI API, vision)
- **Tailwind CSS v4**
- **KaTeX** (수식 렌더링)
- **react-markdown** + remark-math / rehype-katex

## 개발 명령어

```bash
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
npm run lint    # ESLint
```
