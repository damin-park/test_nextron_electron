/**
 * 컨트롤 패널 (recipe_panel / manual_panel / iv_panel 재현).
 * 현재 모드에 따라 Recipe / Manual / IV 패널을 전환 표시한다.
 */
import type { ControlMode } from './types';

interface ModeView {
  title: string;
  placeholder: string;
}

const MODE_VIEWS: Record<ControlMode, ModeView> = {
  recipe: {
    title: 'Recipe',
    placeholder:
      '레시피 파일 선택\n프로파일 미리보기 (온도 / MFC / 습도)\nStart / Stop / Pause\n스텝 리스트',
  },
  manual: {
    title: 'Manual',
    placeholder:
      'Temperature / MFC / Humidity / Pressure / Measurement 탭\n수동 제어 위젯 (슬라이더 / 입력 / On·Off)\n실시간 측정값',
  },
  iv: {
    title: 'IV',
    placeholder: 'IV Curve 측정\n수동 오버라이드\n측정 / 습도 제어',
  },
};

export interface ControlPanelHandle {
  element: HTMLElement;
  setMode: (mode: ControlMode) => void;
}

export function createControlPanel(initialMode: ControlMode): ControlPanelHandle {
  const panel = document.createElement('div');
  panel.className = 'control-panel';

  const header = document.createElement('div');
  header.className = 'control-panel__header';
  panel.appendChild(header);

  const modeElements = new Map<ControlMode, HTMLElement>();

  (Object.keys(MODE_VIEWS) as ControlMode[]).forEach((mode) => {
    const view = MODE_VIEWS[mode];
    const modeEl = document.createElement('div');
    modeEl.className = 'control-panel__mode';
    modeEl.dataset.mode = mode;

    const placeholder = document.createElement('div');
    placeholder.className = 'control-panel__placeholder';
    placeholder.textContent = view.placeholder;

    modeEl.appendChild(placeholder);
    modeElements.set(mode, modeEl);
    panel.appendChild(modeEl);
  });

  const setMode = (mode: ControlMode) => {
    header.textContent = MODE_VIEWS[mode].title;
    modeElements.forEach((el, key) => {
      el.classList.toggle('is-active', key === mode);
    });
  };

  setMode(initialMode);

  return { element: panel, setMode };
}
