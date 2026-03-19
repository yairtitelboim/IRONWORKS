import overpy
import json
import time
import os
import math

def download_denver_sports_facilities():
    """Extract sports facilities in downtown Denver buffer area"""
    print("\n" + "="*80)
    print("🏈 DENVER SPORTS FACILITIES EXTRACTION")
    print("="*80)
    
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Downtown Denver with buffer for sports facilities
    center_lat, center_lon = 39.7550, -105.0050  # Center of downtown Denver
    radius_km = 5.0  # 5km radius buffer around downtown
    
    # Convert radius to approximate lat/lon degrees
    lat_radius = radius_km / 111.0  # 1 degree latitude ≈ 111 km
    lon_radius = radius_km / (111.0 * math.cos(math.radians(center_lat)))  # Adjust for longitude
    
    # Create bounding box
    lat_min = center_lat - lat_radius
    lat_max = center_lat + lat_radius
    lon_min = center_lon - lon_radius
    lon_max = center_lon + lon_radius
    
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"📍 Target Area: Downtown Denver Sports Facilities")
    print(f"🗺️  Center: {center_lat}, {center_lon}")
    print(f"📏 Radius: {radius_km}km")
    print(f"🗺️  Bounding Box: {bbox}")
    print(f"🎯 Objective: Find all sports facilities and recreational venues")
    
    query = f"""
    [out:json][timeout:300];
    (
      // Sports stadiums and arenas
      node["leisure"="stadium"]({bbox});
      node["amenity"="stadium"]({bbox});
      way["leisure"="stadium"]({bbox});
      way["amenity"="stadium"]({bbox});
      
      // Sports centres and complexes
      node["leisure"="sports_centre"]({bbox});
      node["leisure"="sports_complex"]({bbox});
      way["leisure"="sports_centre"]({bbox});
      way["leisure"="sports_complex"]({bbox});
      
      // Fitness and recreation
      node["leisure"="fitness_centre"]({bbox});
      node["amenity"="gym"]({bbox});
      node["leisure"="fitness_station"]({bbox});
      way["leisure"="fitness_centre"]({bbox});
      way["amenity"="gym"]({bbox});
      way["leisure"="fitness_station"]({bbox});
      
      // Specific sports facilities
      node["leisure"="pitch"]({bbox});
      node["leisure"="track"]({bbox});
      node["leisure"="swimming_pool"]({bbox});
      node["sport"]({bbox});
      way["leisure"="pitch"]({bbox});
      way["leisure"="track"]({bbox});
      way["leisure"="swimming_pool"]({bbox});
      way["sport"]({bbox});
      
      // Recreation areas
      node["leisure"="playground"]({bbox});
      node["leisure"="park"]({bbox});
      node["leisure"="recreation_ground"]({bbox});
      way["leisure"="playground"]({bbox});
      way["leisure"="park"]({bbox});
      way["leisure"="recreation_ground"]({bbox});
      
      // Entertainment venues
      node["amenity"="theatre"]({bbox});
      node["amenity"="cinema"]({bbox});
      node["amenity"="nightclub"]({bbox});
      node["amenity"="casino"]({bbox});
      way["amenity"="theatre"]({bbox});
      way["amenity"="cinema"]({bbox});
      way["amenity"="nightclub"]({bbox});
      way["amenity"="casino"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    print(f"\n🔍 Query Components:")
    print(f"   • Sports stadiums and arenas")
    print(f"   • Sports centres and complexes")
    print(f"   • Fitness centres and gyms")
    print(f"   • Specific sports facilities (pitches, tracks, pools)")
    print(f"   • Recreation areas and playgrounds")
    print(f"   • Entertainment venues")
    
    max_retries = 3
    retry_delay = 10
    print(f"\n⏳ Executing Overpass query (max {max_retries} retries)...")
    
    for attempt in range(max_retries):
        try:
            print(f"   Attempt {attempt + 1}/{max_retries}...")
            result = api.query(query)
            print(f"   ✅ Query successful!")
            break
        except overpy.exception.OverpassGatewayTimeout:
            if attempt < max_retries - 1:
                print(f"   ⚠️  Timeout error, retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                print(f"   ❌ Failed to download after {max_retries} attempts.")
                return
        except Exception as e:
            print(f"   ❌ Error downloading: {str(e)}")
            return
    
    print(f"\n📊 Raw OSM Data Retrieved:")
    print(f"   • Nodes: {len(result.nodes)}")
    print(f"   • Ways: {len(result.ways)}")
    print(f"   • Relations: {len(result.relations)}")
    
    features = []
    node_count = 0
    way_count = 0
    
    def categorize_facility(tags):
        """Categorize sports facility based on its tags"""
        leisure = tags.get('leisure', '')
        amenity = tags.get('amenity', '')
        sport = tags.get('sport', '')
        
        # Major venues
        if leisure == 'stadium' or amenity == 'stadium':
            return 'stadium'
        elif leisure in ['sports_centre', 'sports_complex']:
            return 'sports_centre'
        elif leisure == 'fitness_centre' or amenity == 'gym':
            return 'fitness'
        elif leisure in ['pitch', 'track', 'swimming_pool'] or sport:
            return 'sports_facility'
        elif leisure in ['playground', 'recreation_ground']:
            return 'recreation'
        elif leisure == 'park':
            return 'park'
        elif amenity in ['theatre', 'cinema', 'nightclub', 'casino']:
            return 'entertainment'
        else:
            return 'other'
    
    # Process nodes (points)
    print(f"\n🏗️  Processing Nodes (Sports Points):")
    for node in result.nodes:
        node_count += 1
        node_name = node.tags.get('name', f'Sports Facility {node.id}')
        category = categorize_facility(node.tags)
        
        print(f"   Node {node_count}: {node_name} ({category}) at [{node.lon:.6f}, {node.lat:.6f}]")
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [float(node.lon), float(node.lat)]
            },
            'properties': {
                'name': node_name,
                'category': 'denver_sports_facilities',
                'facility_type': category,
                'leisure': node.tags.get('leisure', ''),
                'amenity': node.tags.get('amenity', ''),
                'sport': node.tags.get('sport', ''),
                'osm_id': node.id,
                'osm_type': 'node',
                'tags': node.tags
            }
        }
        features.append(feature)
    
    # Process ways (areas and lines)
    print(f"\n🏟️  Processing Ways (Sports Areas):")
    for way in result.ways:
        way_count += 1
        way_name = way.tags.get('name', f'Sports Area {way.id}')
        category = categorize_facility(way.tags)
        node_count_in_way = len(way.nodes)
        
        print(f"   Way {way_count}: {way_name} ({category}) with {node_count_in_way} nodes")
        
        coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
        
        # Determine if it's a closed polygon or linestring
        is_closed = len(coords) > 2 and coords[0] == coords[-1]
        geometry_type = 'Polygon' if is_closed else 'LineString'
        geometry_coords = [coords] if is_closed else coords
        
        if len(coords) >= 2:
            print(f"      Start: [{coords[0][0]:.6f}, {coords[0][1]:.6f}]")
            print(f"      End:   [{coords[-1][0]:.6f}, {coords[-1][1]:.6f}]")
            print(f"      Type: {geometry_type}")
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': geometry_type,
                'coordinates': geometry_coords
            },
            'properties': {
                'name': way_name,
                'category': 'denver_sports_facilities',
                'facility_type': category,
                'leisure': way.tags.get('leisure', ''),
                'amenity': way.tags.get('amenity', ''),
                'sport': way.tags.get('sport', ''),
                'node_count': node_count_in_way,
                'osm_id': way.id,
                'osm_type': 'way',
                'tags': way.tags
            }
        }
        features.append(feature)
    
    # Output directory
    os.makedirs('public', exist_ok=True)
    filepath = os.path.join('public', 'denver_sports_facilities.geojson')
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    
    print(f"\n💾 Saving GeoJSON File:")
    print(f"   • File: {os.path.abspath(filepath)}")
    print(f"   • Total Features: {len(features)}")
    print(f"   • Sports Points: {node_count}")
    print(f"   • Sports Areas: {way_count}")
    
    with open(filepath, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"   ✅ File saved successfully!")
    
    # Categorize and count features by type
    category_counts = {}
    for feature in features:
        facility_type = feature['properties']['facility_type']
        category_counts[facility_type] = category_counts.get(facility_type, 0) + 1
    
    # Sample feature analysis
    if features:
        print(f"\n🔍 Feature Categories:")
        for category, count in sorted(category_counts.items()):
            print(f"   • {category}: {count} facilities")
        
        print(f"\n🔍 Sample Feature Analysis:")
        for i, feature in enumerate(features[:5]):  # Show first 5 features
            props = feature['properties']
            geom_type = feature['geometry']['type']
            print(f"   Feature {i+1}: {props['name']} ({geom_type})")
            print(f"      OSM ID: {props['osm_id']} | Type: {props['facility_type']}")
            if props['sport']:
                print(f"      Sport: {props['sport']}")
            if 'tags' in props and props['tags']:
                key_tags = {k: v for k, v in props['tags'].items() if k in ['name', 'leisure', 'amenity', 'sport', 'operator']}
                if key_tags:
                    print(f"      Key Tags: {key_tags}")
    
    print(f"\n🎯 EXTRACTION SUMMARY:")
    print(f"   • Status: {'SUCCESS' if features else 'NO DATA FOUND'}")
    print(f"   • Features Extracted: {len(features)}")
    print(f"   • File Location: {filepath}")
    print(f"   • Coverage: {radius_km}km radius around downtown Denver")
    print("="*80)
    
    return len(features)

if __name__ == "__main__":
    download_denver_sports_facilities()