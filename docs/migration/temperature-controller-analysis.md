# Temperature Controller 분석 (tkinter → Electron 마이그레이션)

분석 대상: `C:\Users\Nextron\Desktop\Workspace\Nextron_tkinter` (develop)

## 1. 관련 파일
- `src/backend/controllers/temperature/tc_base.py` — `TC_Base(BaseController)` 추상 베이스
- `src/backend/controllers/temperature/fb100.py` — `FB100(TC_Base)` 실제 RKC FB100 드라이버
- `src/backend/controllers/temperature/static.py` — 프로토콜 상수(EOT/ENQ/STX/ETX, MODEL_LIST)
- `src/backend/controllers/base_controller.py` — 공통 베이스
- `src/frontend/managers/device_scanner.py` — 포트 enumerate / 연결 테스트

## 2. 통신 방식
- **Serial** (pyserial `serial.Serial`), RKC FB100 프로토콜
- 기본 시리얼 설정:
  - baudrate `9600`
  - bytesize `8`, parity `N`, stopbits `1` (pyserial 기본값 사용)
  - `timeout=0.5`, `write_timeout=1.0`
- 프레이밍 제어문자: `EOT=\x04`, `ENQ=\x05`, `STX=\x02`, `ETX=\x03`, `ACK=\x06`, `NAK=\x15`
- 장비 식별: `ID` 명령 → 응답에 `"FB100"` 포함 여부로 확인
  - `test_connection(port, model)`: `Serial(port, 9600, timeout=0.5, write_timeout=1.0)` 로 열고
    `{EOT}01ID{ENQ}{EOT}` 전송 → `read(DATA_LENGTH)` 응답에 `b'FB100'` 있으면 True

## 3. 모델
- `MODEL_LIST = ["PT","PTH","LN","CHL","CHH","CHU"]` (+ DPT)
- 모델별 온도/램핑 범위(`FB100.DEFAULT_SETTING.TEMPERATURE_RANGE`):
  - PT/DPT `[-40,200]`, PTH `[-40,170]`, CHL `[0,450]`, CHH `[0,750]`, CHU `[0,1000]`, LN `[-193,30]`

## 4. 주요 명령
- `connect(model, try_reconnect)` — 포트 열고 ID 확인, worker/data 스레드 시작
- `disconnect(try_reconnect)` — stop mode 시도 후 스레드 종료/시리얼 close/큐 비움
- `reconnect()` — VID/PID 기반 포트 재탐색 후 재연결
- read: process value(현재 온도, `process_value`), setpoint(SV), ID, decimal point 등
- write: setpoint(SV), run mode / stop mode (`set_run_mode`/`set_stop_mode`)
- 안전 정지: `set_stop_mode`, safe stop target 으로 ramp down

## 5. 명령 직렬화 / 동시성
- `queue.PriorityQueue` 2개 (`_command_queue`, `_period_queue`) + 단일 worker 스레드
- `_serial_lock = threading.Lock()` 로 시리얼 접근 보호
- `Command` dataclass(priority, seq, kind READ/WRITE, params, future) — 명령을 큐로 직렬화
- `interval_ms=40` 명령 간 최소 간격, `_data_update_interval_ms=200` 주기 갱신
- 즉 **이미 큐 + lock 으로 connect/read/write/disconnect 충돌을 직렬화**한다.

## 6. 응답 parsing / 상태 구조
- `state: dict[str, Optional[float]]` 에 최근 측정값 저장(`_state_lock` 보호)
- decimal point 로 정수 응답을 실수 변환, `normalize_temperature_value` 로 정밀도 정규화
- timeout/retry: 시리얼 timeout 0.5s, 재연결 `max_reconnect_attempts`/`reconnect_interval`, 디바이스 분리 카운트(`_disconnect_chamber_count`/`_limit_count=3`)

## 7. 등록 정보 (connection_config.json)
- `temp` key: `{"model": "...", "port": "COMxx"}` (+ 최초 연결 시 vid/pid 기록 예: `{"model":"PT","port":"COM24","vid":6790,"pid":21971}`)
- 드라이버 USB: CH343 계열(`drivers/CH343SER.*`)

## 8. mock / simulator
- tkinter 백엔드에는 Temperature 전용 simulator 가 명확히 없음(Vacuum 에 "MOCK" 포트 옵션은 존재).
- 따라서 신규 Electron 프로젝트에서는 `MockTemperatureController` 를 새로 구현한다.

## 9. Electron(신규 FastAPI backend) 매핑
- 연결 config 스키마(serial): `{kind:"serial", port, baudrate, bytesize, parity, stopbits, timeoutMs, writeTermination, readTermination}`
  - 기본값: baudrate 9600, bytesize 8, parity "N", stopbits 1, timeoutMs 1000, write/readTermination `"\r\n"`
- `probe` = read-only 연결 확인 (FB100 `test_connection` 의 ID 확인에 대응). 실제 write 없음.
- `read` = 현재 온도/SV 조회 (read-only)
- setpoint write 는 이번 작업 범위에서 **미구현**(mock 에서만 제한적 보관). 실제 장비 write 없음.
- 명령 직렬화: backend `TemperatureService` 에서 `asyncio.Lock` 으로 connect/read/probe/disconnect 직렬화. 실제 시리얼 blocking I/O 는 `asyncio.to_thread` 로 분리(이벤트 루프 보호).
- mock 기본: `NEXTRON_DEVICE_MODE=mock` (기본), `real` 선택 시 pyserial 기반 read-only probe.

## 10. 차이 / 한계 (문서화)
- 신규 backend 의 Temperature read/probe 는 FB100 의 일부(연결 확인 + 현재값 read-only)만 우선 구현.
- run/stop mode, ramping, safe stop, reconnect, PID cache 등 고급 기능은 이후 단계.
- mock reading 예: `currentTemperature 25.3`, `setpoint 30.0`, `unit "°C"`.
