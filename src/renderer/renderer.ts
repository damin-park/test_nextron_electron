import './index.css';

const checkBackendHealth = async (attempts = 20) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await window.backend.health()) {
      return true;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  return false;
};

const renderBackendStatus = async () => {
  const appElement = document.querySelector<HTMLDivElement>('#app');

  if (!appElement) {
    return;
  }

  const backendInfo = await window.backend.getInfo();
  const isHealthy = await checkBackendHealth();

  appElement.innerHTML = `
    <main>
      <section class="status-panel">
        <p class="eyebrow">Nextron Electron</p>
        <h1>Python backend</h1>
        <dl>
          <div>
            <dt>Status</dt>
            <dd class="${isHealthy ? 'ok' : 'error'}">${isHealthy ? 'Running' : 'Unavailable'}</dd>
          </div>
          <div>
            <dt>URL</dt>
            <dd>${backendInfo.url}</dd>
          </div>
          <div>
            <dt>PID</dt>
            <dd>${backendInfo.pid ?? '-'}</dd>
          </div>
        </dl>
      </section>
    </main>
  `;
};

void renderBackendStatus();
