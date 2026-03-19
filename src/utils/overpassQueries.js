// Overpass query builders for Whitney, TX (Bosque County)

export function buildWhitneyBoundaryQuery() {
  return `
    [out:json][timeout:25];
    (
      relation["name"="Bosque County"]["boundary"="administrative"]["admin_level"="6"];
      relation["name"="Bosque"]["boundary"="administrative"]["admin_level"="6"];
      relation["name"="Bosque County"]["boundary"="administrative"];
      relation["name"="Bosque"]["boundary"="administrative"];
    );
    out geom;
  `;
}

export function buildZoneInfrastructureQuery(zone) {
  return `
    [out:json][timeout:15];
    (
      way["building"="office"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      way["building"="commercial"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      way["building"="retail"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      node["amenity"~"^(townhall|government|courthouse|library|school|hospital)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      way["amenity"~"^(townhall|government|courthouse|library|school|hospital)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      way["highway"~"^(motorway|trunk|primary|secondary)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      node["railway"="station"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      node["public_transport"="platform"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      node["amenity"~"^(restaurant|fuel|bank|post_office|police|fire_station)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      way["amenity"~"^(restaurant|fuel|bank|post_office|police|fire_station)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      way["leisure"~"^(park|playground|sports_centre)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      way["landuse"="recreation_ground"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      way["landuse"="industrial"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      way["building"="industrial"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
    );
    out body;
    >;
    out skel qt;
  `;
}
