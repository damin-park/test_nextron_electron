# Migration Status

이 문서는 기존 `Nextron_tkinter` 프로젝트의 frontend(tkinter GUI)를 현재 Electron 프로젝트로 어디까지 옮겼는지 설명한다. 코드를 직접 확인하지 못하는 개발자나 AI가 현재 상태와 다음 작업 범위를 빠르게 이해하는 것이 목적이다.

## Migration Goal

- Source project: `C:\Users\Nextron\Desktop\Workspace\Nextron_tkinter`
- 기준 브랜치: `develop`
- 대상 프로젝트: `C:\Users\Nextron\Desktop\Workspace\Nextron_Electron`
- 목표: 기존 tkinter frontend GUI를 Electron renderer로 시각적/동작적으로 가능한 한 동일하게 재현한다.
- 현재 우선순위: 전체 GUI 중 main GUI shell과 splash screen부터 migration한다.

## Current Stack

현재 Electron 프로젝트는 다음 구조로 동작한다.

- Electron Forge + Vite
- TypeScript 기반 Electron main/preload/renderer
- Renderer는 React + TypeScript component 구조 (`@vitejs/plugin-react`, JSX `react-jsx`)
- Python backend는 FastAPI/uvicorn으로 실행
- 기본 backend 포트는 `127.0.0.1:8765`
- Backend Conda 환경 기본값은 `nextron-electron-backend`

## Completed Work

### 1. Main Window Shell

기존 tkinter `main_window.py`의 큰 화면 구조를 Electron renderer로 우선 재현했다.
현재 renderer는 React + TypeScript component 구조로 구현되어 있다.

구현된 영역:

- 상단 메뉴바
- 좌측 사이드 메뉴
- 연결 상태 배너
- 대시보드 영역
- 컨트롤 패널 영역
- 스플리터
- 그래프 패널 영역

관련 파일:

- `src/renderer/main.tsx` (React entry, `#app` 에 root mount)
- `src/renderer/app/App.tsx` (모드/사이드메뉴 상태 관리)
- `src/renderer/components/layout/MainWindowShell.tsx`
- `src/renderer/components/layout/MenuBar.tsx`
- `src/renderer/components/layout/SideMenu.tsx`
- `src/renderer/components/layout/useSplitter.ts`
- `src/renderer/components/status/ConnectionBanner.tsx`
- `src/renderer/features/dashboard/Dashboard.tsx`
- `src/renderer/features/control-panel/ControlPanel.tsx`
- `src/renderer/features/graph/GraphPanel.tsx`
- `src/renderer/shared/icons/materialSymbols.ts`
- `src/renderer/shared/types/ui.ts`
- `src/renderer/styles/theme.css`
- `src/renderer/styles/layout.css`
- `src/renderer/styles/components.css`

> 참고: 초기에는 vanilla TypeScript DOM 생성 방식(`src/renderer/renderer.ts`, `src/renderer/ui/*`)으로
> 구현했으나, 이후 동일한 시각/동작을 유지한 채 React component 구조로 전환했고 기존 vanilla 파일은 제거했다.

현재 동작:

- `RECIPE`, `MANUAL`, `IV` 모드 전환 구조가 있다.
- 사이드 메뉴 클릭 시 컨트롤 패널의 placeholder view가 전환된다.
- 컨트롤 패널과 그래프 패널 사이 스플리터를 드래그해 폭을 조절할 수 있다.
- `IV` 메뉴는 SMU 연결 전 상태를 가정해 초기 비활성화되어 있다.

아직 실제 recipe/manual/iv 세부 위젯은 placeholder 수준이다.

### 2. Window Size Behavior

프로그램 최소 창 크기와 renderer 크기 동기화를 조정했다.

현재 Electron main window 정책:

- 초기 content size: `1366 x 768`
- 최소 창 크기: `1366 x 768`
- `useContentSize: true`
- Electron 기본 native menu bar 숨김
- Renderer는 `html`, `body`, `#app`이 창 크기 100%를 채우도록 구성
- 사용자가 창 크기를 드래그로 변경하면 GUI도 창 크기에 맞춰 따라간다.

관련 파일:

- `src/main/main.ts`
- `src/renderer/styles/layout.css`

### 3. Material Design 3 Dark Theme

기존 tkinter의 Material Design 3 스타일을 기준으로 dark theme color token을 CSS 변수로 옮겼다.

주요 색상:

- Surface: `#121212`
- Container low: `#171717`
- Container: `#1E1E1E`
- On surface: `#F2F2F2`
- On surface variant: `#C7C7C7`
- Disabled text: `#666666`
- Outline variant: `#3F3F3F`
- Red accent/tertiary: `#D20000`

관련 파일:

- `src/renderer/styles/theme.css`
- `src/renderer/styles/components.css`

### 4. Side Menu Icon Migration

초기 Electron 구현에서는 SVG icon을 사용했으나, 원본 tkinter GUI는 Google Fonts Material Symbols 기반이었다. 현재는 원본에 맞춰 font glyph 방식으로 수정했다.

현재 상태:

- Material Symbols Outlined/ Filled TTF를 renderer asset으로 포함
- `@font-face`로 font 등록
- icon 이름을 Unicode glyph로 매핑
- 사이드 메뉴에서 `<span>` + Material Symbols font로 표시

관련 파일:

- `src/renderer/assets/fonts/material-symbols-outlined.ttf`
- `src/renderer/assets/fonts/material-symbols-filled.ttf`
- `src/renderer/ui/icons.ts`
- `src/renderer/ui/sideMenu.ts`
- `src/renderer/styles/theme.css`
- `src/renderer/styles/components.css`

현재 사이드 메뉴 항목:

- Recipe: `description`
- Manual: `switches`
- IV: `iv_measurement`
- Results: `table`
- Settings: `settings`

