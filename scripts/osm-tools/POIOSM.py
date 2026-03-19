import overpy
import json
import time
import os
import math
from math import ceil

def download_osm_pois():
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Austin coordinates
    lat_min, lon_min = 30.0, -98.0  # SW corner
    lat_max, lon_max = 30.5, -97.5  # NE corner
    
    # Split area into 3x3 grid for better performance
    lat_step = (lat_max - lat_min) / 3
    lon_step = (lon_max - lon_min) / 3
    
    # Initialize feature collections for different POI categories
    poi_features = {
        'logistics': [],  # Logistics and industrial
        'transportation': [],  # Transportation hubs
        'commercial': [],  # Commercial areas
        'services': [],  # Services and amenities
        'education': [],  # Educational institutions
        'healthcare': [],  # Healthcare facilities
        'leisure': [],  # Leisure and recreation
        'other': []
    }
    
    print("Downloading Austin POI data from OpenStreetMap in chunks...")
    
    for i in range(3):
        for j in range(3):
            chunk_lat_min = lat_min + (i * lat_step)
            chunk_lat_max = lat_min + ((i + 1) * lat_step)
            chunk_lon_min = lon_min + (j * lon_step)
            chunk_lon_max = lon_min + ((j + 1) * lon_step)
            
            bbox = f"{chunk_lat_min},{chunk_lon_min},{chunk_lat_max},{chunk_lon_max}"
            
            # Enhanced query for more POIs
            poi_query = f"""
            [out:json][timeout:300];
            (
              // Logistics and Industrial
              node["landuse"="industrial"]({bbox});
              node["industrial"="logistics"]({bbox});
              node["industrial"="warehouse"]({bbox});
              node["building"="warehouse"]({bbox});
              node["building"="industrial"]({bbox});
              
              // Transportation
              node["amenity"="bus_station"]({bbox});
              node["amenity"="subway_entrance"]({bbox});
              node["railway"="station"]({bbox});
              node["railway"="freight_yard"]({bbox});
              node["railway"="yard"]({bbox});
              node["highway"="bus_stop"]({bbox});
              node["amenity"="taxi"]({bbox});
              node["amenity"="ferry_terminal"]({bbox});
              
              // Commercial
              node["shop"]({bbox});
              node["amenity"="marketplace"]({bbox});
              node["amenity"="mall"]({bbox});
              node["building"="commercial"]({bbox});
              node["building"="retail"]({bbox});
              
              // Services
              node["amenity"="bank"]({bbox});
              node["amenity"="post_office"]({bbox});
              node["amenity"="courthouse"]({bbox});
              node["amenity"="police"]({bbox});
              node["amenity"="fire_station"]({bbox});
              node["amenity"="townhall"]({bbox});
              
              // Education
              node["amenity"="school"]({bbox});
              node["amenity"="university"]({bbox});
              node["amenity"="college"]({bbox});
              node["amenity"="kindergarten"]({bbox});
              node["amenity"="library"]({bbox});
              
              // Healthcare
              node["amenity"="hospital"]({bbox});
              node["amenity"="clinic"]({bbox});
              node["amenity"="pharmacy"]({bbox});
              node["amenity"="doctors"]({bbox});
              node["amenity"="dentist"]({bbox});
              
              // Leisure
              node["leisure"="park"]({bbox});
              node["leisure"="garden"]({bbox});
              node["leisure"="sports_centre"]({bbox});
              node["leisure"="fitness_centre"]({bbox});
              node["amenity"="cinema"]({bbox});
              node["amenity"="theatre"]({bbox});
              node["amenity"="museum"]({bbox});
              node["amenity"="arts_centre"]({bbox});
              node["amenity"="stadium"]({bbox});
              
              // Food and Drink
              node["amenity"="restaurant"]({bbox});
              node["amenity"="cafe"]({bbox});
              node["amenity"="bar"]({bbox});
              node["amenity"="fast_food"]({bbox});
              node["amenity"="food_court"]({bbox});
              
              // Religious
              node["amenity"="place_of_worship"]({bbox});
              node["building"="church"]({bbox});
              node["building"="mosque"]({bbox});
              node["building"="temple"]({bbox});
              
              // Accommodation
              node["tourism"="hotel"]({bbox});
              node["tourism"="hostel"]({bbox});
              node["tourism"="guest_house"]({bbox});
              
              // Other Important
              node["amenity"="fuel"]({bbox});
              node["amenity"="car_wash"]({bbox});
              node["amenity"="car_repair"]({bbox});
              node["amenity"="parking"]({bbox});
              node["amenity"="waste_basket"]({bbox});
              node["amenity"="waste_disposal"]({bbox});
              node["amenity"="recycling"]({bbox});
            );
            out body;
            >;
            out skel qt;
            """
            
            max_retries = 3
            retry_delay = 10  # seconds
            
            for attempt in range(max_retries):
                try:
                    print(f"Downloading chunk {(i*3)+j+1}/9...")
                    result = api.query(poi_query)
                    
                    # Process nodes
                    for node in result.nodes:
                        try:
                            feature = {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'Point',
                                    'coordinates': [float(node.lon), float(node.lat)]
                                },
                                'properties': {
                                    'name': node.tags.get('name', 'Unnamed'),
                                    'type': node.tags.get('amenity') or node.tags.get('shop') or node.tags.get('leisure'),
                                    'category': categorize_poi(node.tags),
                                    'description': node.tags.get('description', ''),
                                    'website': node.tags.get('website', ''),
                                    'phone': node.tags.get('phone', ''),
                                    'opening_hours': node.tags.get('opening_hours', ''),
                                    'wheelchair': node.tags.get('wheelchair', ''),
                                    'osm_id': node.id,
                                    'osm_type': 'node',
                                    'tags': node.tags
                                }
                            }
                            
                            # Add to appropriate category
                            category = categorize_poi(node.tags)
                            if category in poi_features:
                                poi_features[category].append(feature)
                            else:
                                poi_features['other'].append(feature)
                                
                        except Exception as e:
                            print(f"Error processing node {node.id}: {str(e)}")
                            continue
                    
                    print(f"Processed features in chunk {(i*3)+j+1}")
                    break
                    
                except overpy.exception.OverpassGatewayTimeout:
                    if attempt < max_retries - 1:
                        print(f"Timeout error, retrying in {retry_delay} seconds... (Attempt {attempt + 1}/{max_retries})")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        print(f"Failed to download chunk after {max_retries} attempts, skipping...")
                
                except Exception as e:
                    print(f"Error downloading chunk: {str(e)}")
                    break
                
            time.sleep(2)
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.join('public', 'data', 'osm'), exist_ok=True)
    
    # Create separate GeoJSON files for each category
    output_files = {}
    for category, features in poi_features.items():
        if features:  # Only create files for non-empty feature collections
            geojson = {
                'type': 'FeatureCollection',
                'features': features
            }
            
            filename = f'austin_{category}.geojson'
            filepath = os.path.join('public', 'data', 'osm', filename)
            with open(filepath, 'w') as f:
                json.dump(geojson, f)
            output_files[category] = os.path.abspath(filepath)
    
    print("\nDownload complete!")
    print("Files created:")
    for category, filepath in output_files.items():
        print(f"\n{category}:")
        print(f"- File: {filepath}")
        print(f"- Features: {len(poi_features[category])}")

