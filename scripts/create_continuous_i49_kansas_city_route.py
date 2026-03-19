#!/usr/bin/env python3
"""
Create a continuous I-49 route centered on Kansas City using OSRM routing.
This creates a single LineString following the actual driving route along I-49.

Route: 500 miles north of KC → Kansas City → 500 miles south of KC
"""

import requests
import json
import sys
import math
import time
import os

def calculate_waypoint_coordinates(center_lat, center_lon, distance_miles, bearing_degrees):
    """
    Calculate coordinates at a given distance and bearing from center point.
    
    Args:
        center_lat: Center latitude
        center_lon: Center longitude
        distance_miles: Distance in miles
        bearing_degrees: Bearing in degrees (0=North, 90=East, 180=South, 270=West)
    
    Returns:
        tuple: (lat, lon) of the destination point
    """
    # Convert to radians
    lat_rad = math.radians(center_lat)
    lon_rad = math.radians(center_lon)
    bearing_rad = math.radians(bearing_degrees)
    
    # Earth's radius in miles
    R = 3959
    
    # Calculate destination point
    distance_rad = distance_miles / R
    
    dest_lat_rad = math.asin(
        math.sin(lat_rad) * math.cos(distance_rad) +
        math.cos(lat_rad) * math.sin(distance_rad) * math.cos(bearing_rad)
    )
    
    dest_lon_rad = lon_rad + math.atan2(
        math.sin(bearing_rad) * math.sin(distance_rad) * math.cos(lat_rad),
        math.cos(distance_rad) - math.sin(lat_rad) * math.sin(dest_lat_rad)
    )
    
    return (math.degrees(dest_lat_rad), math.degrees(dest_lon_rad))

def get_i49_waypoints(center_lat, center_lon, radius_miles):
    """
    Generate waypoints along I-49 corridor for routing.
    
    Args:
        center_lat: Kansas City latitude
        center_lon: Kansas City longitude
        radius_miles: Distance to extend north and south
    
    Returns:
        list: List of (lat, lon) waypoints
    """
    waypoints = []
    
    # I-49 runs roughly north-south through the western part of the central US
    # I-49 passes through Missouri, Arkansas, and Louisiana
    
    # North of Kansas City (towards Iowa/Minnesota border)
    # I-49 goes slightly northwest from KC area
    north_bearing = 350  # 10 degrees west of north
    north_point = calculate_waypoint_coordinates(center_lat, center_lon, radius_miles, north_bearing)
    waypoints.append(north_point)
    
    # Kansas City area (I-49 passes near KC)
    waypoints.append((center_lat, center_lon))
    
    # South of Kansas City (towards Louisiana/Gulf Coast)  
    # I-49 continues south through Arkansas to Louisiana
    south_bearing = 170  # 10 degrees east of south
    south_point = calculate_waypoint_coordinates(center_lat, center_lon, radius_miles, south_bearing)
    waypoints.append(south_point)
    
    return waypoints

