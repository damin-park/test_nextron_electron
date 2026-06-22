# src Directory

Electron 앱 코드는 역할별로 분리합니다.

```text
src/
  main/       Electron main process. 앱 창, 앱 생명주기, 백엔드 프로세스 관리
  preload/    Renderer에 노출할 안전한 API
  renderer/   사용자 화면 코드
```

새 기능을 추가할 때는 먼저 어느 프로세스의 책임인지 정합니다.

- 앱 창, 메뉴, 파일 시스템, 외부 프로세스 실행: `src/main`
- renderer에 노출할 IPC API: `src/preload`
- 화면, 입력, 상태 표시: `src/renderer`
- 장비 통신, 데이터 수집, FastAPI API: `backend`