def download_austin_networks(batch_size=3):
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Austin coordinates
    lat_min, lon_min = 30.0, -98.0  # SW corner
    lat_max, lon_max = 30.5, -97.5  # NE corner
    
    # Split area into batch_size x batch_size grid for better performance
    lat_step = (lat_max - lat_min) / batch_size
    lon_step = (lon_max - lon_min) / batch_size
    
    # Initialize feature collections for bike lanes and pedestrian networks
    bike_features = []
    pedestrian_features = []
    
    print("Downloading Austin bike and pedestrian network data from OpenStreetMap in batches...")
    
    for i in range(batch_size):
        for j in range(batch_size):
            chunk_lat_min = lat_min + (i * lat_step)
            chunk_lat_max = lat_min + ((i + 1) * lat_step)
            chunk_lon_min = lon_min + (j * lon_step)
            chunk_lon_max = lon_min + ((j + 1) * lon_step)
            
            bbox = f"{chunk_lat_min},{chunk_lon_min},{chunk_lat_max},{chunk_lon_max}"
            
            print(f"Processing batch {(i*batch_size)+j+1}/{batch_size*batch_size} with bbox: {bbox}")
            
            # Query for bike lanes
            bike_query = f"""
            [out:json][timeout:300];
            (
              way["highway"="cycleway"]({bbox});
              way["cycleway"]({bbox});
            );
            out body;
            >;
            out skel qt;
            """
            
            # Query for pedestrian paths
            pedestrian_query = f"""
            [out:json][timeout:300];
            (
              way["highway"="footway"]({bbox});
              way["highway"="path"]({bbox});
              way["highway"="pedestrian"]({bbox});
            );
            out body;
            >;
            out skel qt;
            """
            
            max_retries = 3
            retry_delay = 10  # seconds
            
            for attempt in range(max_retries):
                try:
                    print(f"Downloading bike network batch {(i*batch_size)+j+1}/{batch_size*batch_size}...")
                    bike_result = api.query(bike_query)
                    
                    for way in bike_result.ways:
                        try:
                            feature = {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'LineString',
                                    'coordinates': [[float(node.lon), float(node.lat)] for node in way.nodes]
                                },
                                'properties': {
                                    'name': way.tags.get('name', 'Unnamed'),
                                    'type': 'cycleway',
                                    'osm_id': way.id,
                                    'osm_type': 'way',
                                    'tags': way.tags
                                }
                            }
                            bike_features.append(feature)
                        except Exception as e:
                            print(f"Error processing bike way {way.id}: {str(e)}")
                            continue
                    
                    print(f"Processed bike features in batch {(i*batch_size)+j+1}")
                    break
                    
                except overpy.exception.OverpassGatewayTimeout:
                    if attempt < max_retries - 1:
                        print(f"Timeout error, retrying in {retry_delay} seconds... (Attempt {attempt + 1}/{max_retries})")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        print(f"Failed to download bike batch after {max_retries} attempts, skipping...")
                
                except Exception as e:
                    print(f"Error downloading bike batch: {str(e)}")
                    break
            
            time.sleep(2)
            
            for attempt in range(max_retries):
                try:
                    print(f"Downloading pedestrian network batch {(i*batch_size)+j+1}/{batch_size*batch_size}...")
                    pedestrian_result = api.query(pedestrian_query)
                    
                    for way in pedestrian_result.ways:
                        try:
                            feature = {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'LineString',
                                    'coordinates': [[float(node.lon), float(node.lat)] for node in way.nodes]
                                },
                                'properties': {
                                    'name': way.tags.get('name', 'Unnamed'),
                                    'type': 'footway',
                                    'osm_id': way.id,
                                    'osm_type': 'way',
                                    'tags': way.tags
                                }
                            }
                            pedestrian_features.append(feature)
                        except Exception as e:
                            print(f"Error processing pedestrian way {way.id}: {str(e)}")
                            continue
                    
                    print(f"Processed pedestrian features in batch {(i*batch_size)+j+1}")
                    break
                    
                except overpy.exception.OverpassGatewayTimeout:
                    if attempt < max_retries - 1:
                        print(f"Timeout error, retrying in {retry_delay} seconds... (Attempt {attempt + 1}/{max_retries})")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        print(f"Failed to download pedestrian batch after {max_retries} attempts, skipping...")
                
                except Exception as e:
                    print(f"Error downloading pedestrian batch: {str(e)}")
                    break
            
            time.sleep(2)
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.join('public', 'data', 'osm'), exist_ok=True)
    
    # Create GeoJSON files for bike and pedestrian networks
    if bike_features:
        bike_geojson = {
            'type': 'FeatureCollection',
            'features': bike_features
        }
        bike_filepath = os.path.join('public', 'data', 'osm', 'austin_bike_network.geojson')
        with open(bike_filepath, 'w') as f:
            json.dump(bike_geojson, f)
        print(f"\nBike network file created: {os.path.abspath(bike_filepath)}")
        print(f"- Features: {len(bike_features)}")
    
    if pedestrian_features:
        pedestrian_geojson = {
            'type': 'FeatureCollection',
            'features': pedestrian_features
        }
        pedestrian_filepath = os.path.join('public', 'data', 'osm', 'austin_pedestrian_network.geojson')
        with open(pedestrian_filepath, 'w') as f:
            json.dump(pedestrian_geojson, f)
        print(f"\nPedestrian network file created: {os.path.abspath(pedestrian_filepath)}")
        print(f"- Features: {len(pedestrian_features)}")

def download_power_corridor_pois():
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')

    # Bounding box: Fort Stockton (W) to San Antonio (E), with buffer
    # Roughly: SW (30.5, -103.0), NE (30.0, -98.0)
    lat_min, lon_min = 29.0, -103.0  # SW corner (buffered south)
    lat_max, lon_max = 30.5, -97.0   # NE corner (buffered east)
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"

    print(f"\nDownloading Power Grid Supply/Demand/Data Center POIs for corridor: {bbox}\n")

    # Overpass query for power supply, demand, and data center POIs
    poi_query = f"""
    [out:json][timeout:300];
    (
      // Power supply
      node["power"="plant"]({bbox});
      node["power"="substation"]({bbox});
      node["power"="generator"]({bbox});
      node["power"="transformer"]({bbox});
      way["power"="plant"]({bbox});
      way["power"="substation"]({bbox});
      way["power"="generator"]({bbox});
      way["power"="transformer"]({bbox});
      relation["power"="plant"]({bbox});
      relation["power"="substation"]({bbox});
      relation["power"="generator"]({bbox});
      relation["power"="transformer"]({bbox});

      // Data centers (rare)
      node["building"="data_center"]({bbox});
      node["man_made"="data_center"]({bbox});
      node["industrial"="data_center"]({bbox});
      way["building"="data_center"]({bbox});
      way["man_made"="data_center"]({bbox});
      way["industrial"="data_center"]({bbox});
      relation["building"="data_center"]({bbox});
      relation["man_made"="data_center"]({bbox});
      relation["industrial"="data_center"]({bbox});

      // Power demand (large consumers)
      node["building"="industrial"]({bbox});
      node["landuse"="industrial"]({bbox});
      node["building"="commercial"]({bbox});
      node["shop"="supermarket"]({bbox});
      node["amenity"="mall"]({bbox});
      node["amenity"="hospital"]({bbox});
      node["amenity"="university"]({bbox});
      node["amenity"="prison"]({bbox});
      node["amenity"="school"]({bbox});
      way["building"="industrial"]({bbox});
      way["landuse"="industrial"]({bbox});
      way["building"="commercial"]({bbox});
      way["shop"="supermarket"]({bbox});
      way["amenity"="mall"]({bbox});
      way["amenity"="hospital"]({bbox});
      way["amenity"="university"]({bbox});
      way["amenity"="prison"]({bbox});
      way["amenity"="school"]({bbox});
      relation["building"="industrial"]({bbox});
      relation["landuse"="industrial"]({bbox});
      relation["building"="commercial"]({bbox});
      relation["shop"="supermarket"]({bbox});
      relation["amenity"="mall"]({bbox});
      relation["amenity"="hospital"]({bbox});
      relation["amenity"="university"]({bbox});
      relation["amenity"="prison"]({bbox});
      relation["amenity"="school"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """

    max_retries = 3
    retry_delay = 10
    for attempt in range(max_retries):
        try:
            result = api.query(poi_query)
            break
        except overpy.exception.OverpassGatewayTimeout:
            if attempt < max_retries - 1:
                print(f"Timeout error, retrying in {retry_delay} seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                print(f"Failed to download after {max_retries} attempts.")
                return
        except Exception as e:
            print(f"Error downloading: {str(e)}")
            return

    # Categorize features
    features = {
        'power_supply': [],
        'power_demand': [],
        'data_center': [],
        'other': []
    }

    def categorize(tags):
        if tags.get('power') in ['plant', 'substation', 'generator', 'transformer']:
            return 'power_supply'
        if tags.get('building') == 'data_center' or tags.get('man_made') == 'data_center' or tags.get('industrial') == 'data_center':
            return 'data_center'
        if tags.get('building') in ['industrial', 'commercial'] or tags.get('landuse') == 'industrial' or tags.get('shop') == 'supermarket' or tags.get('amenity') in ['mall', 'hospital', 'university', 'prison', 'school']:
            return 'power_demand'
        return 'other'

    # Process nodes
    for node in result.nodes:
        cat = categorize(node.tags)
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [float(node.lon), float(node.lat)]
            },
            'properties': {
                'name': node.tags.get('name', 'Unnamed'),
                'category': cat,
                'osm_id': node.id,
                'osm_type': 'node',
                'tags': node.tags
            }
        }
        features[cat].append(feature)

    # Process ways
    for way in result.ways:
        cat = categorize(way.tags)
        coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'LineString' if len(coords) > 1 else 'Point',
                'coordinates': coords if len(coords) > 1 else coords[0]
            },
            'properties': {
                'name': way.tags.get('name', 'Unnamed'),
                'category': cat,
                'osm_id': way.id,
                'osm_type': 'way',
                'tags': way.tags
            }
        }
        features[cat].append(feature)

    # Process relations
    for rel in result.relations:
        cat = categorize(rel.tags)
        feature = {
            'type': 'Feature',
            'geometry': None,  # Geometry for relations is complex; skipping for now
            'properties': {
                'name': rel.tags.get('name', 'Unnamed'),
                'category': cat,
                'osm_id': rel.id,
                'osm_type': 'relation',
                'tags': rel.tags
            }
        }
        features[cat].append(feature)

    # Output directory
    os.makedirs(os.path.join('public', 'data', 'osm'), exist_ok=True)
    output_files = {}
    for cat, feats in features.items():
        if feats:
            geojson = {
                'type': 'FeatureCollection',
                'features': feats
            }
            filename = f'corridor_{cat}.geojson'
            filepath = os.path.join('public', 'data', 'osm', filename)
            with open(filepath, 'w') as f:
                json.dump(geojson, f)
            output_files[cat] = os.path.abspath(filepath)

    print("\nDownload complete! Files created:")
    for cat, filepath in output_files.items():
        print(f"\n{cat}:")
        print(f"- File: {filepath}")
        print(f"- Features: {len(features[cat])}")
        # Print up to 3 sample features for each category
        for idx, feat in enumerate(features[cat][:3]):
            print(f"  Sample {idx+1}: {json.dumps(feat['properties'], indent=2)[:500]}")
    print("\nSummary:")
    for cat in features:
        print(f"{cat}: {len(features[cat])} features")

