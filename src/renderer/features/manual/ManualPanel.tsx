import type { ReactElement } from 'react';
import { getIconGlyph } from '../../shared/icons/materialSymbols';
import type { UseTemperatureConnectionResult } from '../temperature/useTemperatureConnection';
import { ManualTemperatureControl } from './ManualTemperatureControl';
import type { ManualDeviceConfig } from './manualTypes';
import { useManualMode } from './useManualMode';

interface ManualPanelProps {
  temperatureConnection: UseTemperatureConnectionResult;
}

export function ManualPanel({
  temperatureConnection,
}: ManualPanelProps): ReactElement {
  const { devices, selectedDeviceId, setSelectedDeviceId } =
    useManualMode(temperatureConnection.state);
  const selectedDevice =
    devices.find((device) => device.id === selectedDeviceId) ?? devices[0];

  return (
    <div className="manual-panel">
      <div className="manual-panel__rail" aria-label="Manual devices">
        {devices.map((device) => (
          <ManualDeviceButton
            key={device.id}
            device={device}
            selected={device.id === selectedDevice.id}
            onClick={() => setSelectedDeviceId(device.id)}
          />
        ))}
      </div>

      <div className="manual-panel__divider" />

      <div className="manual-panel__content">
        {selectedDevice.id === 'temp' ? (
          <ManualTemperatureControl connection={temperatureConnection} />
        ) : (
          <ManualGapPanel device={selectedDevice} />
        )}
      </div>
    </div>
  );
}

interface ManualDeviceButtonProps {
  device: ManualDeviceConfig;
  selected: boolean;
  onClick: () => void;
}

function ManualDeviceButton({
  device,
  selected,
  onClick,
}: ManualDeviceButtonProps): ReactElement {
  const selectedClass = selected ? ' is-selected' : '';
  const disabledClass = device.enabled ? '' : ' is-disabled';
  const connectedClass = device.connected ? ' is-connected' : '';

  return (
    <button
      type="button"
      className={`manual-device-button${selectedClass}${disabledClass}${connectedClass}`}
      onClick={onClick}
      title={device.gap ?? device.title}
    >
      <span className="material-symbols-outlined manual-device-button__icon">
        {getIconGlyph(device.icon)}
      </span>
      <span className="manual-device-button__label">{device.label}</span>
      {device.connected && <span className="manual-device-button__badge" />}
    </button>
  );
}

function ManualGapPanel({
  device,
}: {
  device: ManualDeviceConfig;
}): ReactElement {
  return (
    <section className="manual-device-panel">
      <header className="manual-device-panel__header">
        <div className="manual-device-panel__title">{device.title}</div>
      </header>
      <div className="manual-gap manual-gap--large">
        {device.gap ?? 'Backend endpoint missing'}
      </div>
    </section>
  );
}
