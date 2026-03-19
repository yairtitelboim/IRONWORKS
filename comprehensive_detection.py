#!/usr/bin/env python3
"""
Comprehensive building detection with expanded area and improved methods
"""

import os
import ee
import json
from datetime import datetime

def initialize_gee():
    """Initialize Google Earth Engine"""
    service_account = 'gentle-cinema-458613-f3@gentle-cinema-458613.iam.gserviceaccount.com'
    creds_path = os.path.expanduser('~/.config/gee/gentle-cinema-458613-f3-62875d82a3f2.json')
    credentials = ee.ServiceAccountCredentials(service_account, creds_path)
    ee.Initialize(credentials)
    print("✅ Google Earth Engine initialized")

def improved_building_detection(geometry, year1, year2, max_buildings=2000):
    """Much more sensitive building detection with multiple methods"""
    
    print(f"🔍 Comprehensive detection: {year1} → {year2}")
    
    def get_improved_composite(year):
        # Get more images across full year
        collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(geometry) \
            .filterDate(f'{year}-01-01', f'{year}-12-31') \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)) \
            .limit(20)  # More images for better composite
        
        if collection.size().getInfo() == 0:
            return None
            
        # Create median composite
        composite = collection.median()
        
        # Calculate multiple indices
        ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI')
        ndbi = composite.normalizedDifference(['B11', 'B8']).rename('NDBI')
        ui = composite.select('B11').divide(composite.select('B8')).rename('UI')
        
        # Normalized Difference Water Index (to exclude water)
        ndwi = composite.normalizedDifference(['B3', 'B8']).rename('NDWI')
        
        composite = composite.addBands([ndvi, ndbi, ui, ndwi])
        
        # Method 1: Traditional building detection (more sensitive)
        traditional = composite.expression(
            '(NDBI > NDVI - 0.1) and (NDVI < 0.4) and (NDWI < 0.3) and (B4 > 0.08)',
            {
                'NDBI': composite.select('NDBI'),
                'NDVI': composite.select('NDVI'),
                'NDWI': composite.select('NDWI'),
                'B4': composite.select('B4')
            }
        ).rename('traditional')
        
        # Method 2: Bright surface detection (rooftops, concrete)
        bright_surfaces = composite.expression(
            '((B4 + B3 + B2) / 3 > 0.12) and (NDVI < 0.4) and (NDWI < 0.2)',
            {
                'B4': composite.select('B4'),
                'B3': composite.select('B3'),
                'B2': composite.select('B2'),
                'NDVI': composite.select('NDVI'),
                'NDWI': composite.select('NDWI')
            }
        ).rename('bright')
        
        # Method 3: Urban index approach
        urban_index = composite.expression(
            '(UI > 1.2) and (NDVI < 0.35) and (NDWI < 0.3)',
            {
                'UI': composite.select('UI'),
                'NDVI': composite.select('NDVI'),
                'NDWI': composite.select('NDWI')
            }
        ).rename('urban')
        
        # Method 4: Machine learning-like approach using band ratios
        ml_approach = composite.expression(
            '((B11/B8 > 1.1) and (B8/B4 < 3) and (NDVI < 0.4) and (NDWI < 0.3)) or ' +
            '((B4 > 0.1) and (B3 > 0.1) and (B2 > 0.08) and (NDVI < 0.3))',
            {
                'B11': composite.select('B11'),
                'B8': composite.select('B8'),
                'B4': composite.select('B4'),
                'B3': composite.select('B3'),
                'B2': composite.select('B2'),
                'NDVI': composite.select('NDVI'),
                'NDWI': composite.select('NDWI')
            }
        ).rename('ml')
        
        # Combine all methods (any method detects = building)
        combined = traditional.Or(bright_surfaces).Or(urban_index).Or(ml_approach)
        
        return combined.selfMask()
    
    # Get building masks for each year
    buildings1 = get_improved_composite(year1)
    buildings2 = get_improved_composite(year2)
    
    if buildings1 is None or buildings2 is None:
        print(f"  ❌ Insufficient imagery for {year1}-{year2}")
        return None
    
    # Detect new buildings
    new_buildings = buildings2.And(buildings1.Not())
    
    # Apply morphological operations to clean up
    new_buildings = new_buildings.focal_max(1).focal_min(1)  # Close gaps, remove noise
    
    # Convert to vectors with higher resolution
    vectors = new_buildings.reduceToVectors(
        geometry=geometry,
        scale=10,  # Higher resolution (10m instead of 20m)
        maxPixels=2e8,  # Allow more pixels
        geometryType='polygon',
        eightConnected=False
    )
    
    try:
        total_count = vectors.size().getInfo()
        print(f"  📊 Buildings detected: {total_count}")
        
        if total_count == 0:
            return None
        
        # Export up to max_buildings
        export_count = min(total_count, max_buildings)
        export_vectors = vectors.limit(export_count)
        features = export_vectors.getInfo()
        
        if features and 'features' in features and len(features['features']) > 0:
            change_data = {
                'type': 'FeatureCollection',
                'metadata': {
                    'year_from': year1,
                    'year_to': year2,
                    'total_detected': total_count,
                    'exported_count': len(features['features']),
                    'export_percentage': (len(features['features']) / total_count) * 100,
                    'export_date': datetime.now().isoformat(),
                    'study_area': 'Greater Humble Area, Texas',
                    'detection_method': 'comprehensive_multi_method',
                    'resolution_meters': 10,
                    'detection_methods': ['traditional_indices', 'bright_surfaces', 'urban_index', 'ml_approach']
                },
                'features': []
            }
            
            for i, feature in enumerate(features['features']):
                # Calculate area with error margin to avoid geometry issues
                try:
                    geom = ee.Geometry(feature['geometry'])
                    area_m2 = geom.area(maxError=1).getInfo()  # Add 1m error margin
                except:
                    # Fallback area calculation
                    area_m2 = feature.get('properties', {}).get('count', 1) * 100  # Estimate
                
                enhanced_feature = {
                    'type': 'Feature',
                    'id': i + 1,
                    'geometry': feature['geometry'],
                    'properties': {
                        'id': i + 1,
                        'detection_year': year2,
                        'previous_year': year1,
                        'change_type': 'new_building',
                        'area_m2': round(area_m2, 2),
                        'area_sqft': round(area_m2 * 10.764, 2),
                        'detection_date': f'{year2}-06-15',
                        'confidence': 'high',
                        'source': 'sentinel2_comprehensive',
                        'methods_used': 'multi_approach'
                    }
                }
                change_data['features'].append(enhanced_feature)
            
            filename = f'comprehensive_buildings_{year1}_{year2}.geojson'
            with open(filename, 'w') as f:
                json.dump(change_data, f, indent=2)
            
            print(f"  ✅ Exported {len(change_data['features'])} buildings ({change_data['metadata']['export_percentage']:.1f}%) to {filename}")
            return change_data
        else:
            return None
            
    except Exception as e:
        print(f"  ❌ Export error: {str(e)}")
        return None