def save_first_5k_power_supply():
    """Extract and save the first 5000 power_supply features from the full GeoJSON."""
    import json
    import os
    input_path = os.path.join('public', 'data', 'osm', 'corridor_power_supply.geojson')
    output_path = os.path.join('public', 'data', 'osm', 'corridor_power_supply_5k.geojson')
    with open(input_path, 'r') as f:
        data = json.load(f)
    features = data.get('features', [])[:5000]
    out = {
        'type': 'FeatureCollection',
        'features': features
    }
    with open(output_path, 'w') as f:
        json.dump(out, f)
    print(f"Saved first 5000 power_supply features to: {os.path.abspath(output_path)} (count: {len(features)})")

def save_first_5k_power_demand():
    """Extract and save the first 5000 power_demand features from the full GeoJSON."""
    import json
    import os
    input_path = os.path.join('public', 'data', 'osm', 'corridor_power_demand.geojson')
    output_path = os.path.join('public', 'data', 'osm', 'corridor_power_demand_5k.geojson')
    with open(input_path, 'r') as f:
        data = json.load(f)
    features = data.get('features', [])[:5000]
    out = {
        'type': 'FeatureCollection',
        'features': features
    }
    with open(output_path, 'w') as f:
        json.dump(out, f)
    print(f"Saved first 5000 power_demand features to: {os.path.abspath(output_path)} (count: {len(features)})")

