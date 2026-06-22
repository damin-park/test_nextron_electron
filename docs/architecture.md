# Architecture

이 프로젝트는 Electron 앱과 Python FastAPI 백엔드를 같은 데스크톱 앱 안에서 함께 다룹니다. Electron 코드가 익숙하지 않은 개발자를 위해 `src/` 아래를 Electron의 역할 단위로 나눕니다.

## 최상위 구조

```text
Nextron_Electron/
  backend/               Python FastAPI 백엔드
  docs/                  개발자 문서
  src/                   Electron 앱 코드
    main/                Electron main process
    preload/             Electron preload script
    renderer/            화면 UI
  forge.config.ts        Electron Forge 설정
  vite.main.config.ts    main process Vite 설정
  vite.preload.config.ts preload Vite 설정
  vite.renderer.config.ts renderer Vite 설정
  index.html             renderer HTML 진입점
```

루트에 남아 있는 `forge.config.ts`, `vite.*.config.ts`, `index.html`은 도구 설정과 진입점입니다. 일반적인 기능 개발은 대부분 `src/` 또는 `backend/` 안에서 이루어집니다.

## Electron 코드 구조

```text
src/
  main/
    main.ts              Electron 앱 시작점
    python-backend.ts    Python 백엔드 프로세스 실행/종료 관리
  preload/
    preload.ts           renderer에 안전한 API 노출
    preload.d.ts         window.backend 타입 선언
  renderer/
    renderer.ts          UI 진입점
    index.css            UI 스타일
```

## 프로세스 역할

```text
Electron main process
  - BrowserWindow 생성
  - 앱 단일 인스턴스 관리
  - Python FastAPI 서버 실행/종료
  - IPC handler 등록

Electron preload
  - renderer가 사용할 window.backend API 노출
  - renderer가 Node/Electron API에 직접 접근하지 않도록 경계 제공

Electron renderer
  - 사용자 화면 표시
  - window.backend API로 백엔드 상태 조회

Python backend
  - FastAPI 앱
  - 장비 통신과 업무 로직 담당
```

## 파일 책임

- `src/main/main.ts`: Electron 앱 생명주기, 창 생성, IPC 등록, 백엔드 시작 호출
- `src/main/python-backend.ts`: Conda 환경에서 Python 서버 실행, 포트 충돌 처리, 앱 종료 시 프로세스 종료
- `src/preload/preload.ts`: renderer에 허용할 API만 노출
- `src/preload/preload.d.ts`: renderer에서 `window.backend`를 타입 안전하게 사용하기 위한 선언
- `src/renderer/renderer.ts`: 현재 화면 진입점. React 도입 시 React mount 코드가 들어갈 위치
- `backend/app/main.py`: FastAPI 앱 진입점

## 백엔드 실행 정책

기본 Conda 환경은 `nextron-electron-backend`입니다. Python 실행 방식은 아래 순서로 결정됩니다.

1. `NEXTRON_PYTHON`이 있으면 해당 Python 실행 파일을 직접 사용합니다.
2. 없으면 `NEXTRON_CONDA_EXE` 또는 `conda` 명령을 사용합니다.
3. Conda 환경명은 `NEXTRON_CONDA_ENV` 또는 기본값 `nextron-electron-backend`입니다.

## 포트 정책

기본 주소는 `127.0.0.1:8765`입니다.

- `8765/health`가 정상 응답하면 이미 떠 있는 백엔드로 보고 재사용합니다.
- 포트가 점유되어 있지만 `/health`가 응답하지 않으면 `8765`부터 20개 범위에서 빈 포트를 찾습니다.
- 실제 선택된 URL은 `window.backend.getInfo()`로 renderer에 전달됩니다.

## 패키징 정책

`forge.config.ts`의 `extraResource` 설정으로 `backend/` 폴더가 패키징 결과의 `resources/backend`에 포함됩니다.

현재 단계에서는 Python 인터프리터나 Conda 환경 자체를 앱에 번들링하지 않습니다. 배포 단계에서는 아래 중 하나를 선택해야 합니다.

- 대상 PC에 Anaconda와 `nextron-electron-backend` 환경을 설치한다.
- Python 백엔드를 PyInstaller 등으로 실행 파일화한 뒤 Electron에서 해당 exe를 실행한다.
- 사내 설치 스크립트로 Conda 환경 생성과 앱 설치를 함께 처리한다.
