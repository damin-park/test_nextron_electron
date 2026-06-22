/**
 * 그래프 패널 (graph/graph_panel.py 재현 — 현재는 placeholder).
 * 실제 matplotlib 그래프는 추후 차트 라이브러리로 대체한다.
 */
import type { ReactElement } from 'react';

export function GraphPanel(): ReactElement {
  return (
    <div className="graph-panel">
      <div className="graph-panel__placeholder">Graph Panel</div>
    </div>
  );
}