def download_water_corridor_pois():
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')

    # Bounding box: Fort Stockton (W) to San Antonio (E), with buffer
    lat_min, lon_min = 29.0, -103.0  # SW corner
    lat_max, lon_max = 30.5, -97.0   # NE corner
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"

    print(f"\nDownloading Water-related POIs for corridor: {bbox}\n")

    # Overpass query for water-related POIs
    poi_query = f"""
    [out:json][timeout:300];
    (
      // Water infrastructure
      node["man_made"="water_tower"]({bbox});
      node["man_made"="reservoir_covered"]({bbox});
      node["man_made"="wastewater_plant"]({bbox});
      node["man_made"="water_works"]({bbox});
      node["man_made"="water_well"]({bbox});
      node["man_made"="pumping_station"]({bbox});
      node["amenity"="drinking_water"]({bbox});
      node["amenity"="water_point"]({bbox});
      node["amenity"="water_tank"]({bbox});
      way["man_made"="water_tower"]({bbox});
      way["man_made"="reservoir_covered"]({bbox});
      way["man_made"="wastewater_plant"]({bbox});
      way["man_made"="water_works"]({bbox});
      way["man_made"="water_well"]({bbox});
      way["man_made"="pumping_station"]({bbox});
      way["amenity"="drinking_water"]({bbox});
      way["amenity"="water_point"]({bbox});
      way["amenity"="water_tank"]({bbox});
      relation["man_made"="water_tower"]({bbox});
      relation["man_made"="reservoir_covered"]({bbox});
      relation["man_made"="wastewater_plant"]({bbox});
      relation["man_made"="water_works"]({bbox});
      relation["man_made"="water_well"]({bbox});
      relation["man_made"="pumping_station"]({bbox});
      relation["amenity"="drinking_water"]({bbox});
      relation["amenity"="water_point"]({bbox});
      relation["amenity"="water_tank"]({bbox});

      // Surface water features
      node["natural"="water"]({bbox});
      node["water"="lake"]({bbox});
      node["water"="pond"]({bbox});
      node["water"="reservoir"]({bbox});
      node["waterway"="dam"]({bbox});
      node["waterway"="weir"]({bbox});
      way["natural"="water"]({bbox});
      way["water"="lake"]({bbox});
      way["water"="pond"]({bbox});
      way["water"="reservoir"]({bbox});
      way["waterway"="dam"]({bbox});
      way["waterway"="weir"]({bbox});
      relation["natural"="water"]({bbox});
      relation["water"="lake"]({bbox});
      relation["water"="pond"]({bbox});
      relation["water"="reservoir"]({bbox});
      relation["waterway"="dam"]({bbox});
      relation["waterway"="weir"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """

    max_retries = 3
    retry_delay = 10
    for attempt in range(max_retries):
        try:
            result = api.query(poi_query)
            break
        except overpy.exception.OverpassGatewayTimeout:
            if attempt < max_retries - 1:
                print(f"Timeout error, retrying in {retry_delay} seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                print(f"Failed to download after {max_retries} attempts.")
                return
        except Exception as e:
            print(f"Error downloading: {str(e)}")
            return

    features = []
    def make_feature(obj, geom_type, coords):
        return {
            'type': 'Feature',
            'geometry': {
                'type': geom_type,
                'coordinates': coords
            },
            'properties': {
                'name': obj.tags.get('name', 'Unnamed'),
                'osm_id': obj.id,
                'osm_type': obj.__class__.__name__.lower(),
                'tags': obj.tags
            }
        }

    # Process nodes
    for node in result.nodes:
        features.append(make_feature(node, 'Point', [float(node.lon), float(node.lat)]))
    # Process ways
    for way in result.ways:
        coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
        features.append(make_feature(way, 'LineString' if len(coords) > 1 else 'Point', coords if len(coords) > 1 else coords[0]))
    # Process relations (geometry skipped)
    for rel in result.relations:
        features.append(make_feature(rel, 'GeometryCollection', []))

    # Output directory
    os.makedirs(os.path.join('public', 'data', 'osm'), exist_ok=True)
    filepath = os.path.join('public', 'data', 'osm', 'corridor_water.geojson')
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    with open(filepath, 'w') as f:
        json.dump(geojson, f)
    print(f"\nWater POIs saved to: {os.path.abspath(filepath)} (features: {len(features)})")
    if features:
        print("Sample feature:", json.dumps(features[0]['properties'], indent=2)[:500])

def download_nw_austin_power_demand():
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')

    # NW Austin bounding box (approximate)
    lat_min, lon_min = 30.30, -98.00  # SW corner
    lat_max, lon_max = 30.55, -97.60  # NE corner
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"

    print(f"\nDownloading Power Demand POIs for NW Austin: {bbox}\n")

    # Overpass query for power demand POIs (expanded tags)
    poi_query = f"""
    [out:json][timeout:300];
    (
      node["building"="industrial"]({bbox});
      node["landuse"="industrial"]({bbox});
      node["building"="commercial"]({bbox});
      node["shop"]({bbox});
      node["amenity"="mall"]({bbox});
      node["amenity"="hospital"]({bbox});
      node["amenity"="university"]({bbox});
      node["amenity"="prison"]({bbox});
      node["amenity"="school"]({bbox});
      node["office"]({bbox});
      node["amenity"="college"]({bbox});
      node["amenity"="kindergarten"]({bbox});
      node["amenity"="library"]({bbox});
      node["amenity"="bank"]({bbox});
      node["amenity"="post_office"]({bbox});
      node["amenity"="courthouse"]({bbox});
      node["amenity"="police"]({bbox});
      node["amenity"="fire_station"]({bbox});
      node["amenity"="townhall"]({bbox});
      way["building"="industrial"]({bbox});
      way["landuse"="industrial"]({bbox});
      way["building"="commercial"]({bbox});
      way["shop"]({bbox});
      way["amenity"="mall"]({bbox});
      way["amenity"="hospital"]({bbox});
      way["amenity"="university"]({bbox});
      way["amenity"="prison"]({bbox});
      way["amenity"="school"]({bbox});
      way["office"]({bbox});
      way["amenity"="college"]({bbox});
      way["amenity"="kindergarten"]({bbox});
      way["amenity"="library"]({bbox});
      way["amenity"="bank"]({bbox});
      way["amenity"="post_office"]({bbox});
      way["amenity"="courthouse"]({bbox});
      way["amenity"="police"]({bbox});
      way["amenity"="fire_station"]({bbox});
      way["amenity"="townhall"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """

    max_retries = 3
    retry_delay = 10
    for attempt in range(max_retries):
        try:
            result = api.query(poi_query)
            break
        except overpy.exception.OverpassGatewayTimeout:
            if attempt < max_retries - 1:
                print(f"Timeout error, retrying in {retry_delay} seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                print(f"Failed to download after {max_retries} attempts.")
                return
        except Exception as e:
            print(f"Error downloading: {str(e)}")
            return

    features = []
    def make_feature(obj, geom_type, coords):
        return {
            'type': 'Feature',
            'geometry': {
                'type': geom_type,
                'coordinates': coords
            },
            'properties': {
                'name': obj.tags.get('name', 'Unnamed'),
                'osm_id': obj.id,
                'osm_type': obj.__class__.__name__.lower(),
                'tags': obj.tags
            }
        }

    # Process nodes
    for node in result.nodes:
        features.append(make_feature(node, 'Point', [float(node.lon), float(node.lat)]))
    # Process ways
    for way in result.ways:
        coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
        features.append(make_feature(way, 'LineString' if len(coords) > 1 else 'Point', coords if len(coords) > 1 else coords[0]))

    # Output directory
    os.makedirs(os.path.join('public', 'data', 'osm'), exist_ok=True)
    filepath = os.path.join('public', 'data', 'osm', 'nw_austin_power_demand.geojson')
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    with open(filepath, 'w') as f:
        json.dump(geojson, f)
    print(f"\nNW Austin Power Demand POIs saved to: {os.path.abspath(filepath)} (features: {len(features)})")
    if features:
        print("Sample feature:", json.dumps(features[0]['properties'], indent=2)[:500])

def categorize_poi(tags):
    """Categorize a POI based on its tags"""
    amenity = tags.get('amenity', '')
    shop = tags.get('shop', '')
    leisure = tags.get('leisure', '')
    building = tags.get('building', '')
    tourism = tags.get('tourism', '')
    
    # Logistics and Industrial
    if (amenity in ['warehouse', 'industrial'] or 
        building in ['warehouse', 'industrial'] or 
        tags.get('industrial') in ['logistics', 'warehouse']):
        return 'logistics'
    
    # Transportation
    if (amenity in ['bus_station', 'subway_entrance', 'taxi', 'ferry_terminal'] or
        tags.get('railway') in ['station', 'freight_yard', 'yard'] or
        tags.get('highway') == 'bus_stop'):
        return 'transportation'
    
    # Commercial
    if (shop or 
        amenity in ['marketplace', 'mall'] or 
        building in ['commercial', 'retail']):
        return 'commercial'
    
    # Services
    if amenity in ['bank', 'post_office', 'courthouse', 'police', 'fire_station', 'townhall']:
        return 'services'
    
    # Education
    if amenity in ['school', 'university', 'college', 'kindergarten', 'library']:
        return 'education'
    
    # Healthcare
    if amenity in ['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist']:
        return 'healthcare'
    
    # Leisure
    if (leisure in ['park', 'garden', 'sports_centre', 'fitness_centre'] or
        amenity in ['cinema', 'theatre', 'museum', 'arts_centre', 'stadium']):
        return 'leisure'
    
    return 'other'

def download_denver_light_rail_convergence():
    """Extract light rail E/W line convergence at Ball Arena"""
    print("\n" + "="*80)
    print("🚊 DENVER LIGHT RAIL CONVERGENCE EXTRACTION")
    print("="*80)
    
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Ball Arena district (focused on light rail convergence)
    lat_min, lon_min = 39.7450, -105.0150  # SW corner
    lat_max, lon_max = 39.7550, -105.0000  # NE corner
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"📍 Target Area: Ball Arena District")
    print(f"🗺️  Bounding Box: {bbox}")
    print(f"🎯 Objective: Find E/W light rail lines converging at Ball Arena")
    
    query = f"""
    [out:json][timeout:300];
    (
      node["railway"="station"]["name"~"Ball Arena|Union Station"]({bbox});
      way["railway"="light_rail"]({bbox});
      node["railway"="tram_stop"]({bbox});
      way["railway"="tram"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    print(f"\n🔍 Query Components:")
    print(f"   • Railway stations (Ball Arena, Union Station)")
    print(f"   • Light rail ways")
    print(f"   • Tram stops and ways")
    
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
    
    # Process nodes (stations, stops)
    print(f"\n🏗️  Processing Nodes (Stations/Stops):")
    for node in result.nodes:
        node_count += 1
        node_name = node.tags.get('name', f'Unnamed Station {node.id}')
        railway_type = node.tags.get('railway', 'unknown')
        
        print(f"   Node {node_count}: {node_name} ({railway_type}) at [{node.lon:.6f}, {node.lat:.6f}]")
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [float(node.lon), float(node.lat)]
            },
            'properties': {
                'name': node_name,
                'category': 'light_rail_convergence',
                'railway_type': railway_type,
                'osm_id': node.id,
                'osm_type': 'node',
                'tags': node.tags
            }
        }
        features.append(feature)
    
    # Process ways (rail lines)
    print(f"\n🛤️  Processing Ways (Rail Lines):")
    for way in result.ways:
        way_count += 1
        way_name = way.tags.get('name', f'Unnamed Line {way.id}')
        railway_type = way.tags.get('railway', 'unknown')
        node_count_in_way = len(way.nodes)
        
        print(f"   Way {way_count}: {way_name} ({railway_type}) with {node_count_in_way} nodes")
        
        coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
        
        if len(coords) >= 2:
            print(f"      Start: [{coords[0][0]:.6f}, {coords[0][1]:.6f}]")
            print(f"      End:   [{coords[-1][0]:.6f}, {coords[-1][1]:.6f}]")
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': coords
            },
            'properties': {
                'name': way_name,
                'category': 'light_rail_convergence',
                'railway_type': railway_type,
                'node_count': node_count_in_way,
                'osm_id': way.id,
                'osm_type': 'way',
                'tags': way.tags
            }
        }
        features.append(feature)
    
    # Output directory
    os.makedirs('public', exist_ok=True)
    filepath = os.path.join('public', 'denver_light_rail_convergence.geojson')
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    
    print(f"\n💾 Saving GeoJSON File:")
    print(f"   • File: {os.path.abspath(filepath)}")
    print(f"   • Total Features: {len(features)}")
    print(f"   • Stations/Stops: {node_count}")
    print(f"   • Rail Lines: {way_count}")
    
    with open(filepath, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"   ✅ File saved successfully!")
    
    # Sample feature analysis
    if features:
        print(f"\n🔍 Sample Feature Analysis:")
        for i, feature in enumerate(features[:3]):  # Show first 3 features
            props = feature['properties']
            geom_type = feature['geometry']['type']
            print(f"   Feature {i+1}: {props['name']} ({geom_type})")
            print(f"      OSM ID: {props['osm_id']} | Type: {props.get('railway_type', 'N/A')}")
            if 'tags' in props and props['tags']:
                key_tags = {k: v for k, v in props['tags'].items() if k in ['name', 'railway', 'operator', 'service']}
                print(f"      Key Tags: {key_tags}")
    
    print(f"\n🎯 EXTRACTION SUMMARY:")
    print(f"   • Status: {'SUCCESS' if features else 'NO DATA FOUND'}")
    print(f"   • Features Extracted: {len(features)}")
    print(f"   • File Location: {filepath}")
    print("="*80)

def download_denver_south_platte_corridor():
    """Extract South Platte River corridor utility capacity"""
    print("\n" + "="*80)
    print("🌊 DENVER SOUTH PLATTE CORRIDOR EXTRACTION")
    print("="*80)
    
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    lat_min, lon_min = 39.7400, -105.0200  # SW corner
    lat_max, lon_max = 39.7600, -104.9900  # NE corner
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"📍 Target Area: South Platte River Corridor")
    print(f"🗺️  Bounding Box: {bbox}")
    print(f"🎯 Objective: Map utility infrastructure supporting 6,000+ housing units")
    
    query = f"""
    [out:json][timeout:300];
    (
      way["waterway"="river"]["name"~"South Platte"]({bbox});
      node["man_made"="water_works"]({bbox});
      node["power"="substation"]({bbox});
      way["power"="line"]({bbox});
      node["man_made"="pipeline"]({bbox});
      way["man_made"="pipeline"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    print(f"\n🔍 Query Components:")
    print(f"   • South Platte River waterway")
    print(f"   • Water works and utilities")
    print(f"   • Power substations and lines")
    print(f"   • Pipeline infrastructure")
    
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
    
    # Process nodes (utilities, substations)
    print(f"\n🏗️  Processing Nodes (Utility Infrastructure):")
    for node in result.nodes:
        node_count += 1
        node_name = node.tags.get('name', f'Utility {node.id}')
        utility_type = node.tags.get('man_made') or node.tags.get('power', 'unknown')
        
        print(f"   Node {node_count}: {node_name} ({utility_type}) at [{node.lon:.6f}, {node.lat:.6f}]")
        
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
    
    # Process ways (river, power lines, pipelines)
    print(f"\n🌊 Processing Ways (River & Infrastructure Lines):")
    for way in result.ways:
        way_count += 1
        way_name = way.tags.get('name', f'Infrastructure {way.id}')
        infrastructure_type = way.tags.get('waterway') or way.tags.get('power') or way.tags.get('man_made', 'unknown')
        node_count_in_way = len(way.nodes)
        
        print(f"   Way {way_count}: {way_name} ({infrastructure_type}) with {node_count_in_way} nodes")
        
        coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
        
        if len(coords) >= 2:
            print(f"      Start: [{coords[0][0]:.6f}, {coords[0][1]:.6f}]")
            print(f"      End:   [{coords[-1][0]:.6f}, {coords[-1][1]:.6f}]")
        
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
    filepath = os.path.join('public', 'denver_south_platte_corridor.geojson')
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
        for i, feature in enumerate(features[:3]):  # Show first 3 features
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
    print(f"   • File Location: {filepath}")
    print("="*80)

def download_denver_pedestrian_bridges():
    """Extract 6 planned pedestrian bridges"""
    print("\n" + "="*80)
    print("🌉 DENVER PEDESTRIAN BRIDGES EXTRACTION")
    print("="*80)
    
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    lat_min, lon_min = 39.7450, -105.0150  # SW corner
    lat_max, lon_max = 39.7550, -105.0000  # NE corner
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"📍 Target Area: Ball Arena District")
    print(f"🗺️  Bounding Box: {bbox}")
    print(f"🎯 Objective: Find 6 planned pedestrian bridges connecting neighborhoods")
    
    query = f"""
    [out:json][timeout:300];
    (
      way["highway"="footway"]["bridge"="yes"]({bbox});
      way["man_made"="bridge"]["foot"="yes"]({bbox});
      way["highway"="path"]["bridge"="yes"]({bbox});
      way["highway"="pedestrian"]["bridge"="yes"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    print(f"\n🔍 Query Components:")
    print(f"   • Footway bridges")
    print(f"   • Pedestrian bridges")
    print(f"   • Path bridges")
    print(f"   • Dedicated pedestrian infrastructure")
    
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
    bridge_count = 0
    
    # Process ways (bridges)
    print(f"\n🌉 Processing Ways (Pedestrian Bridges):")
    for way in result.ways:
        bridge_count += 1
        bridge_name = way.tags.get('name', f'Pedestrian Bridge {way.id}')
        highway_type = way.tags.get('highway', way.tags.get('man_made', 'unknown'))
        node_count_in_way = len(way.nodes)
        
        print(f"   Bridge {bridge_count}: {bridge_name} ({highway_type}) with {node_count_in_way} nodes")
        
        coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
        
        if len(coords) >= 2:
            print(f"      Start: [{coords[0][0]:.6f}, {coords[0][1]:.6f}]")
            print(f"      End:   [{coords[-1][0]:.6f}, {coords[-1][1]:.6f}]")
            
            # Calculate bridge length (rough estimate)
            import math
            lat1, lon1 = coords[0][1], coords[0][0]
            lat2, lon2 = coords[-1][1], coords[-1][0]
            
            # Haversine formula for distance
            R = 6371000  # Earth's radius in meters
            lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
            lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
            dlat = lat2_rad - lat1_rad
            dlon = lon2_rad - lon1_rad
            a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
            c = 2 * math.asin(math.sqrt(a))
            distance = R * c
            
            print(f"      Length: ~{distance:.0f}m")
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': coords
            },
            'properties': {
                'name': bridge_name,
                'category': 'pedestrian_bridges',
                'highway_type': highway_type,
                'node_count': node_count_in_way,
                'estimated_length_m': distance if len(coords) >= 2 else 0,
                'osm_id': way.id,
                'osm_type': 'way',
                'tags': way.tags
            }
        }
        features.append(feature)
    
    # Output directory
    os.makedirs('public', exist_ok=True)
    filepath = os.path.join('public', 'denver_pedestrian_bridges.geojson')
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    
    print(f"\n💾 Saving GeoJSON File:")
    print(f"   • File: {os.path.abspath(filepath)}")
    print(f"   • Total Features: {len(features)}")
    print(f"   • Bridges Found: {bridge_count}")
    
    with open(filepath, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"   ✅ File saved successfully!")
    
    # Sample feature analysis
    if features:
        print(f"\n🔍 Sample Feature Analysis:")
        total_length = 0
        for i, feature in enumerate(features[:3]):  # Show first 3 features
            props = feature['properties']
            geom_type = feature['geometry']['type']
            length = props.get('estimated_length_m', 0)
            total_length += length
            
            print(f"   Feature {i+1}: {props['name']} ({geom_type})")
            print(f"      OSM ID: {props['osm_id']} | Type: {props.get('highway_type', 'N/A')}")
            print(f"      Length: {length:.0f}m")
            if 'tags' in props and props['tags']:
                key_tags = {k: v for k, v in props['tags'].items() if k in ['name', 'highway', 'bridge', 'foot', 'access']}
                print(f"      Key Tags: {key_tags}")
        
        if len(features) > 0:
            avg_length = sum(f['properties'].get('estimated_length_m', 0) for f in features) / len(features)
            print(f"\n📏 Bridge Statistics:")
            print(f"   • Average Length: {avg_length:.0f}m")
            print(f"   • Total Bridges: {len(features)}")
    
    print(f"\n🎯 EXTRACTION SUMMARY:")
    print(f"   • Status: {'SUCCESS' if features else 'NO DATA FOUND'}")
    print(f"   • Features Extracted: {len(features)}")
    print(f"   • Target: 6 planned bridges | Found: {len(features)} existing bridges")
    print(f"   • File Location: {filepath}")
    print("="*80)

def download_denver_parking_lots():
    """Extract 70 acres of parking lots ready for development"""
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Ball Arena district (focused on development-ready land)
    lat_min, lon_min = 39.7450, -105.0150  # SW corner
    lat_max, lon_max = 39.7550, -105.0000  # NE corner
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"\nDownloading Denver Parking Lots: {bbox}\n")
    
    query = f"""
    [out:json][timeout:300];
    (
      way["amenity"="parking"]({bbox});
      way["landuse"="parking"]({bbox});
      way["amenity"="parking_space"]({bbox});
      node["amenity"="parking"]({bbox});
      node["landuse"="parking"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    max_retries = 3
    retry_delay = 10
    
    for attempt in range(max_retries):
        try:
            print(f"   Attempt {attempt + 1}/{max_retries}...")
            result = api.query(query)
            print(f"   ✅ Query successful!")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"   ❌ Attempt {attempt + 1} failed: {e}")
                print(f"   ⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"   ❌ All attempts failed: {e}")
                return None
    
    # Process results
    features = []
    
    # Process parking areas (ways)
    for way in result.ways:
        try:
            coordinates = [[float(node.lon), float(node.lat)] for node in way.nodes]
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coordinates]
                },
                'properties': {
                    'name': way.tags.get('name', 'Unnamed Parking'),
                    'amenity': way.tags.get('amenity'),
                    'landuse': way.tags.get('landuse'),
                    'osm_id': way.id,
                    'osm_type': 'way',
                    'tags': way.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing parking way {way.id}: {e}")
            continue
    
    # Process parking points (nodes)
    for node in result.nodes:
        try:
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [float(node.lon), float(node.lat)]
                },
                'properties': {
                    'name': node.tags.get('name', 'Unnamed Parking Point'),
                    'amenity': node.tags.get('amenity'),
                    'landuse': node.tags.get('landuse'),
                    'osm_id': node.id,
                    'osm_type': 'node',
                    'tags': node.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing parking node {node.id}: {e}")
            continue
    
    # Save to GeoJSON
    if features:
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        filepath = os.path.join('public', 'denver_parking_lots.geojson')
        with open(filepath, 'w') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"\n💾 Saving GeoJSON File:")
        print(f"   • File: {os.path.abspath(filepath)}")
        print(f"   • Total Features: {len(features)}")
        print(f"   ✅ File saved successfully!")
        
        return len(features)
    else:
        print(f"\n❌ No parking features found")
        return 0

def download_denver_sports_anchor():
    """Extract Ball Arena and sports infrastructure"""
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Ball Arena district (focused on sports anchor)
    lat_min, lon_min = 39.7450, -105.0150  # SW corner
    lat_max, lon_max = 39.7550, -105.0000  # NE corner
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"\nDownloading Denver Sports Anchor: {bbox}\n")
    
    query = f"""
    [out:json][timeout:300];
    (
      way["leisure"="stadium"]({bbox});
      way["leisure"="sports_centre"]({bbox});
      way["amenity"="stadium"]({bbox});
      node["leisure"="stadium"]({bbox});
      node["leisure"="sports_centre"]({bbox});
      node["amenity"="stadium"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    max_retries = 3
    retry_delay = 10
    
    for attempt in range(max_retries):
        try:
            print(f"   Attempt {attempt + 1}/{max_retries}...")
            result = api.query(query)
            print(f"   ✅ Query successful!")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"   ❌ Attempt {attempt + 1} failed: {e}")
                print(f"   ⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"   ❌ All attempts failed: {e}")
                return None
    
    # Process results
    features = []
    
    # Process sports areas (ways)
    for way in result.ways:
        try:
            coordinates = [[float(node.lon), float(node.lat)] for node in way.nodes]
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coordinates]
                },
                'properties': {
                    'name': way.tags.get('name', 'Unnamed Sports Venue'),
                    'leisure': way.tags.get('leisure'),
                    'amenity': way.tags.get('amenity'),
                    'osm_id': way.id,
                    'osm_type': 'way',
                    'tags': way.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing sports way {way.id}: {e}")
            continue
    
    # Process sports points (nodes)
    for node in result.nodes:
        try:
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [float(node.lon), float(node.lat)]
                },
                'properties': {
                    'name': node.tags.get('name', 'Unnamed Sports Point'),
                    'leisure': node.tags.get('leisure'),
                    'amenity': node.tags.get('amenity'),
                    'osm_id': node.id,
                    'osm_type': 'node',
                    'tags': node.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing sports node {node.id}: {e}")
            continue
    
    # Save to GeoJSON
    if features:
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        filepath = os.path.join('public', 'denver_sports_anchor.geojson')
        with open(filepath, 'w') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"\n💾 Saving GeoJSON File:")
        print(f"   • File: {os.path.abspath(filepath)}")
        print(f"   • Total Features: {len(features)}")
        print(f"   ✅ File saved successfully!")
        
        return len(features)
    else:
        print(f"\n❌ No sports features found")
        return 0

def download_denver_development_zones():
    """Extract land use patterns and development opportunities"""
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Ball Arena district (focused on development zones)
    lat_min, lon_min = 39.7450, -105.0150  # SW corner
    lat_max, lon_max = 39.7550, -105.0000  # NE corner
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"\nDownloading Denver Development Zones: {bbox}\n")
    
    query = f"""
    [out:json][timeout:300];
    (
      way["landuse"="commercial"]({bbox});
      way["landuse"="industrial"]({bbox});
      way["landuse"="residential"]({bbox});
      way["landuse"="retail"]({bbox});
      way["building"="commercial"]({bbox});
      way["building"="industrial"]({bbox});
      way["building"="retail"]({bbox});
      node["landuse"="commercial"]({bbox});
      node["landuse"="industrial"]({bbox});
      node["landuse"="residential"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    max_retries = 3
    retry_delay = 10
    
    for attempt in range(max_retries):
        try:
            print(f"   Attempt {attempt + 1}/{max_retries}...")
            result = api.query(query)
            print(f"   ✅ Query successful!")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"   ❌ Attempt {attempt + 1} failed: {e}")
                print(f"   ⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"   ❌ All attempts failed: {e}")
                return None
    
    # Process results
    features = []
    
    # Process development areas (ways)
    for way in result.ways:
        try:
            coordinates = [[float(node.lon), float(node.lat)] for node in way.nodes]
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coordinates]
                },
                'properties': {
                    'name': way.tags.get('name', 'Unnamed Development Zone'),
                    'landuse': way.tags.get('landuse'),
                    'building': way.tags.get('building'),
                    'osm_id': way.id,
                    'osm_type': 'way',
                    'tags': way.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing development way {way.id}: {e}")
            continue
    
    # Process development points (nodes)
    for node in result.nodes:
        try:
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [float(node.lon), float(node.lat)]
                },
                'properties': {
                    'name': node.tags.get('name', 'Unnamed Development Point'),
                    'landuse': node.tags.get('landuse'),
                    'building': node.tags.get('building'),
                    'osm_id': node.id,
                    'osm_type': 'node',
                    'tags': node.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing development node {node.id}: {e}")
            continue
    
    # Save to GeoJSON
    if features:
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        filepath = os.path.join('public', 'denver_development_zones.geojson')
        with open(filepath, 'w') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"\n💾 Saving GeoJSON File:")
        print(f"   • File: {os.path.abspath(filepath)}")
        print(f"   • Total Features: {len(features)}")
        print(f"   ✅ File saved successfully!")
        
        return len(features)
    else:
        print(f"\n❌ No development features found")
        return 0

def download_denver_downtown_office():
    """Extract downtown Denver office buildings showing 35% vacancy"""
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Current downtown Denver area - using circular buffer around center point
    center_lat, center_lon = 39.7550, -105.0050  # Center of downtown Denver
    radius_km = 3.0  # 3km radius for natural circular coverage
    
    # Convert radius to approximate lat/lon degrees (rough approximation)
    lat_radius = radius_km / 111.0  # 1 degree latitude ≈ 111 km
    lon_radius = radius_km / (111.0 * math.cos(math.radians(center_lat)))  # Adjust for longitude
    
    # Create bounding box that encompasses the circle
    lat_min = center_lat - lat_radius
    lat_max = center_lat + lat_radius
    lon_min = center_lon - lon_radius
    lon_max = center_lon + lon_radius
    
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"\nDownloading Downtown Denver Office:")
    print(f"   Center: {center_lat}, {center_lon}")
    print(f"   Radius: {radius_km}km")
    print(f"   Bounding Box: {bbox}\n")
    
    query = f"""
    [out:json][timeout:300];
    (
      way["building"="office"]({bbox});
      way["building"="commercial"]({bbox});
      way["office"]({bbox});
      node["building"="office"]({bbox});
      node["building"="commercial"]({bbox});
      node["office"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    max_retries = 3
    retry_delay = 10
    
    for attempt in range(max_retries):
        try:
            print(f"   Attempt {attempt + 1}/{max_retries}...")
            result = api.query(query)
            print(f"   ✅ Query successful!")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"   ❌ Attempt {attempt + 1} failed: {e}")
                print(f"   ⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"   ❌ All attempts failed: {e}")
                return None
    
    # Process results
    features = []
    
    # Process office areas (ways)
    for way in result.ways:
        try:
            coordinates = [[float(node.lon), float(node.lat)] for node in way.nodes]
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coordinates]
                },
                'properties': {
                    'name': way.tags.get('name', 'Unnamed Office Building'),
                    'building': way.tags.get('building'),
                    'office': way.tags.get('office'),
                    'osm_id': way.id,
                    'osm_type': 'way',
                    'tags': way.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing office way {way.id}: {e}")
            continue
    
    # Process office points (nodes)
    for node in result.nodes:
        try:
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [float(node.lon), float(node.lat)]
                },
                'properties': {
                    'name': node.tags.get('name', 'Unnamed Office Point'),
                    'building': node.tags.get('building'),
                    'office': node.tags.get('office'),
                    'osm_id': node.id,
                    'osm_type': 'node',
                    'tags': node.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing office node {node.id}: {e}")
            continue
    
    # Save to GeoJSON
    if features:
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        filepath = os.path.join('public', 'denver_downtown_office.geojson')
        with open(filepath, 'w') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"\n💾 Saving GeoJSON File:")
        print(f"   • File: {os.path.abspath(filepath)}")
        print(f"   • Total Features: {len(features)}")
        print(f"   ✅ File saved successfully!")
        
        return len(features)
    else:
        print(f"\n❌ No office features found")
        return 0

def download_denver_downtown_retail():
    """Extract downtown Denver retail and commercial infrastructure"""
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Current downtown Denver area - using circular buffer around center point
    center_lat, center_lon = 39.7550, -105.0050  # Center of downtown Denver
    radius_km = 3.0  # 3km radius for natural circular coverage
    
    # Convert radius to approximate lat/lon degrees (rough approximation)
    lat_radius = radius_km / 111.0  # 1 degree latitude ≈ 111 km
    lon_radius = radius_km / (111.0 * math.cos(math.radians(center_lat)))  # Adjust for longitude
    
    # Create bounding box that encompasses the circle
    lat_min = center_lat - lat_radius
    lat_max = center_lat + lat_radius
    lon_min = center_lon - lon_radius
    lon_max = center_lon + lon_radius
    
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"\nDownloading Downtown Denver Retail:")
    print(f"   Center: {center_lat}, {center_lon}")
    print(f"   Radius: {radius_km}km")
    print(f"   Bounding Box: {bbox}\n")
    
    query = f"""
    [out:json][timeout:300];
    (
      way["shop"]({bbox});
      way["amenity"~"restaurant|cafe|bar"]({bbox});
      way["landuse"="retail"]({bbox});
      way["landuse"="commercial"]({bbox});
      node["shop"]({bbox});
      node["amenity"~"restaurant|cafe|bar"]({bbox});
      node["landuse"="retail"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    max_retries = 3
    retry_delay = 10
    
    for attempt in range(max_retries):
        try:
            print(f"   Attempt {attempt + 1}/{max_retries}...")
            result = api.query(query)
            print(f"   ✅ Query successful!")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"   ❌ Attempt {attempt + 1} failed: {e}")
                print(f"   ⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"   ❌ All attempts failed: {e}")
                return None
    
    # Process results
    features = []
    
    # Process retail areas (ways)
    for way in result.ways:
        try:
            coordinates = [[float(node.lon), float(node.lat)] for node in way.nodes]
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coordinates]
                },
                'properties': {
                    'name': way.tags.get('name', 'Unnamed Retail Area'),
                    'shop': way.tags.get('shop'),
                    'amenity': way.tags.get('amenity'),
                    'landuse': way.tags.get('landuse'),
                    'osm_id': way.id,
                    'osm_type': 'way',
                    'tags': way.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing retail way {way.id}: {e}")
            continue
    
    # Process retail points (nodes)
    for node in result.nodes:
        try:
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [float(node.lon), float(node.lat)]
                },
                'properties': {
                    'name': node.tags.get('name', 'Unnamed Retail Point'),
                    'shop': node.tags.get('shop'),
                    'amenity': node.tags.get('amenity'),
                    'landuse': node.tags.get('landuse'),
                    'osm_id': node.id,
                    'osm_type': 'node',
                    'tags': node.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing retail node {node.id}: {e}")
            continue
    
    # Save to GeoJSON
    if features:
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        filepath = os.path.join('public', 'denver_downtown_retail.geojson')
        with open(filepath, 'w') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"\n💾 Saving GeoJSON File:")
        print(f"   • File: {os.path.abspath(filepath)}")
        print(f"   • Total Features: {len(features)}")
        print(f"   ✅ File saved successfully!")
        
        return len(features)
    else:
        print(f"\n❌ No retail features found")
        return 0