def get_osrm_route(waypoints):
    """
    Get continuous route using OSRM (Open Source Routing Machine).
    
    Args:
        waypoints: List of (lat, lon) tuples
    
    Returns:
        dict: Route geometry or None if failed
    """
    # Convert waypoints to OSRM format (lon,lat)
    coordinates = ";".join([f"{lon},{lat}" for lat, lon in waypoints])
    
    # OSRM routing URL
    url = f"http://router.project-osrm.org/route/v1/driving/{coordinates}"
    params = {
        'overview': 'full',  # Get full geometry
        'geometries': 'geojson',  # Return as GeoJSON
        'steps': 'false',  # We don't need turn-by-turn
        'alternatives': 'false'  # Just the best route
    }
    
    try:
        print(f"Requesting I-49 route from OSRM...")
        print(f"Waypoints: {len(waypoints)} points")
        for i, (lat, lon) in enumerate(waypoints):
            if i == 0:
                print(f"  Start: {lat:.4f}, {lon:.4f} (≈500 miles north of KC)")
            elif i == len(waypoints) - 1:
                print(f"  End:   {lat:.4f}, {lon:.4f} (≈500 miles south of KC)")
            else:
                print(f"  Via:   {lat:.4f}, {lon:.4f} (Kansas City)")
        
        response = requests.get(url, params=params, timeout=60)
        response.raise_for_status()
        
        data = response.json()
        
        if data['code'] != 'Ok':
            print(f"❌ OSRM error: {data.get('message', 'Unknown error')}")
            return None
        
        route = data['routes'][0]
        geometry = route['geometry']
        
        distance_miles = route['distance'] * 0.000621371  # meters to miles
        duration_hours = route['duration'] / 3600  # seconds to hours
        
        print(f"✅ Route found:")
        print(f"   Distance: {distance_miles:.1f} miles")
        print(f"   Duration: {duration_hours:.1f} hours")
        print(f"   Coordinates: {len(geometry['coordinates']):,} points")
        
        return geometry
        
    except requests.exceptions.Timeout:
        print("❌ OSRM request timed out")
        return None
    except requests.exceptions.RequestException as e:
        print(f"❌ OSRM routing failed: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return None

def create_geojson_feature(route_geometry, metadata):
    """
    Create GeoJSON feature from route geometry.
    
    Args:
        route_geometry: OSRM route geometry
        metadata: Route metadata
    
    Returns:
        dict: GeoJSON FeatureCollection
    """
    feature = {
        "type": "Feature",
        "geometry": route_geometry,
        "properties": {
            "name": "I-49 Kansas City Corridor",
            "description": "Continuous I-49 route covering 1000-mile corridor centered on Kansas City",
            "route_type": "continuous_navigation",
            "highway": "I-49",
            "center_point": "Kansas City, MO",
            "corridor_radius_miles": metadata['radius_miles'],
            "start_description": f"≈{metadata['radius_miles']} miles north of Kansas City",
            "end_description": f"≈{metadata['radius_miles']} miles south of Kansas City",
            "approximate_coverage": {
                "north": "Iowa/Minnesota border area",
                "center": "Kansas City, MO",
                "south": "Louisiana Gulf Coast area"
            }
        }
    }
    
    geojson_data = {
        "type": "FeatureCollection",
        "features": [feature],
        "metadata": {
            "route_name": "I-49 Kansas City Corridor (Continuous)",
            "description": "Single continuous route along I-49 covering 1000-mile corridor",
            "center_coordinates": metadata['center_coords'],
            "corridor_radius_miles": metadata['radius_miles'],
            "generated_at": time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime()),
            "route_method": "OSRM routing",
            "total_features": 1,
            "coordinate_count": len(route_geometry['coordinates'])
        }
    }
    
    return geojson_data

def save_geojson(geojson_data, output_path):
    """
    Save GeoJSON data to file.
    
    Args:
        geojson_data: GeoJSON FeatureCollection
        output_path: File path to save to
    
    Returns:
        bool: Success status
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(geojson_data, f, indent=2, ensure_ascii=False)
        
        file_size = os.path.getsize(output_path)
        coord_count = geojson_data['metadata']['coordinate_count']
        
        print(f"✅ Saved continuous I-49 route to: {output_path}")
        print(f"📊 File size: {file_size:,} bytes")
        print(f"📍 Route coordinates: {coord_count:,} points")
        
        # Show route endpoints
        route_coords = geojson_data['features'][0]['geometry']['coordinates']
        start_point = route_coords[0]
        end_point = route_coords[-1]
        
        print(f"🎯 Route endpoints:")
        print(f"   Start: [{start_point[0]:.4f}, {start_point[1]:.4f}] (North)")
        print(f"   End:   [{end_point[0]:.4f}, {end_point[1]:.4f}] (South)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error saving file: {e}")
        return False

def main():
    """
    Main execution function.
    """
    print("🛣️  I-49 Kansas City Continuous Route Creator")
    print("=" * 60)
    
    # Kansas City, Missouri coordinates
    KC_LAT = 39.0997
    KC_LON = -94.5786
    RADIUS_MILES = 500
    
    print(f"Center: Kansas City, MO ({KC_LAT}, {KC_LON})")
    print(f"Corridor: {RADIUS_MILES} miles north + {RADIUS_MILES} miles south = {RADIUS_MILES * 2}-mile total")
    print()
    
    # Generate waypoints along I-49 corridor
    print("Calculating I-49 corridor waypoints...")
    waypoints = get_i49_waypoints(KC_LAT, KC_LON, RADIUS_MILES)
    
    # Get continuous route from OSRM
    route_geometry = get_osrm_route(waypoints)
    
    if not route_geometry:
        print("❌ Failed to get continuous route")
        return False
    
    # Create GeoJSON
    metadata = {
        'center_coords': [KC_LON, KC_LAT],  # GeoJSON uses [lon, lat]
        'radius_miles': RADIUS_MILES
    }
    
    print("Creating GeoJSON feature...")
    geojson_data = create_geojson_feature(route_geometry, metadata)
    
    # Save to file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "..", "public", "data", "continuous_i49_kansas_city_corridor.geojson")
    
    success = save_geojson(geojson_data, output_path)
    
    if success:
        print(f"\n🎯 SUCCESS! Continuous I-49 route ready for mapping.")
        print(f"Load this file: {os.path.basename(output_path)}")
        print(f"\nThis creates a single continuous line following I-49 from:")
        print(f"  • Iowa/Minnesota border area (north)")
        print(f"  • Through Kansas City, MO (center)")  
        print(f"  • To Louisiana Gulf Coast area (south)")
        return True
    else:
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)