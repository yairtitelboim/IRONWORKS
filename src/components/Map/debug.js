// Debug utilities for Map
export const DEBUG = false;
export const debugLog = (...args) => DEBUG && console.log('[MapDebug]', ...args);
export const debugWarn = (...args) => DEBUG && console.warn('[MapDebug]', ...args);
export const debugError = (...args) => DEBUG && console.error('[MapDebug]', ...args); 