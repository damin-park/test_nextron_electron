import './index.css';
import { createMainWindow } from './ui/mainWindow';

const appElement = document.querySelector<HTMLDivElement>('#app');

if (appElement) {
  appElement.replaceChildren(createMainWindow());
}
