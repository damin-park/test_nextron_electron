/**
 * Renderer 진입점 (React root).
 * 기존 vanilla renderer.ts 를 대체한다. 기존 #app 에 React root 를 mount 한다.
 */
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

const container = document.querySelector<HTMLDivElement>('#app');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
