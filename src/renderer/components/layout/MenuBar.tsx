/**
 * VS Code 스타일 커스텀 타이틀 바.
 * 프레임리스 창에서 [드롭다운 메뉴] [타이틀(드래그)] [창 컨트롤] 을 한 줄에 배치한다.
 * - 좌측: File / Settings / Help 드롭다운 메뉴
 * - 중앙: 앱 타이틀 (창 드래그 영역)
 * - 우측: 최소화 / 최대화·복원 / 닫기 버튼
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  onWindowMaximizeChange,
  toggleMaximizeWindow,
} from '../../services/windowControls';

interface MenuItemDef {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItemDef[];
}

interface MenuBarProps {
  title?: string;
  onSettings?: () => void;
  onExit?: () => void;
}

export function MenuBar({
  title = 'Nextron Integrated Program',
  onSettings,
  onExit,
}: MenuBarProps): ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let active = true;
    void isWindowMaximized().then((value) => {
      if (active) setMaximized(value);
    });
    const dispose = onWindowMaximizeChange((value) => setMaximized(value));
    return () => {
      active = false;
      dispose();
    };
  }, []);

  useEffect(() => {
    if (openIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIndex(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openIndex]);

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [{ label: 'Exit', onClick: onExit, disabled: !onExit }],
    },
    {
      label: 'Settings',
      items: [
        { label: 'Open Settings…', onClick: onSettings, disabled: !onSettings },
      ],
    },
    {
      label: 'Help',
      items: [{ label: title, disabled: true }],
    },
  ];

  const handleTopClick = useCallback((index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  }, []);

  const handleTopEnter = useCallback((index: number) => {
    setOpenIndex((current) => (current === null ? current : index));
  }, []);

  const handleItemClick = useCallback((item: MenuItemDef) => {
    if (item.disabled || !item.onClick) return;
    item.onClick();
    setOpenIndex(null);
  }, []);

  return (
    <div className="title-bar">
      {openIndex !== null && (
        <div
          className="title-bar__backdrop"
          onClick={() => setOpenIndex(null)}
        />
      )}

      <div className="title-bar__menus">
        {menus.map((menu, index) => (
          <div key={menu.label} className="title-bar__menu">
            <button
              type="button"
              className={`title-bar__menu-button${
                openIndex === index ? ' title-bar__menu-button--active' : ''
              }`}
              onClick={() => handleTopClick(index)}
              onMouseEnter={() => handleTopEnter(index)}
            >
              {menu.label}
            </button>
            {openIndex === index && (
              <div className="title-bar__dropdown" role="menu">
                {menu.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className="title-bar__dropdown-item"
                    onClick={() => handleItemClick(item)}
                    disabled={item.disabled}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="title-bar__title">{title}</div>

      <div className="title-bar__controls">
        <button
          type="button"
          className="title-bar__control"
          aria-label="Minimize"
          onClick={() => void minimizeWindow()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="title-bar__control"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => void toggleMaximizeWindow()}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect
                x="0.5"
                y="2.5"
                width="6"
                height="6"
                fill="none"
                stroke="currentColor"
              />
              <path
                d="M2.5 2.5V0.5H9.5V7.5H7.5"
                fill="none"
                stroke="currentColor"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect
                x="0.5"
                y="0.5"
                width="9"
                height="9"
                fill="none"
                stroke="currentColor"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="title-bar__control title-bar__control--close"
          aria-label="Close"
          onClick={() => void closeWindow()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5" stroke="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
