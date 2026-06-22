# Development Guide

이 문서는 프로젝트를 처음 보는 개발자가 환경을 맞추고 실행하는 절차를 설명합니다.

## 먼저 봐야 할 위치

```text
src/main/       Electron 앱 시작과 Python 백엔드 실행 관리
src/preload/    renderer에 노출되는 안전한 API
src/renderer/   사용자 화면
backend/        Python FastAPI 백엔드
docs/           개발 문서
```

Electron 경험이 적다면 `docs/architecture.md`를 먼저 읽고, `src/main/main.ts`에서 앱 시작 흐름을 따라가면 됩니다.

## 요구 사항

- Node.js 및 npm
- Anaconda 또는 Miniconda
- Windows PowerShell

## 초기 설정

```powershell
npm install
npm.cmd run backend:create
npm.cmd run backend:install
```

이미 `nextron-electron-backend` 환경이 있다면 `backend:create` 대신 아래 명령을 사용합니다.

```powershell
npm.cmd run backend:update-python
npm.cmd run backend:install
```

## 실행

Electron 앱과 Python 백엔드를 함께 실행합니다.

```powershell
npm start
```

Python 백엔드만 실행하려면 아래 명령을 사용합니다.

```powershell
npm.cmd run backend:dev
```

헬스 체크는 PowerShell에서 확인할 수 있습니다.

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/health
```

## 검증

커밋 또는 공유 전 최소 확인은 아래 명령입니다.

```powershell
npm.cmd run check
```

패키징까지 확인하려면 아래 명령을 사용합니다.

```powershell
npm.cmd run package
```

## 자주 생기는 문제

### 포트 충돌

`WinError 10048` 또는 `address already in use`가 보이면 `8765` 포트가 이미 사용 중이라는 뜻입니다. 현재 코드는 백엔드 `/health`가 응답하면 기존 백엔드를 재사용하고, 아니면 다음 빈 포트를 찾습니다.

### Conda 환경이 없을 때

아래 명령으로 환경을 만듭니다.

```powershell
npm.cmd run backend:create
npm.cmd run backend:install
```

### 다른 Conda 환경을 쓰고 싶을 때

```powershell
$env:NEXTRON_CONDA_ENV="NEXTRON"
npm start
```

### 특정 Python 실행 파일을 직접 쓰고 싶을 때

```powershell
$env:NEXTRON_PYTHON="C:\Users\Nextron\anaconda3\envs\nextron-electron-backend\python.exe"
npm start
```
