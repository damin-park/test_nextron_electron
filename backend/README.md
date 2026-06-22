# Backend

Python FastAPI 백엔드입니다. 장비 통신 코드(`pyserial`, `pyvisa`, `minimalmodbus`)는 앞으로 이 폴더 아래에 추가합니다.

## 실행

```powershell
npm.cmd run backend:dev
```

또는 직접 실행할 수 있습니다.

```powershell
conda run --no-capture-output -n nextron-electron-backend python -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload --app-dir backend
```

## 엔드포인트

- `GET /health`: 백엔드 생존 확인

## 의존성

- `requirements.txt`: pip 패키지 목록
- `environment.yml`: Conda 환경 정의

새 Python 패키지를 추가할 때는 우선 `requirements.txt`에 기록하고 아래 명령을 실행합니다.

```powershell
npm.cmd run backend:install
```

## 권장 모듈 배치

장비 통신 코드가 늘어나면 아래처럼 나눕니다.

```text
backend/app/main.py          FastAPI 앱 생성과 라우터 등록
backend/app/api/             HTTP API 라우터
backend/app/services/        장비 제어와 업무 로직
backend/app/devices/         serial/visa/modbus 장비 어댑터
backend/app/schemas/         요청/응답 Pydantic 모델
```
