import overpy
import json
import time
import os
from math import ceil

def download_la_buildings():
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # LA coordinates split into smaller chunks for better handling
    lat_min, lon_min = 33.7037, -118.6682  # SW corner
    lat_max, lon_max = 34.3373, -118.1553  # NE corner
    
    # Split area into smaller chunks for better handling
    grid_size = 8
    lat_step = (lat_max - lat_min) / grid_size
    lon_step = (lon_max - lon_min) / grid_size
    
    buildings = []
    total_chunks = grid_size * grid_size
    processed_chunks = 0

    print(f"Starting LA buildings download in {total_chunks} chunks...")
    print(f"Area: {lat_min},{lon_min} to {lat_max},{lon_max}")
    print(f"Chunk size: ~{lat_step:.4f}° x {lon_step:.4f}°\n")
    
    for i in range(grid_size):
        for j in range(grid_size):
            chunk_lat_min = lat_min + (i * lat_step)
            chunk_lat_max = lat_min + ((i + 1) * lat_step)
            chunk_lon_min = lon_min + (j * lon_step)
            chunk_lon_max = lon_min + ((j + 1) * lon_step)
            
            bbox = f"{chunk_lat_min},{chunk_lon_min},{chunk_lat_max},{chunk_lon_max}"
            
            building_query = f"""
            [out:json][timeout:300];
            (
              way["building"]["height"]({bbox});
              way["building"]["building:levels"]({bbox});
              relation["building"]({bbox});
              way(r)["building"]({bbox});
            );
            (._;>;);
            out body;
            """
            
            max_retries = 5
            retry_delay = 10  # seconds
            
            for attempt in range(max_retries):
                try:
                    processed_chunks += 1
                    print(f"\nProcessing chunk {processed_chunks}/{total_chunks} ({(processed_chunks/total_chunks)*100:.1f}%)")
                    print(f"Coordinates: {bbox}")
                    
                    result = api.query(building_query)
                    chunk_buildings = []
                    
                    # Create a way lookup dictionary
                    way_lookup = {way.id: way for way in result.ways}
                    
                    # Process standalone ways (buildings that are not part of relations)
                    for way in result.ways:
                        try:
                            # Skip ways that don't have building tags
                            if not way.tags.get('building'):
                                continue
                                
                            coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
                            if not coords:
                                continue
                                
                            # Close the polygon if it's not closed
                            if coords[0] != coords[-1]:
                                coords.append(coords[0])
                                
                            height = float(way.tags.get('height', 0))
                            levels = float(way.tags.get('building:levels', 0))
                            
                            # If we have levels but no height, estimate height
                            if height == 0 and levels > 0:
                                height = levels * 3
                            # If we have neither, use default height
                            elif height == 0:
                                height = 3
                            
                            feature = {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'Polygon',
                                    'coordinates': [coords]
                                },
                                'properties': {
                                    'height': height,
                                    'levels': levels,
                                    'id': f"way/{way.id}",
                                    'building': way.tags.get('building', 'yes'),
                                    'name': way.tags.get('name', '')
                                }
                            }
                            chunk_buildings.append(feature)
                            
                        except Exception as e:
                            print(f"Error processing way {way.id}: {str(e)}")
                            continue
                    
                    # Process relations (some buildings are relations)
                    for relation in result.relations:
                        if 'building' not in relation.tags:
                            continue
                            
                        try:
                            # Get outer ways of the building
                            outer_ways = []
                            for member in relation.members:
                                if member.role == 'outer':
                                    try:
                                        if isinstance(member, overpy.RelationWay):
                                            way_id = member.ref.id if hasattr(member.ref, 'id') else member.ref
                                            if way_id in way_lookup:
                                                outer_ways.append(way_lookup[way_id])
                                    except Exception:
                                        continue
                            
                            if not outer_ways:
                                continue
                                
                            height = float(relation.tags.get('height', 0))
                            levels = float(relation.tags.get('building:levels', 0))
                            
                            if height == 0 and levels > 0:
                                height = levels * 3
                            elif height == 0:
                                height = 3
                            
                            # Process each outer way
                            for way in outer_ways:
                                try:
                                    coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
                                    if not coords:
                                        continue
                                        
                                    if coords[0] != coords[-1]:
                                        coords.append(coords[0])
                                    
                                    feature = {
                                        'type': 'Feature',
                                        'geometry': {
                                            'type': 'Polygon',
                                            'coordinates': [coords]
                                        },
                                        'properties': {
                                            'height': height,
                                            'levels': levels,
                                            'id': f"relation/{relation.id}/way/{way.id}",
                                            'building': relation.tags.get('building', 'yes'),
                                            'name': relation.tags.get('name', '')
                                        }
                                    }
                                    chunk_buildings.append(feature)
                                except Exception as e:
                                    print(f"Error processing relation way: {str(e)}")
                                    continue
                            
                        except Exception as e:
                            print(f"Error processing relation: {str(e)}")
                            continue
                    
                    print(f"Found {len(chunk_buildings)} buildings in chunk")
                    buildings.extend(chunk_buildings)
                    
                    # Add delay between chunks to avoid rate limiting
                    time.sleep(2)
                    break
                    
                except overpy.exception.OverpassGatewayTimeout:
                    if attempt < max_retries - 1:
                        wait_time = retry_delay * (attempt + 1)
                        print(f"Timeout error, retrying in {wait_time} seconds... (Attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                    else:
                        print(f"Failed to download chunk after {max_retries} attempts, skipping...")
                        
                except Exception as e:
                    print(f"Error downloading chunk: {str(e)}")
                    if attempt < max_retries - 1:
                        wait_time = retry_delay * (attempt + 1)
                        print(f"Retrying in {wait_time} seconds... (Attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                    else:
                        print("Skipping chunk due to repeated errors")
                        break
    
    # Save the complete building data
    if buildings:
        geojson = {
            'type': 'FeatureCollection',
            'features': buildings
        }
        
        output_dir = os.path.join('public', 'data', 'osm')
        os.makedirs(output_dir, exist_ok=True)
        
        output_file = os.path.join(output_dir, 'la_buildings_3d.geojson')
        with open(output_file, 'w') as f:
            json.dump(geojson, f)
        
        print(f"\nDownload complete!")
        print(f"Total buildings: {len(buildings)}")
        print(f"Output file: {os.path.abspath(output_file)}")
    else:
        print("\nNo buildings were downloaded successfully")

if __name__ == "__main__":
    download_la_buildings() 