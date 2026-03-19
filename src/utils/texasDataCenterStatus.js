const KNOWN_OPERATIONAL = new Set(['operational', 'active', 'online', 'existing']);
const KNOWN_PLANNED = new Set(['planned', 'proposed', 'announced', 'under_construction', 'construction', 'uc']);

export const normalizeTexasDataCenterStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return 'unknown';
  if (KNOWN_OPERATIONAL.has(raw)) return 'operational';
  if (KNOWN_PLANNED.has(raw)) return raw === 'construction' || raw === 'uc' ? 'under_construction' : raw;
  if (raw === 'underconstruction') return 'under_construction';
  return 'unknown';
};

export const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const deriveTexasDataCenterStatus = (props = {}) => {
  const normalized = normalizeTexasDataCenterStatus(
    props.status || props.project_status || props.operational_status
  );
  const installedMw = toFiniteNumber(props.installed_mw);

  if ((installedMw || 0) > 0) return 'operational';
  if (normalized !== 'unknown') return normalized;

  // If capacity exists but source status is blank/unknown, treat as planned by default.
  const totalMw = toFiniteNumber(props.total_mw);
  if ((totalMw || 0) > 0) return 'planned';

  return 'unknown';
};

export const isTexasDataCenterOperational = (props = {}) => (
  deriveTexasDataCenterStatus(props) === 'operational'
);

export const formatTexasDataCenterStatusLabel = (status) => (
  String(status || 'unknown').replace(/_/g, ' ')
);