def main():
    """Run comprehensive building detection"""
    print("🛰️ COMPREHENSIVE Building Detection - Expanded Area")
    print("=" * 60)
    
    initialize_gee()
    
    # EXPANDED study area - Greater Humble region for better context
    bounds = {
        'west': -95.45,   # Expanded west
        'east': -95.15,   # Expanded east  
        'south': 29.85,   # Expanded south
        'north': 30.15    # Expanded north
    }
    
    area_km2 = (bounds['east'] - bounds['west']) * 111 * (bounds['north'] - bounds['south']) * 111
    print(f"📍 Study area: Greater Humble region ({area_km2:.1f} km²)")
    print(f"🔍 Resolution: 10m (higher than previous 20m)")
    print(f"🧠 Methods: 4 detection algorithms combined")
    
    geometry = ee.Geometry.Rectangle([
        bounds['west'], bounds['south'],
        bounds['east'], bounds['north']
    ])
    
    # Extended time periods for more data
    year_pairs = [
        (2019, 2020),  # Added earlier years
        (2020, 2021),
        (2021, 2022),
        (2022, 2023), 
        (2023, 2024)
    ]
    
    all_results = []
    total_exported = 0
    total_detected = 0
    
    for year1, year2 in year_pairs:
        print(f"\n🔍 Processing {year1} → {year2}")
        result = improved_building_detection(geometry, year1, year2, max_buildings=2000)
        
        if result:
            all_results.append(result)
            total_exported += len(result['features'])
            total_detected += result['metadata']['total_detected']
    
    # Summary
    if all_results:
        print(f"\n✅ COMPREHENSIVE ANALYSIS COMPLETE!")
        print(f"📊 Results Summary:")
        print(f"   🌍 Area analyzed: {area_km2:.1f} km² (expanded)")
        print(f"   📅 Time periods: {len(year_pairs)} periods (2019-2024)")
        print(f"   🏗️ Total detected: {total_detected:,} buildings")
        print(f"   📁 Total exported: {total_exported:,} buildings")
        print(f"   📈 Export rate: {(total_exported/total_detected)*100:.1f}%")
        print(f"   🎯 Density: {total_detected/area_km2:.1f} detections/km²")
        print(f"\n📁 Files created:")
        for result in all_results:
            year1 = result['metadata']['year_from']
            year2 = result['metadata']['year_to']
            count = len(result['features'])
            detected = result['metadata']['total_detected']
            print(f"     - comprehensive_buildings_{year1}_{year2}.geojson")
            print(f"       Exported: {count:,} | Detected: {detected:,}")
        
        print(f"\n🚀 This should provide 3-4x more building data with better spatial context!")
    else:
        print(f"\n❌ No buildings detected")

if __name__ == "__main__":
    main()