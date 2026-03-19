const COMMON_PERIODS_2017_2025 = [
  { id: '2017_2018', label: '2017 \u2192 2018' },
  { id: '2018_2019', label: '2018 \u2192 2019' },
  { id: '2019_2020', label: '2019 \u2192 2020' },
  { id: '2020_2021', label: '2020 \u2192 2021' },
  { id: '2021_2022', label: '2021 \u2192 2022' },
  { id: '2022_2023', label: '2022 \u2192 2023' },
  { id: '2023_2024', label: '2023 \u2192 2024' },
  { id: '2024_2025', label: '2024 \u2192 2025' }
];

const HARRIS_PERIODS_2020_2025 = [
  { id: '2020_2021', label: '2020 \u2192 2021' },
  { id: '2021_2022', label: '2021 \u2192 2022' },
  { id: '2022_2023', label: '2022 \u2192 2023' },
  { id: '2023_2024', label: '2023 \u2192 2024' },
  { id: '2024_2025', label: '2024 \u2192 2025' }
];

const DEFAULT_SERIES = [
  { key: 'agriculture_loss', label: 'Agriculture Loss', color: '#f97316' },
  { key: 'agriculture_gain', label: 'Vegetation Gain', color: '#38bdf8' },
  { key: 'industrial_expansion', label: 'Industrial Expansion', color: '#f472b6' },
  { key: 'water_change', label: 'Water Change', color: '#6366f1' }
];

export const SITE_TIMELINE_CONFIG = {
  toyota_battery_nc: {
    siteName: 'Toyota Battery Manufacturing North Carolina',
    basePath: '/data/toyota_battery_nc',
    filePrefix: 'toyota_battery_nc',
    units: 'ha',
    periods: COMMON_PERIODS_2017_2025,
    series: DEFAULT_SERIES
  },
  vinfast_nc: {
    siteName: 'VinFast EV Manufacturing Campus',
    basePath: '/data/vinfast_nc',
    filePrefix: 'vinfast_nc',
    units: 'ha',
    periods: COMMON_PERIODS_2017_2025,
    series: [
      { key: 'agriculture_loss', label: 'Agriculture Loss', color: '#ff6b00' },
      { key: 'agriculture_gain', label: 'Vegetation Gain', color: '#2dd4ff' },
      { key: 'industrial_expansion', label: 'Industrial Expansion', color: '#f472b6' },
      { key: 'water_change', label: 'Water Change', color: '#6366f1' }
    ]
  },
  wolfspeed_nc: {
    siteName: 'Wolfspeed Silicon Carbide Fab',
    basePath: '/data/wolfspeed_nc',
    filePrefix: 'wolfspeed_nc',
    units: 'ha',
    periods: COMMON_PERIODS_2017_2025,
    series: DEFAULT_SERIES
  },
  harris_nc: {
    siteName: 'Shearon Harris Nuclear Power Plant',
    basePath: '/data/harris_nc',
    filePrefix: 'harris_nc',
    units: 'ha',
    periods: HARRIS_PERIODS_2020_2025,
    series: DEFAULT_SERIES
  },
  three_mile_island_pa: {
    siteName: 'Three Mile Island Nuclear Plant',
    basePath: '/data/three_mile_island_pa',
    filePrefix: 'three_mile_island_pa',
    units: 'ha',
    periods: HARRIS_PERIODS_2020_2025,
    series: [
      { key: 'agriculture_loss', label: 'Agriculture Loss', color: '#166534' }, // Dark green - matches GEE map
      { key: 'agriculture_gain', label: 'Vegetation Gain', color: '#bbf7d0' }, // Light green - matches GEE map
      { key: 'industrial_expansion', label: 'Industrial Expansion', color: '#ec4899' }, // Pink - matches GEE map
      { key: 'water_change', label: 'Water Change', color: '#38bdf8' } // Blue - matches GEE map
    ]
  },
  susquehanna_nuclear_pa: {
    siteName: 'Susquehanna Steam Electric Station',
    basePath: '/data/susquehanna_nuclear_pa',
    filePrefix: 'susquehanna_nuclear_pa',
    units: 'ha',
    periods: HARRIS_PERIODS_2020_2025,
    series: [
      { key: 'agriculture_loss', label: 'Agriculture Loss', color: '#166534' }, // Dark green - matches GEE map
      { key: 'agriculture_gain', label: 'Vegetation Gain', color: '#bbf7d0' }, // Light green - matches GEE map
      { key: 'industrial_expansion', label: 'Industrial Expansion', color: '#ec4899' }, // Pink - matches GEE map
      { key: 'water_change', label: 'Water Change', color: '#38bdf8' } // Blue - matches GEE map
    ]
  }
};

export default SITE_TIMELINE_CONFIG;
