import mapboxgl from 'mapbox-gl';

export const createCasaGrandeMarker = (map, lng, lat, cachedData) => {
  const marker = new mapboxgl.Marker({
    color: '#059669',
    scale: 1.5
  })
  .setLngLat([lng, lat])
  .addTo(map);

  marker.getElement().addEventListener('click', () => {
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:clicked', {
        id: 'casa-grande-marker',
        name: 'Casa Grande',
        type: 'Pinal County Infrastructure',
        category: 'Arizona Infrastructure Development',
        coordinates: [lng, lat],
        formatter: 'pinal',
        zonesAnalyzed: 3,
        cachedDataAvailable: !!cachedData,
        analysisStatus: 'Analyzing infrastructure...'
      });
    }
  });

  return marker;
};