def download_denver_downtown_transport():
    """Extract downtown Denver transportation infrastructure"""
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Current downtown Denver area - using circular buffer around center point
    center_lat, center_lon = 39.7550, -105.0050  # Center of downtown Denver
    radius_km = 3.0  # 3km radius for natural circular coverage
    
    # Convert radius to approximate lat/lon degrees (rough approximation)
    lat_radius = radius_km / 111.0  # 1 degree latitude ≈ 111 km
    lon_radius = radius_km / (111.0 * math.cos(math.radians(center_lat)))  # Adjust for longitude
    
    # Create bounding box that encompasses the circle
    lat_min = center_lat - lat_radius
    lat_max = center_lat + lat_radius
    lon_min = center_lon - lon_radius
    lon_max = center_lon + lon_radius
    
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"\nDownloading Downtown Denver Transportation:")
    print(f"   Center: {center_lat}, {center_lon}")
    print(f"   Radius: {radius_km}km")
    print(f"   Bounding Box: {bbox}\n")
    
    query = f"""
    [out:json][timeout:300];
    (
      way["highway"]({bbox});
      way["railway"]({bbox});
      way["amenity"="parking"]({bbox});
      node["highway"]({bbox});
      node["railway"]({bbox});
      node["amenity"="parking"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    max_retries = 3
    retry_delay = 10
    
    for attempt in range(max_retries):
        try:
            print(f"   Attempt {attempt + 1}/{max_retries}...")
            result = api.query(query)
            print(f"   ✅ Query successful!")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"   ❌ Attempt {attempt + 1} failed: {e}")
                print(f"   ⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"   ❌ All attempts failed: {e}")
                return None
    
    # Process results
    features = []
    
    # Process transport lines (ways)
    for way in result.ways:
        try:
            coordinates = [[float(node.lon), float(node.lat)] for node in way.nodes]
            
            # Check if any point in the way falls within the circular radius
            within_radius = False
            for coord in coordinates:
                lon, lat = coord
                # Calculate distance from center using Haversine formula
                lat_diff = math.radians(lat - center_lat)
                lon_diff = math.radians(lon - center_lon)
                a = math.sin(lat_diff/2)**2 + math.cos(math.radians(center_lat)) * math.cos(math.radians(lat)) * math.sin(lon_diff/2)**2
                c = 2 * math.asin(math.sqrt(a))
                distance_km = 6371 * c  # Earth's radius in km
                
                if distance_km <= radius_km:
                    within_radius = True
                    break
            
            if not within_radius:
                continue
                
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'LineString',
                    'coordinates': coordinates
                },
                'properties': {
                    'name': way.tags.get('name', 'Unnamed Transport Line'),
                    'highway': way.tags.get('highway'),
                    'railway': way.tags.get('railway'),
                    'amenity': way.tags.get('amenity'),
                    'osm_id': way.id,
                    'osm_type': 'way',
                    'tags': way.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing transport way {way.id}: {e}")
            continue
    
    # Process transport points (nodes)
    for node in result.nodes:
        try:
            lon, lat = float(node.lon), float(node.lat)
            
            # Check if node falls within the circular radius
            lat_diff = math.radians(lat - center_lat)
            lon_diff = math.radians(lon - center_lon)
            a = math.sin(lat_diff/2)**2 + math.cos(math.radians(center_lat)) * math.cos(math.radians(lat)) * math.sin(lon_diff/2)**2
            c = 2 * math.asin(math.sqrt(a))
            distance_km = 6371 * c  # Earth's radius in km
            
            if distance_km > radius_km:
                continue
                
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [lon, lat]
                },
                'properties': {
                    'name': node.tags.get('name', 'Unnamed Transport Point'),
                    'highway': node.tags.get('highway'),
                    'amenity': node.tags.get('amenity'),
                    'osm_id': node.id,
                    'osm_type': 'node',
                    'tags': node.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing transport node {node.id}: {e}")
            continue
    
    # Save to GeoJSON
    if features:
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        filepath = os.path.join('public', 'denver_downtown_transport.geojson')
        with open(filepath, 'w') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"\n💾 Saving GeoJSON File:")
        print(f"   • File: {os.path.abspath(filepath)}")
        print(f"   • Total Features: {len(features)}")
        print(f"   ✅ File saved successfully!")
        
        return len(features)
    else:
        print(f"\n❌ No transport features found")
        return 0

def download_denver_downtown_larger():
    """Extract larger downtown Denver area with 9km radius for regional context"""
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Larger downtown Denver area - using circular buffer around center point
    center_lat, center_lon = 39.7550, -105.0050  # Center of downtown Denver
    radius_km = 5.0  # 5km radius (more manageable than 9km) for regional context
    
    # Convert radius to approximate lat/lon degrees (rough approximation)
    lat_radius = radius_km / 111.0  # 1 degree latitude ≈ 111 km
    lon_radius = radius_km / (111.0 * math.cos(math.radians(center_lat)))  # Adjust for longitude
    
    # Create bounding box that encompasses the circle
    lat_min = center_lat - lat_radius
    lat_max = center_lat + lat_radius
    lon_min = center_lon - lon_radius
    lon_max = center_lon + lon_radius
    
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    print(f"\nDownloading Downtown Denver Larger (Regional Context):")
    print(f"   Center: {center_lat}, {center_lon}")
    print(f"   Radius: {radius_km}km")
    print(f"   Bounding Box: {bbox}\n")
    
    query = f"""
    [out:json][timeout:300];
    (
      way["building"~"commercial|office|retail|residential"]({bbox});
      way["landuse"~"commercial|retail|residential|industrial"]({bbox});
      way["amenity"~"restaurant|cafe|bar|shop|bank|hospital|school"]({bbox});
      way["highway"~"primary|secondary|tertiary"]({bbox});
      way["railway"]({bbox});
      node["building"~"commercial|office|retail|residential"]({bbox});
      node["landuse"~"commercial|retail|residential|industrial"]({bbox});
      node["amenity"~"restaurant|cafe|bar|shop|bank|hospital|school"]({bbox});
      node["highway"~"primary|secondary|tertiary"]({bbox});
      node["railway"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    max_retries = 3
    retry_delay = 10
    
    for attempt in range(max_retries):
        try:
            print(f"   Attempt {attempt + 1}/{max_retries}...")
            result = api.query(query)
            print(f"   ✅ Query successful!")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"   ❌ Attempt {attempt + 1} failed: {e}")
                print(f"   ⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"   ❌ All attempts failed: {e}")
                return None
    
    # Process results
    features = []
    
    # Process areas (ways)
    for way in result.ways:
        try:
            coordinates = [[float(node.lon), float(node.lat)] for node in way.nodes]
            
            # Check if any point in the way falls within the circular radius
            within_radius = False
            for coord in coordinates:
                lon, lat = coord
                # Calculate distance from center using Haversine formula
                lat_diff = math.radians(lat - center_lat)
                lon_diff = math.radians(lon - center_lon)
                a = math.sin(lat_diff/2)**2 + math.cos(math.radians(center_lat)) * math.cos(math.radians(lat)) * math.sin(lon_diff/2)**2
                c = 2 * math.asin(math.sqrt(a))
                distance_km = 6371 * c  # Earth's radius in km
                
                if distance_km <= radius_km:
                    within_radius = True
                    break
            
            if not within_radius:
                continue
                
            # Determine geometry type based on tags
            geom_type = 'Polygon'
            if way.tags.get('highway') or way.tags.get('railway'):
                geom_type = 'LineString'
            
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': geom_type,
                    'coordinates': [coordinates] if geom_type == 'Polygon' else coordinates
                },
                'properties': {
                    'name': way.tags.get('name', 'Unnamed Regional Feature'),
                    'building': way.tags.get('building'),
                    'landuse': way.tags.get('landuse'),
                    'amenity': way.tags.get('amenity'),
                    'highway': way.tags.get('highway'),
                    'railway': way.tags.get('railway'),
                    'osm_id': way.id,
                    'osm_type': 'way',
                    'tags': way.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing regional way {way.id}: {e}")
            continue
    
    # Process points (nodes)
    for node in result.nodes:
        try:
            lon, lat = float(node.lon), float(node.lat)
            
            # Check if node falls within the circular radius
            lat_diff = math.radians(lat - center_lat)
            lon_diff = math.radians(lon - center_lon)
            a = math.sin(lat_diff/2)**2 + math.cos(math.radians(center_lat)) * math.cos(math.radians(lat)) * math.sin(lon_diff/2)**2
            c = 2 * math.asin(math.sqrt(a))
            distance_km = 6371 * c  # Earth's radius in km
            
            if distance_km > radius_km:
                continue
                
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [lon, lat]
                },
                'properties': {
                    'name': node.tags.get('name', 'Unnamed Regional Point'),
                    'building': node.tags.get('building'),
                    'landuse': node.tags.get('landuse'),
                    'amenity': node.tags.get('amenity'),
                    'highway': node.tags.get('highway'),
                    'railway': node.tags.get('railway'),
                    'osm_id': node.id,
                    'osm_type': 'node',
                    'tags': node.tags
                }
            }
            features.append(feature)
        except Exception as e:
            print(f"   ⚠️  Error processing regional node {node.id}: {e}")
            continue
    
    # Save to GeoJSON
    if features:
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        filepath = os.path.join('public', 'denver_downtown_larger.geojson')
        with open(filepath, 'w') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"\n💾 Saving GeoJSON File:")
        print(f"   • File: {os.path.abspath(filepath)}")
        print(f"   • Total Features: {len(features)}")
        print(f"   ✅ File saved successfully!")
        
        return len(features)
    else:
        print(f"\n❌ No regional features found")
        return 0

