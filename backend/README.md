# Backend

Python FastAPI backend입니다. 기존 `Nextron_tkinter/src/backend` migration을 쉽게 하기 위해 동일한 큰 계층을 유지합니다.

## 구조

```text
backend/
  backend_main.py        FastAPI 앱 생성과 라우터 등록
  controllers/           장비별 controller adapter
  handlers/              요청 처리 handler
  managers/              상태, controller, telemetry 등 backend manager
  router/                FastAPI router 및 command routing
  requirements.txt       pip 의존성
  environment.yml        Conda 환경 정의
```

## 실행

```powershell
npm.cmd run backend:dev
```

직접 실행할 때는 프로젝트 루트에서 아래 명령을 사용합니다.

```powershell
conda run --no-capture-output -n nextron-electron-backend python -m uvicorn backend.backend_main:app --host 127.0.0.1 --port 8765 --reload
```

## 현재 엔드포인트

- `GET /health`: backend 생존 확인

## Migration 기준

기존 tkinter backend의 파일은 아래 기준으로 옮깁니다.

- `src/backend/backend_main.py` -> `backend/backend_main.py`
- `src/backend/controllers/*` -> `backend/controllers/*`
- `src/backend/handlers/*` -> `backend/handlers/*`
- `src/backend/managers/*` -> `backend/managers/*`
- `src/backend/router/*` -> `backend/router/*`

FastAPI API 라우터는 `backend/router`에 두고, 장비 제어와 업무 로직은 `controllers`, `handlers`, `managers`로 분리합니다.
