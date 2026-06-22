# Nextron Electron

Electron 데스크톱 앱에서 React/Vite 렌더러와 Python FastAPI 백엔드를 함께 실행하는 프로젝트입니다.

이 저장소는 Electron을 처음 보는 개발자도 구조를 빠르게 파악할 수 있도록 앱 코드를 역할별 디렉토리로 나눕니다.

## 디렉토리 구조

```text
backend/                 Python FastAPI 백엔드
docs/                    개발/구조 문서
src/
  main/                  Electron main process 코드
  preload/               Electron preload script 코드
  renderer/              화면 UI 코드
forge.config.ts          Electron Forge 설정
vite.*.config.ts         Vite 빌드 설정
index.html               Renderer HTML 진입점
```

Electron을 처음 보면 `src/main`, `src/preload`, `src/renderer` 세 폴더부터 보면 됩니다.

- `src/main`: 앱 창 생성, 앱 생명주기, Python 백엔드 실행 관리
- `src/preload`: renderer에 노출할 안전한 IPC API
- `src/renderer`: 실제 화면 코드
- `backend`: FastAPI와 장비 통신 코드가 들어갈 Python 영역

## 빠른 시작

```powershell
npm install
npm.cmd run backend:create
npm.cmd run backend:install
npm start
```

이미 `nextron-electron-backend` Conda 환경이 있다면 아래 명령으로 Python 3.12 계열과 패키지를 맞춥니다.

```powershell
npm.cmd run backend:update-python
npm.cmd run backend:install
```

## 주요 명령

- `npm start`: Electron 앱 실행. Python 백엔드도 자동 실행됩니다.
- `npm.cmd run backend:dev`: Python 백엔드만 개발 모드로 실행합니다.
- `npm.cmd run backend:install`: Conda 환경에 Python 의존성을 설치합니다.
- `npm.cmd run check`: Electron/TypeScript lint와 Python 문법 검사를 함께 실행합니다.
- `npm.cmd run package`: Electron 앱 패키징을 검증합니다.

## 백엔드 실행 방식

Electron 시작 시 `src/main/python-backend.ts`가 Conda 환경 `nextron-electron-backend`에서 FastAPI 서버를 실행합니다.

```powershell
conda run --no-capture-output -n nextron-electron-backend python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
```

기본 포트 `8765`가 이미 사용 중이고 `/health`가 응답하면 기존 백엔드를 재사용합니다. 포트가 사용 중이지만 백엔드가 아니면 `8766`부터 빈 포트를 찾아 실행합니다.

## 추가 문서

- [개발 가이드](docs/development.md)
- [구조 설명](docs/architecture.md)
- [백엔드 가이드](backend/README.md)
- [환경 변수 예시](.env.example)
