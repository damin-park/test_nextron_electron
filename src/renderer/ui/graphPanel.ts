/**
 * 그래프 패널 (graph/graph_panel.py 재현 — 현재는 placeholder).
 * 실제 matplotlib 그래프는 추후 차트 라이브러리로 대체한다.
 */
export function createGraphPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'graph-panel';

  const placeholder = document.createElement('div');
  placeholder.className = 'graph-panel__placeholder';
  placeholder.textContent = 'Graph Panel';

  panel.appendChild(placeholder);
  return panel;
}
