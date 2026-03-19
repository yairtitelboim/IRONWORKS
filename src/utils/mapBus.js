/**
 * mapBus
 *
 * Thin wrapper around the global window.mapEventBus so components don't have
 * to defensive-check window and can share a single, well-defined surface.
 *
 * This is intentionally small and JS-only (no TS types yet) but enforces a
 * consistent pattern and supports both:
 *  - eventBus.on(event, handler); eventBus.off(event, handler)
 *  - eventBus.on(event, handler) returning an unsubscribe function
 */

const getRawBus = () => {
  if (typeof window === 'undefined') return null;
  return window.mapEventBus || null;
};

export const mapBus = {
  emit(eventName, payload) {
    const bus = getRawBus();
    if (!bus || typeof bus.emit !== 'function') return;
    try {
      bus.emit(eventName, payload);
    } catch (err) {
      // Swallow to avoid breaking UI; log once if needed.
      // eslint-disable-next-line no-console
      console.warn('mapBus.emit error for event:', eventName, err);
    }
  },

  on(eventName, handler) {
    const bus = getRawBus();
    if (!bus || typeof bus.on !== 'function' || typeof handler !== 'function') {
      return () => {};
    }

    try {
      const subscription = bus.on(eventName, handler);
      // Some event bus implementations return an unsubscribe fn.
      if (typeof subscription === 'function') {
        return subscription;
      }

      // Fallback: provide an unsubscribe wrapper using off().
      return () => {
        const currentBus = getRawBus();
        if (currentBus && typeof currentBus.off === 'function') {
          currentBus.off(eventName, handler);
        }
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('mapBus.on error for event:', eventName, err);
      return () => {};
    }
  },

  off(eventName, handler) {
    const bus = getRawBus();
    if (!bus || typeof bus.off !== 'function' || typeof handler !== 'function') {
      return;
    }
    try {
      bus.off(eventName, handler);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('mapBus.off error for event:', eventName, err);
    }
  }
};