### 5. Splash Screen Migration

기존 tkinter `splash_screen.py`의 splash screen을 Electron main process BrowserWindow로 옮겼다.

현재 splash 동작:

- 앱 시작 시 splash window가 먼저 표시된다.
- Backend 시작 중 상태 메시지를 표시한다.
- Backend 준비 후 main window가 `ready-to-show`가 되면 splash를 닫고 main window를 표시한다.
- Backend가 이미 실행 중이라 빠르게 준비되어도 splash가 너무 빨리 사라지지 않도록 최소 표시 시간을 둔다.

현재 splash 화면 구성:

- Frameless BrowserWindow
- 현재 크기: `500 x 250`
- `useContentSize: true`
- 배경: `#1a1c1e`
- Nextron logo image
- 상태 메시지
- 하단 progress bar image
- copyright text
- version text

관련 파일:

- `src/main/splash-window.ts`
- `src/main/splash-assets.ts`
- `src/main/main.ts`

참고:

- 원본 tkinter splash 크기는 `400 x 200`이다.
- Electron에서는 실제 모니터/DPI에서 너무 작게 보여 현재 `500 x 250`으로 조정했다.
- Logo/bar 이미지는 원본 tkinter assets를 base64 data URI로 embed했다.

### 6. Shared App Version

`APP_VERSION`은 여러 파일에 하드코딩하지 않고 공용 파일에서 import하도록 정리했다.

관련 파일:

- `src/shared/app-version.ts`
- `src/main/splash-window.ts`
- `src/renderer/ui/mainWindow.ts`

현재 버전 값:

```ts
export const APP_VERSION = 'v1.0.0';
```

버전 변경 시 `src/shared/app-version.ts`만 수정하면 된다.

## Current Runtime Flow

앱 실행 흐름은 다음과 같다.

1. Electron app ready
2. Splash window 생성 및 표시
3. Splash status: `Starting backend...`
4. Python FastAPI backend 시작 또는 기존 backend 재사용
5. Splash status: `Loading Main Screen...`
6. Main BrowserWindow 생성 (`show: false`)
7. Main window `ready-to-show`
8. 최소 splash 표시 시간 보장 후 splash close
9. Main window show/focus

## Verified Commands

현재까지 반복 확인한 명령:

```powershell
npm run lint
npm start
```

확인된 상태:

- TypeScript/ESLint lint 통과
- Electron Forge start 성공
- Vite renderer dev server 실행 성공
- Main/preload bundle build 성공
- Electron app 실행 성공

## Known Gaps / Not Yet Migrated

아래 항목은 아직 migration 완료가 아니다.

### Main GUI Detail Widgets

컨트롤 패널 내부의 실제 기능 UI는 아직 placeholder 수준이다.

남은 영역:

- Recipe control 상세 위젯
- Manual control 상세 위젯
- IV control 상세 위젯
- Results 화면
- Settings 화면

### Dashboard Data Binding

대시보드는 현재 시각 구조와 placeholder readings 중심이다.

남은 작업:

- 실제 backend 상태 연결
- 온도/습도/MFC/압력/SMU 값 표시
- 연결 상태에 따른 badge/state 업데이트

### Graph Panel

그래프 패널은 현재 placeholder이다.

남은 작업:

- 원본 그래프 레이아웃 확인
- Electron renderer에서 사용할 chart/rendering library 결정
- 실시간 데이터 수신 및 plot 업데이트

### Backend IPC Integration

Python backend 실행/health check 기반은 준비되어 있으나, renderer UI와 backend command/state를 실제로 연결하는 단계는 아직 남아 있다.

남은 작업:

- preload API 확장
- renderer에서 backend 상태 조회
- 장비 제어 command 호출
- error/loading/connection state 처리

### Menu / Banner Behavior

상단 menu와 connection banner는 shell 형태가 먼저 구현되어 있다.

남은 작업:

- 원본 메뉴 command migration
- 연결/경고/safe-stop/success 상태 전환
- 사용자 동작에 따른 banner show/hide

### Original Pixel-Level Parity

큰 구조와 색상/아이콘 방향성은 맞췄지만, 모든 세부 pixel 값과 widget 동작이 완전히 동일하다고 보기는 이르다.

추가 확인 필요:

- 원본 tkinter 화면 캡처와 side-by-side 비교
- 각 panel 내부 spacing/font/size 비교
- 창 리사이즈 시 원본과 동일한 폭 저장/복원 동작 여부

## Suggested Next Steps

추천 순서:

1. 원본 `main_window.py`의 실제 panel/widget 코드를 기준으로 Recipe panel부터 상세 migration
2. Backend state를 renderer에 노출할 preload API 설계
3. Dashboard 실제 데이터 binding
4. Graph panel 구현 방식 결정 및 prototype
5. Results/Settings 화면 migration
6. 원본 tkinter 캡처와 Electron 화면을 비교해 pixel-level 조정

## Important Notes For Future Developers / AI

- 이 프로젝트의 목표는 새 디자인을 만드는 것이 아니라 기존 tkinter GUI의 faithful migration이다.
- 임의의 현대적 dashboard/landing page 스타일을 추가하지 말고, 원본 tkinter 레이아웃과 색상 체계를 우선해야 한다.
- Renderer는 React + TypeScript component 구조이며, 화면 구성은 `src/renderer/app/App.tsx` → `MainWindowShell` 에서 시작한다.
- 사이드 메뉴 아이콘은 SVG가 아니라 Material Symbols font glyph 방식이어야 한다.
- Main window는 content size 기준 `1366 x 768`을 기본으로 한다.
- Splash screen은 main process BrowserWindow에서 data URL로 로드된다.
- `APP_VERSION`은 `src/shared/app-version.ts`에서만 관리한다.
