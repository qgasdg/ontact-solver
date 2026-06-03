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

**연동 방식:** `/image` 또는 `/solution` 어느 쪽에서든 사진을 올리면 두 페이지가 동시에 업데이트됩니다 (2초 폴링).

## 시작하기

### 환경 변수 설정

`.env.local` 파일을 생성하고 OpenAI API 키를 입력합니다.

```bash
OPENAI_API_KEY=sk-...
```

### 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 → `/history`로 자동 이동됩니다.

## 데이터 저장 위치

| 데이터 | 경로 |
|--------|------|
| 업로드 이미지 | `public/uploads/` |
| 문제 목록 | `data/problems.json` |
| 현재 문제 상태 | `data/current.json` |

> **배포 주의:** 파일 시스템을 그대로 사용하므로 Vercel 등 에페머럴 환경에서는 재배포 시 데이터가 초기화됩니다.  
> 데이터 영속성이 필요하다면 VPS/컨테이너 환경에서 운영하거나 `storage.ts`를 DB 기반으로 교체하세요.

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
