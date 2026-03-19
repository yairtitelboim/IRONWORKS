/**
 * Power Circle Styling Utilities
 * Supports HIFLD (voltage_rank) and OSM-style (voltage_kv, voltage) features.
 */

/** Voltage expression: supports voltage_kv, voltage (volts), and HIFLD voltage_rank (1-6) */
export const getVoltageExpression = () => [
  'case',
  ['has', 'voltage_kv'],
  ['to-number', ['get', 'voltage_kv']],
  ['>', ['coalesce', ['to-number', ['get', 'voltage']], 0], 0],
  ['round', ['/', ['to-number', ['get', 'voltage']], 1000]],
  ['>=', ['coalesce', ['get', 'voltage_rank'], 0], 1],
  [
    'case',
    ['==', ['get', 'voltage_rank'], 1], 500,
    ['==', ['get', 'voltage_rank'], 2], 345,
    ['==', ['get', 'voltage_rank'], 3], 230,
    ['==', ['get', 'voltage_rank'], 4], 138,
    ['==', ['get', 'voltage_rank'], 5], 69,
    ['==', ['get', 'voltage_rank'], 6], 34,
    0
  ],
  0
];

export const getVoltageColorExpression = () => {
  const voltageExpr = getVoltageExpression();
  return [
    'case',
    ['>=', voltageExpr, 500], '#dc2626',
    ['>=', voltageExpr, 345], '#ef4444',
    ['>=', voltageExpr, 230], '#f97316',
    ['>=', voltageExpr, 138], '#fbbf24',
    ['>=', voltageExpr, 69], '#22d3ee',
    '#3b82f6'
  ];
};

export const getVoltageLabelExpression = () => [
  'case',
  ['has', 'voltage_kv'],
  ['concat', ['to-string', ['get', 'voltage_kv']], ' kV'],
  ['>', ['coalesce', ['to-number', ['get', 'voltage']], 0], 0],
  ['concat', ['to-string', ['round', ['/', ['to-number', ['get', 'voltage']], 1000]]], ' kV'],
  ['>=', ['coalesce', ['get', 'voltage_rank'], 0], 1],
  [
    'concat',
    [
      'to-string',
      [
        'case',
        ['==', ['get', 'voltage_rank'], 1], 500,
        ['==', ['get', 'voltage_rank'], 2], 345,
        ['==', ['get', 'voltage_rank'], 3], 230,
        ['==', ['get', 'voltage_rank'], 4], 138,
        ['==', ['get', 'voltage_rank'], 5], 69,
        ['==', ['get', 'voltage_rank'], 6], 34,
        0
      ]
    ],
    ' kV'
  ],
  ['coalesce', ['get', 'name'], ['get', 'ref'], 'Transmission Line']
];

export const CIRCLE_BORDER_STYLE = {
  'line-color': '#60a5fa',
  'line-width': 2,
  'line-dasharray': [4, 3],
  'line-opacity': 0.8
};

export const CIRCLE_HALO_STYLE = {
  'line-color': '#60a5fa',
  'line-width': 4,
  'line-opacity': 0.2,
  'line-blur': 3
};
