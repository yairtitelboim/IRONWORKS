#!/usr/bin/env python3
"""
Create 2-mile circles around specified Texas locations.
This will create GeoJSON files with circular features for map visualization.
"""

import json
import math
import sys

def create_circle(center_lat, center_lon, radius_miles, num_points=64):
    """
    Create a circular polygon around a center point.
    
    Args:
        center_lat: Latitude of center point
        center_lon: Longitude of center point  
        radius_miles: Radius in miles
        num_points: Number of points to create the circle (more = smoother)
    
    Returns:
        GeoJSON polygon coordinates
    """
    # Convert miles to degrees (approximate)
    # 1 degree latitude ≈ 69 miles
    # 1 degree longitude varies by latitude, but roughly 69 * cos(lat) miles
    radius_lat = radius_miles / 69.0
    radius_lon = radius_miles / (69.0 * math.cos(math.radians(center_lat)))
    
    coordinates = []
    for i in range(num_points + 1):  # +1 to close the polygon
        angle = 2 * math.pi * i / num_points
        lat = center_lat + radius_lat * math.cos(angle)
        lon = center_lon + radius_lon * math.sin(angle)
        coordinates.append([lon, lat])  # GeoJSON uses [lon, lat] format
    
    return [coordinates]  # Polygon needs array of rings

def create_circle_feature(name, center_lat, center_lon, radius_miles=2):
    """Create a GeoJSON feature for a location circle."""
    coordinates = create_circle(center_lat, center_lon, radius_miles)
    
    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": coordinates
        },
        "properties": {
            "name": name,
            "center_lat": center_lat,
            "center_lon": center_lon,
            "radius_miles": radius_miles,
            "description": f"2-mile radius circle around {name}"
        }
    }

def main():
    # Texas location coordinates (lat, lon)
    locations = {
        "Sand Lake": (31.889, -102.892),     # Estimated coordinates
        "Baker": (30.784, -104.234),         # Baker, TX coordinates  
        "Fort Stockton South": (30.677, -102.879),  # South of Fort Stockton
        "Coyote": (31.156, -103.456)        # Estimated Coyote, TX coordinates
    }
    
    print("Creating 2-mile circles around specified locations...")
    
    # Create individual circle files for each location
    for location_name, (lat, lon) in locations.items():
        print(f"Creating circle for {location_name} at ({lat}, {lon})")
        
        # Create feature
        feature = create_circle_feature(location_name, lat, lon, radius_miles=2)
        
        # Create GeoJSON FeatureCollection
        geojson_data = {
            "type": "FeatureCollection",
            "features": [feature]
        }
        
        # Create safe filename
        safe_name = location_name.lower().replace(" ", "_")
        output_file = f'../public/data/{safe_name}_2mile_circle.geojson'
        
        # Save to file
        with open(output_file, 'w') as f:
            json.dump(geojson_data, f, separators=(',', ':'))
        
        print(f"✅ Saved {location_name} circle to: {output_file}")
        
        # Show file size
        import os
        file_size = os.path.getsize(output_file)
        print(f"📊 File size: {file_size:,} bytes")
    
    # Also create a combined file with all circles
    print("\nCreating combined circles file...")
    
    all_features = []
    for location_name, (lat, lon) in locations.items():
        feature = create_circle_feature(location_name, lat, lon, radius_miles=2)
        all_features.append(feature)
    
    combined_geojson = {
        "type": "FeatureCollection", 
        "features": all_features
    }
    
    combined_file = '../public/data/location_circles_2mile.geojson'
    with open(combined_file, 'w') as f:
        json.dump(combined_geojson, f, separators=(',', ':'))
    
    print(f"✅ Saved combined circles to: {combined_file}")
    
    # Show summary
    print(f"\n📋 Summary:")
    print(f"Created {len(locations)} individual circle files")
    print(f"Created 1 combined circles file")
    print(f"Each circle has 2-mile radius (65 points)")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)