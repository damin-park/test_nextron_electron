import type { GraphSeriesDefinition, GraphSeriesKey } from './graphTypes';

export const GRAPH_SERIES_CATALOG: GraphSeriesDefinition[] = [
  {
    key: 'temperature_pv',
    label: 'TC Temp PV',
    group: 'Temperature',
    unitLabel: 'Temperature [°C]',
    defaultVisible: true,
    color: '#0088FF',
  },
  {
    key: 'temperature_sv',
    label: 'TC Temp SV',
    group: 'Temperature',
    unitLabel: 'Temperature [°C]',
    defaultVisible: true,
    color: '#FF383C',
  },
  {
    key: 'temperature_hp',
    label: 'TC Hot',
    group: 'Power',
    unitLabel: 'Power [%]',
    defaultVisible: false,
    color: '#FFB347',
  },
  {
    key: 'temperature_cp',
    label: 'TC Cool',
    group: 'Power',
    unitLabel: 'Power [%]',
    defaultVisible: false,
    color: '#4FC3F7',
  },
];

export const GRAPH_SERIES_BY_KEY = GRAPH_SERIES_CATALOG.reduce<
  Record<GraphSeriesKey, GraphSeriesDefinition>
>((acc, series) => {
  acc[series.key] = series;
  return acc;
}, {} as Record<GraphSeriesKey, GraphSeriesDefinition>);

export const DEFAULT_VISIBLE_GRAPH_SERIES: GraphSeriesKey[] =
  GRAPH_SERIES_CATALOG.filter((series) => series.defaultVisible).map(
    (series) => series.key,
  );

export const TEMPERATURE_GRAPH_SERIES: GraphSeriesDefinition[] =
  GRAPH_SERIES_CATALOG.filter((series) => series.group === 'Temperature');
