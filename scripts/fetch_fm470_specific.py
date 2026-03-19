#!/usr/bin/env python3
"""
More targeted search for FM 470 and the Utopia-Tarpley-Hondo route.
"""

import requests
import json
import sys

def main():
    # Coordinates
    UTOPIA_COORDS = (29.615, -99.533)    # Utopia, TX
    TARPLEY_COORDS = (29.578, -99.244)   # Tarpley, TX  
    HONDO_COORDS = (29.347, -99.282)     # Hondo, TX
    
    # Much larger search to ensure we find FM 470
    BUFFER = 0.1  # 11km buffer
    min_lat = min(UTOPIA_COORDS[0], TARPLEY_COORDS[0], HONDO_COORDS[0]) - BUFFER
    max_lat = max(UTOPIA_COORDS[0], TARPLEY_COORDS[0], HONDO_COORDS[0]) + BUFFER
    min_lon = min(UTOPIA_COORDS[1], TARPLEY_COORDS[1], HONDO_COORDS[1]) - BUFFER
    max_lon = max(UTOPIA_COORDS[1], TARPLEY_COORDS[1], HONDO_COORDS[1]) + BUFFER
    
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    print(f"Extended search area: {bbox}")
    
    # Very broad search for FM 470
    overpass_query = f"""
    [out:json][timeout:120];
    (
      // Any way with 470 in the reference
      way["highway"]["ref"~"470"]({bbox});
      
      // Any way with 470 in the name
      way["highway"]["name"~"470"]({bbox});
      
      // Relations with 470
      relation["highway"]["ref"~"470"]({bbox});
      
      // Secondary roads that might be FM 470 but not tagged properly
      way["highway"="secondary"]({bbox});
      
      // All roads near our waypoints
      way["highway"](around:2000,{UTOPIA_COORDS[0]},{UTOPIA_COORDS[1]});
      way["highway"](around:2000,{TARPLEY_COORDS[0]},{TARPLEY_COORDS[1]});
      way["highway"](around:2000,{HONDO_COORDS[0]},{HONDO_COORDS[1]});
    );
    out geom;
    """
    
    print("Searching for FM 470 and area roads...")
    
    try:
        overpass_url = "http://overpass-api.de/api/interpreter"
        response = requests.post(overpass_url, data=overpass_query, timeout=180)
        response.raise_for_status()
        
        osm_data = response.json()
        print(f"Retrieved {len(osm_data['elements'])} OSM elements")
        
        # Process results
        fm470_segments = []
        other_segments = []
        
        for element in osm_data['elements']:
            if element['type'] == 'way' and 'geometry' in element:
                coordinates = []
                for node in element['geometry']:
                    coordinates.append([node['lon'], node['lat']])
                
                if len(coordinates) >= 2:
                    tags = element.get('tags', {})
                    highway_type = tags.get('highway', 'unknown')
                    ref = tags.get('ref', '')
                    name = tags.get('name', '')
                    
                    feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": coordinates
                        },
                        "properties": {
                            "osm_id": element['id'],
                            "highway": highway_type,
                            "ref": ref,
                            "name": name,
                            "segment_name": "Utopia-Tarpley-Hondo Route"
                        }
                    }
                    
                    # Check if this looks like FM 470
                    if ('470' in ref or '470' in name):
                        fm470_segments.append(feature)
                        print(f"🎯 FOUND FM 470: {highway_type} '{ref}' '{name}'")
                    else:
                        other_segments.append(feature)
        
        print(f"\nFM 470 segments found: {len(fm470_segments)}")
        print(f"Other road segments: {len(other_segments)}")
        
        if len(fm470_segments) == 0:
            print("\n❌ No FM 470 found. Let me check what roads ARE in the area...")
            
            # Show what roads we DID find
            road_refs = {}
            for feature in other_segments[:20]:  # First 20
                ref = feature['properties']['ref']
                name = feature['properties']['name']
                highway = feature['properties']['highway']
                if ref or name:
                    key = f"{highway}: {ref} {name}".strip()
                    if key in road_refs:
                        road_refs[key] += 1
                    else:
                        road_refs[key] = 1
            
            print("Available roads in the area:")
            for road, count in sorted(road_refs.items()):
                print(f"  {road} ({count} segments)")
            
            # Let's use the best available roads for the connection
            route_segments = []
            
            # Prioritize roads that might connect these towns
            priority_refs = ['RM 187', 'FM 462', 'RM 1050', 'FM 1796', 'TX 16']
            
            for priority_ref in priority_refs:
                for feature in other_segments:
                    if priority_ref in feature['properties']['ref']:
                        route_segments.append(feature)
                        break  # Just get one segment of each type
            
            # If still no good segments, take secondary roads
            if len(route_segments) < 5:
                for feature in other_segments:
                    if feature['properties']['highway'] in ['secondary', 'primary']:
                        route_segments.append(feature)
                        if len(route_segments) >= 10:  # Limit to 10 segments
                            break
            
            final_segments = route_segments
            
        else:
            # Use FM 470 segments plus some connecting roads
            final_segments = fm470_segments
            
            # Add a few connecting roads
            for feature in other_segments:
                if feature['properties']['highway'] in ['secondary', 'primary'] and len(final_segments) < 15:
                    final_segments.append(feature)
        
        print(f"\nUsing {len(final_segments)} road segments for the route")
        
        # Create GeoJSON
        geojson_data = {
            "type": "FeatureCollection",
            "features": final_segments
        }
        
        # Save to file
        output_file = '../public/data/utopia_tarpley_hondo_route.geojson'
        with open(output_file, 'w') as f:
            json.dump(geojson_data, f, separators=(',', ':'))
        
        print(f"✅ Saved route to: {output_file}")
        
        # File size
        import os
        file_size = os.path.getsize(output_file)
        print(f"File size: {file_size:,} bytes")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)