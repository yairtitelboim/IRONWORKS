import overpy
import json
import time
import os

def download_full_south_platte_corridor():
    """Extract the ENTIRE South Platte River corridor without bounding box restrictions"""
    print("\n" + "="*80)
    print("🌊 FULL SOUTH PLATTE CORRIDOR EXTRACTION (NO BOUNDS)")
    print("="*80)
    
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    print(f"🎯 Objective: Extract the COMPLETE South Platte River corridor")
    print(f"🌊 Target: Entire South Platte River with much larger coverage")
    print(f"🗺️  Coverage: Larger bounding box (39.5°N to 40°N, 105.5°W to 104.5°W)")
    
    # Query for the South Platte River with a LARGER bounding box (covers Denver metro and beyond)
    # This gives us much more coverage than the original small box
    bbox = "39.5,-105.5,40.0,-104.5"  # Covers Denver metro area and beyond
    
    query = f"""
    [out:json][timeout:180];
    (
      // South Platte River - the main waterway
      way["waterway"="river"]["name"~"South Platte"]({bbox});
      way["waterway"="river"]["name"~"South Platte River"]({bbox});
      
      // Major tributaries and branches
      way["waterway"="river"]["name"~"Clear Creek"]({bbox});
      way["waterway"="river"]["name"~"Cherry Creek"]({bbox});
      way["waterway"="river"]["name"~"Bear Creek"]({bbox});
      way["waterway"="river"]["name"~"Sand Creek"]({bbox});
      
      // River segments and channels
      way["waterway"="stream"]["name"~"South Platte"]({bbox});
      way["waterway"="canal"]["name"~"South Platte"]({bbox});
      way["waterway"="ditch"]["name"~"South Platte"]({bbox});
      
      // Infrastructure along the corridor
      way["power"="line"]["name"~"South Platte"]({bbox});
      way["power"="line"]["name"~"Platte"]({bbox});
      way["man_made"="pipeline"]["name"~"South Platte"]({bbox});
      way["man_made"="pipeline"]["name"~"Platte"]({bbox});
      
      // Major infrastructure nodes
      node["power"="substation"]["name"~"South Platte"]({bbox});
      node["power"="substation"]["name"~"Platte"]({bbox});
      node["man_made"="water_works"]["name"~"South Platte"]({bbox});
      node["man_made"="water_works"]["name"~"Platte"]({bbox});
      node["man_made"="pumping_station"]["name"~"South Platte"]({bbox});
      node["man_made"="pumping_station"]["name"~"Platte"]({bbox});
      
      // Water infrastructure
      node["man_made"="water_tower"]["name"~"South Platte"]({bbox});
      node["man_made"="water_tower"]["name"~"Platte"]({bbox});
      node["man_made"="reservoir_covered"]["name"~"South Platte"]({bbox});
      node["man_made"="reservoir_covered"]["name"~"Platte"]({bbox});
      node["man_made"="wastewater_plant"]["name"~"South Platte"]({bbox});
      node["man_made"="wastewater_plant"]["name"~"Platte"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    print(f"\n🔍 Query Components:")
    print(f"   • Complete South Platte River (no bounds)")
    print(f"   • Major tributaries (Clear Creek, Cherry Creek, Bear Creek, Sand Creek)")
    print(f"   • Power infrastructure along the corridor")
    print(f"   • Water infrastructure and utilities")
    print(f"   • Pipeline infrastructure")
    
    max_retries = 3
    retry_delay = 15  # Longer delay for larger queries
    print(f"\n⏳ Executing Overpass query (max {max_retries} retries)...")
    print(f"   ⚠️  This may take longer due to no bounding box restrictions")
    
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
    
    # Process nodes (utilities, substations, water infrastructure)
    print(f"\n🏗️  Processing Nodes (Utility Infrastructure):")
    for node in result.nodes:
        node_count += 1
        node_name = node.tags.get('name', f'Utility {node.id}')
        utility_type = node.tags.get('man_made') or node.tags.get('power', 'unknown')
        
        if node_count <= 10:  # Show first 10 for debugging
            print(f"   Node {node_count}: {node_name} ({utility_type}) at [{node.lon:.6f}, {node.lat:.6f}]")
        elif node_count == 11:
            print(f"   ... and {len(result.nodes) - 10} more nodes")
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [float(node.lon), float(node.lat)]
            },
            'properties': {
                'name': node_name,
                'category': 'south_platte_corridor',
                'utility_type': utility_type,
                'osm_id': node.id,
                'osm_type': 'node',
                'tags': node.tags
            }
        }
        features.append(feature)
    
    # Process ways (river, power lines, pipelines, tributaries)
    print(f"\n🌊 Processing Ways (River & Infrastructure Lines):")
    for way in result.ways:
        way_count += 1
        way_name = way.tags.get('name', f'Infrastructure {way.id}')
        infrastructure_type = way.tags.get('waterway') or way.tags.get('power') or way.tags.get('man_made', 'unknown')
        node_count_in_way = len(way.nodes)
        
        if way_count <= 10:  # Show first 10 for debugging
            print(f"   Way {way_count}: {way_name} ({infrastructure_type}) with {node_count_in_way} nodes")
        elif way_count == 11:
            print(f"   ... and {len(result.ways) - 10} more ways")
        
        coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': coords
            },
            'properties': {
                'name': way_name,
                'category': 'south_platte_corridor',
                'infrastructure_type': infrastructure_type,
                'node_count': node_count_in_way,
                'osm_id': way.id,
                'osm_type': 'way',
                'tags': way.tags
            }
        }
        features.append(feature)
    
    # Output directory
    os.makedirs('public', exist_ok=True)
    filepath = os.path.join('public', 'denver_south_platte_corridor_full.geojson')
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    
    print(f"\n💾 Saving GeoJSON File:")
    print(f"   • File: {os.path.abspath(filepath)}")
    print(f"   • Total Features: {len(features)}")
    print(f"   • Utility Points: {node_count}")
    print(f"   • Infrastructure Lines: {way_count}")
    
    with open(filepath, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"   ✅ File saved successfully!")
    
    # Sample feature analysis
    if features:
        print(f"\n🔍 Sample Feature Analysis:")
        for i, feature in enumerate(features[:5]):  # Show first 5 features
            props = feature['properties']
            geom_type = feature['geometry']['type']
            print(f"   Feature {i+1}: {props['name']} ({geom_type})")
            print(f"      OSM ID: {props['osm_id']} | Type: {props.get('infrastructure_type', props.get('utility_type', 'N/A'))}")
            if 'tags' in props and props['tags']:
                key_tags = {k: v for k, v in props['tags'].items() if k in ['name', 'waterway', 'power', 'man_made', 'operator']}
                print(f"      Key Tags: {key_tags}")
    
    print(f"\n🎯 EXTRACTION SUMMARY:")
    print(f"   • Status: {'SUCCESS' if features else 'NO DATA FOUND'}")
    print(f"   • Features Extracted: {len(features)}")
    print(f"   • Coverage: COMPLETE (no bounding box restrictions)")
    print(f"   • File Location: {filepath}")
    print("="*80)

if __name__ == "__main__":
    print("\n🚀 Starting Full South Platte Corridor Extraction...")
    download_full_south_platte_corridor()
    print("\n✅ Extraction complete!")
