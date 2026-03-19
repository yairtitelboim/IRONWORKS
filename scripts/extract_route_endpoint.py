#!/usr/bin/env python3
"""
Extract the endpoint coordinates from the Leakey→Utopia→Hondo route to use as starting point for Hondo→Castroville route.
"""

import json

def main():
    # Read the existing route
    with open('../public/data/continuous_leakey_utopia_hondo_route.geojson', 'r') as f:
        data = json.load(f)
    
    # Get the coordinates
    coordinates = data['features'][0]['geometry']['coordinates']
    
    # Get the last coordinate (endpoint at Hondo)
    endpoint = coordinates[-1]
    print(f"Route endpoint (Hondo): [{endpoint[0]}, {endpoint[1]}]")
    print(f"Latitude: {endpoint[1]}")
    print(f"Longitude: {endpoint[0]}")
    
    # Also get first coordinate (starting point at Leakey) for reference
    startpoint = coordinates[0]
    print(f"\nRoute startpoint (Leakey): [{startpoint[0]}, {startpoint[1]}]")
    print(f"Total route coordinates: {len(coordinates)}")

if __name__ == "__main__":
    main()