# Init Connect 분석 (tkinter → Electron 마이그레이션)

분석 대상: `C:\Users\Nextron\Desktop\Workspace\Nextron_tkinter` (develop)

## 1. 관련 파일
- `src/frontend/ui/connect/init_connect_window.py` — `InitConnectWindow(Toplevel)` 본체
- `src/frontend/ui/connect/select_controller_frame.py` — 1단계: 장비 type 선택
- `src/frontend/ui/connect/select_model_frame.py` — 2단계: 모델 선택
- `src/frontend/ui/connect/select_port_frame.py` — 3단계: 포트 선택 + 연결 테스트 + Add
- `src/frontend/ui/connect/pcs_wp_config_frame.py` — Pressure(PCS-WP) 전용 설정
- `src/frontend/ui/connect/constants.py` — `MODEL_LIST` (type별 모델)
- `src/frontend/gui_main.py` — 실행 흐름 결정 (splash → init connect / main)
- `src/common/paths.py` — `get_connection_config_path()`
- `src/frontend/managers/device_scanner.py` — 포트 enumerate / 연결 테스트

## 2. popup class / 윈도우 속성
- class: `InitConnectWindow(Toplevel)`
- title: `"Add Device"`
- size: `550 x 594`, `resizable(False, False)`
- 배경색: `#121212`
- 부모(root)의 자식 Toplevel, 모달처럼 `wait_window()` 로 닫힐 때까지 대기

## 3. 표시 조건 (등록된 장비 존재 여부 판단)
`gui_main.py` `_check_backend_ready()`:
```
backend ready 후
config_file = get_connection_config_path()   # connection_config.json
if not config_file.exists():
    root.after(1500, _show_init_window)       # 등록 장비 없음 → Init Connect
else:
    root.after(10, _start_auto_connect)       # 등록 장비 있음 → 자동연결 → Main
```
- 즉 **판단 기준 = `connection_config.json` 파일 존재 여부**.
- Init Connect 가 닫힌 뒤 다시 파일이 존재하면 auto_connect → Main, 없으면(스킵) 바로 Main.

## 4. 등록 정보 저장 위치 / 구조
- 경로: `get_connection_config_path()` → `get_data_dir()/connection_config.json`
  - 개발: 프로젝트 루트, 배포: `%LOCALAPPDATA%\Nextron\connection_config.json`
- 구조 (type key 기반 dict):
```json
{
  "temp":   {"model": "PT", "port": "COM24"},
  "mfc":    {"model": "PMGC", "port": "COM3"},
  "humid":  {"model": "HCS-2M", "port": "COM5"},
  "pressure": {"model": "PCS-WP", "port": "COM6"},
  "measurement": {"model": "KE2400", "port": "GPIB0::24::INSTR"},
  "chiller": {"model": "NMC-200", "port": "COM7"}
}
```
- key map: temperature→`temp`, mfc→`mfc`, humidity→`humid`, pressure→`pressure`, measurement→`measurement`, chiller→`chiller`

## 5. popup 내부 layout (wizard)
헤더 (canvas text):
- title: `"Add a device"` (Roboto Medium -20, #FFFFFF, x36 y36)
- subtitle: `"Select the type of device you want to connect."` (-15, x36 y85)

frame_list 순서: `[SelectControllerFrame, SelectModelFrame, PCS_WP_ConfigFrame, SelectPortFrame]`

1. **SelectControllerFrame** — 장비 type 세로 목록 버튼
   - 항목: (lab 모드시 Vacuum) Temperature / Mass Flow / Humidity / Pressure / SMU / Chiller
   - 선택 표시: 좌측 세로 라인 `#E6231C` width 3, 선택 텍스트 `#E0E0E0`, 비선택 `#2F2F2F`
   - 하단 버튼: `Close`(x220) / `Next`(x384), y420 146x35
2. **SelectModelFrame** — `MODEL_LIST[type]` 기반 모델 목록, Back / Next
3. **SelectPortFrame** — 포트 콤보박스 + 버튼들
   - `Refresh`, `Connection Test`, (Pressure만)`Find Device`, `Back`, `Add`
   - 연결 결과 라벨 색상: 성공 `#34C759`, 실패/타임아웃 `#E6231C`, 진행중 `#FFAA00`
   - `Add` 버튼은 연결 테스트 성공 후 활성(`_update_add_button_state`)

## 6. 장비 type / 모델 / 포트 UI
- type 선택: 세로 메뉴 버튼 (SelectControllerFrame)
- 모델 선택: `MODEL_LIST` 콤보박스 (SelectModelFrame)
  - Temperature: `["PT","PTH","CHL","CHH","CHU","LN"]`
  - MFC: `["PMGC"]`, Humidity: `["HCS-2M","HCS-2M(old)","HCS-0M","HMS","PHCS"]`
  - Pressure: `["PCS-WP"]`, Measurement: `["KE2400","KE2450"]`, Chiller: `["NMC-200"]`
- 포트 선택: serial `DeviceScanner.enumerate_serial_ports()`, SMU는 `enumerate_visa_resources()` (GPIB/USB/ASRL)

## 7. 버튼 / 동작
- `Refresh` (Refresh Ports): 포트 목록 재조회
- `Connection Test`: `DeviceScanner.scan_serial_device(...)` / `scan_visa_device(...)` — read-only 스캔
- `Find Device` (Pressure 전용): auto detect
- `Add` / `Add Device`: `connection_config.json` 에 `{model, port}` 저장 후 `messagebox` 성공 표시 → `self.destroy()`
- `Close` / `Back` / `X`: 창 닫기(스킵). X 로 닫으면 등록 없이 Main 으로 진행

## 8. 등록 완료 조건 / Main 전환
- `on_add()` 성공 → 파일 저장 → 창 닫힘 → `gui_main` 이 파일 존재 확인 → auto_connect → MainWindow
- 즉 "등록 완료 = connection_config.json 저장 성공 + 창 닫힘".

## 9. 오류 표시 방식
- 입력 누락: `messagebox.showwarning("Warning", ...)`
- 연결 결과: 상태 라벨 텍스트/색상 (`Connection Successful` / `Connection Timeout` / `Connection Failed`)
- 저장 실패: `messagebox.showerror("Error", ...)`

## 10. Electron 마이그레이션 시 차이 (의도된 차이)
- 저장 스키마: tkinter 의 type-key dict 대신 신규 프로젝트 스펙(섹션 5)의 `RegisteredDevice`(id/type/displayName/enabled/connection/createdAt/updatedAt) 리스트를 사용한다. 차이는 본 문서로 기록.
- 등록된 장비 판단: 파일 존재 여부 대신 backend `GET /api/v1/devices/registered/summary` 의 `hasRegisteredDevices` 사용.
- 이번 작업은 Temperature Controller 만 실제 등록/probe 가능, 나머지 type 은 placeholder(disabled).
- Cancel/Close: tkinter 는 스킵 후 Main 진입이 가능하나, 신규 프로젝트 안전 규칙("등록 완료 전 Main 표시 금지")에 따라 Cancel = 앱 종료로 처리(문서화된 차이).
- popup 은 별도 modal `BrowserWindow` 로 구현(가장 faithful).
