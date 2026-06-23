/**
 * Renderer 진입점 (React root).
 * 기존 vanilla renderer.ts 를 대체한다. 기존 #app 에 React root 를 mount 한다.
 * hash(`#/init-connect`) 일 때는 Init Connect 팝업 UI 를 렌더링한다.
 */
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InitConnectApp } from './features/init-connect/InitConnectApp';
import { SettingsApp } from './features/settings/SettingsApp';

const container = document.querySelector<HTMLDivElement>('#app');

const hash = window.location.hash;
const isInitConnect = hash.includes('init-connect');
const isSettings = hash.includes('settings');

function selectRoot() {
  if (isInitConnect) return <InitConnectApp />;
  if (isSettings) return <SettingsApp />;
  return <App />;
}

if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>{selectRoot()}</ErrorBoundary>
    </StrictMode>,
  );
}