if __name__ == "__main__":
    print("\n" + "🚀" + "="*78 + "🚀")
    print("🏗️  DENVER BALL ARENA STRATEGY - OSM DATA EXTRACTION")
    print("🚀" + "="*78 + "🚀")
    print(f"⏰ Started at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    start_time = time.time()
    extraction_results = {}
    
    try:
        # Denver Strategy Components
        print(f"\n📋 EXTRACTION PLAN:")
        print(f"   1. 🚊 Light Rail Convergence (E/W lines at Ball Arena)")
        print(f"   2. 🌊 South Platte Corridor (6,000+ housing utility capacity)")
        print(f"   3. 🌉 Pedestrian Bridges (6 planned connections)")
        print(f"   4. 🅿️  Parking Lots (70 acres ready for development)")
        print(f"   5. 🏟️  Sports Anchor (Ball Arena itself)")
        print(f"   6. 🏗️  Development Zones (land use patterns)")
        print(f"   7. 🏢  Downtown Office Vacancy (35% struggling market)")
        print(f"   8. 🏪  Downtown Retail/Commercial (existing infrastructure)")
        print(f"   9. 🚗  Downtown Transportation (current transit situation)")
        print(f"   10. 🌆 Downtown Larger (5km radius - regional context)")
        
        # Execute extractions
        extraction_results['light_rail'] = download_denver_light_rail_convergence()
        extraction_results['south_platte'] = download_denver_south_platte_corridor()
        extraction_results['pedestrian_bridges'] = download_denver_pedestrian_bridges()
        extraction_results['parking_lots'] = download_denver_parking_lots()
        extraction_results['sports_anchor'] = download_denver_sports_anchor()
        extraction_results['development_zones'] = download_denver_development_zones()
        extraction_results['downtown_office'] = download_denver_downtown_office()
        extraction_results['downtown_retail'] = download_denver_downtown_retail()
        extraction_results['downtown_transport'] = download_denver_downtown_transport()
        extraction_results['downtown_larger'] = download_denver_downtown_larger()
        
    except KeyboardInterrupt:
        print(f"\n⚠️  EXTRACTION INTERRUPTED BY USER")
        print(f"⏰ Interrupted at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        exit(1)
    except Exception as e:
        print(f"\n❌ EXTRACTION FAILED WITH ERROR:")
        print(f"   Error: {str(e)}")
        print(f"⏰ Failed at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        exit(1)
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"\n🎉" + "="*78 + "🎉")
    print("📊 FINAL EXTRACTION SUMMARY")
    print("🎉" + "="*78 + "🎉")
    print(f"⏰ Completed at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"⏱️  Total Duration: {duration:.1f} seconds")
    
    # Check generated files
    import os
    files_generated = []
    expected_files = [
        'denver_light_rail_convergence.geojson',
        'denver_south_platte_corridor.geojson', 
        'denver_pedestrian_bridges.geojson',
        'denver_parking_lots.geojson',
        'denver_sports_anchor.geojson',
        'denver_development_zones.geojson',
            'denver_downtown_office.geojson',
    'denver_downtown_retail.geojson',
    'denver_downtown_transport.geojson',
    'denver_downtown_larger.geojson'
    ]
    
    print(f"\n📁 GENERATED FILES:")
    for filename in expected_files:
        filepath = os.path.join('public', filename)
        if os.path.exists(filepath):
            file_size = os.path.getsize(filepath)
            files_generated.append(filename)
            print(f"   ✅ {filename} ({file_size:,} bytes)")
            
            # Quick feature count
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    feature_count = len(data.get('features', []))
                    print(f"      📊 Features: {feature_count}")
            except:
                print(f"      ⚠️  Could not read feature count")
        else:
            print(f"   ❌ {filename} (NOT FOUND)")
    
    print(f"\n🎯 STRATEGY VALIDATION RESULTS:")
    print(f"   • Files Generated: {len(files_generated)}/{len(expected_files)}")
    print(f"   • Success Rate: {len(files_generated)/len(expected_files)*100:.0f}%")
    
    if len(files_generated) == len(expected_files):
        print(f"   ✅ ALL EXTRACTIONS SUCCESSFUL!")
        print(f"\n📋 NEXT STEPS:")
        print(f"   1. 🗂️  Files are ready in /public/ directory")
        print(f"   2. 🗺️  Toggle layers in the map interface")
        print(f"   3. 🔍 Validate infrastructure claims visually")
        print(f"   4. 📊 Analyze Ball Arena strategy feasibility")
    else:
        print(f"   ⚠️  SOME EXTRACTIONS INCOMPLETE")
        print(f"   🔧 Check logs above for specific issues")
    
    print("🎉" + "="*78 + "🎉")
    
    # Original functions (commented out for now)
    # download_power_corridor_pois()
    # save_first_5k_power_supply()
    # save_first_5k_power_demand() 
    # download_water_corridor_pois() 
    # download_nw_austin_power_demand() 