

import ee
import os
import json

def initialize_gee():
    """
    Initializes Google Earth Engine using standard authentication and a specific project.
    """
    try:
        project_id = 'gentle-cinema-458613-f3'
        ee.Authenticate()
        ee.Initialize(project=project_id)
        print(f"✅ Google Earth Engine initialized successfully for project '{project_id}'.")
    except Exception as e:
        print(f"❌ GEE Initialization failed for project '{project_id}'.")
        print("Please ensure this project is correctly registered at:")
        print("https://developers.google.com/earth-engine/guides/access")
        print(f"Error: {e}")
        raise

def get_alphaearth_embeddings_image(year, geometry):
    """
    Generates an AlphaEarth Satellite Embeddings image (ee.Image) for a given year and geometry.
    """
    start_date = f'{year}-01-01'
    end_date = f'{year}-12-31'
    
    ae_collection = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')         .filterDate(start_date, end_date)         .filterBounds(geometry)

    if ae_collection.size().getInfo() == 0:
        print(f"  ⚠️ No AlphaEarth embeddings found for {year}.")
        return None

    # AlphaEarth embeddings are annual composites, so we just take the first image
    # or mosaic if there are multiple tiles for the region.
    embeddings_image = ae_collection.mosaic()
    
    return embeddings_image

def export_land_cover_changes_local(year1, year2, geometry, output_dir):
    """
    Calculates land cover changes between two years and saves them as GeoJSON locally.
    """
    print(f"🔍 Calculating changes for {year1} → {year2}...")
    
    embeddings_image1 = get_alphaearth_embeddings_image(year1, geometry)
    embeddings_image2 = get_alphaearth_embeddings_image(year2, geometry)
    
    if embeddings_image1 is None or embeddings_image2 is None:
        print(f"  ❌ Cannot calculate changes: missing AlphaEarth embeddings for {year1} or {year2}.")
        return

    # Calculate Euclidean distance between 64-dimensional embeddings
    # AlphaEarth embeddings have multiple bands, so we need to reduce across bands
    diff_squared = embeddings_image1.subtract(embeddings_image2).pow(2)
    diff = diff_squared.reduce(ee.Reducer.sum()).sqrt()
    change_mask = diff.gt(0.1).rename('change_mask') # Threshold for significant change

    # --- DIAGNOSTIC: Count changed pixels ---
    changed_pixel_count = change_mask.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=geometry,
        scale=10, # AlphaEarth is 10m resolution
        maxPixels=1e10
    ).get('change_mask').getInfo()
    print(f"  📊 Changed pixels detected: {changed_pixel_count}")
    if changed_pixel_count == 0:
        print(f"  ⚠️ No pixels changed for {year1} → {year2}. Skipping vectorization.")
        return
    # --- END DIAGNOSTIC ---
    
    # old_class_band and new_class_band are no longer directly applicable as we don't have discrete classes.
    # We will need to derive indicators from embeddings later.
    # For now, we'll just vectorize the change mask.
    
    # Vectorize only the change_mask (where value is 1)
    vectors = change_mask.selfMask().reduceToVectors(
        geometry=geometry,
        scale=10, # AlphaEarth is 10m resolution
        maxPixels=1e10,
        geometryType='polygon',
        eightConnected=False,
        labelProperty='change_mask', # This will be 1 for changed areas
        tileScale=16
    )

    # The mapping over features to get old_class and new_class by sampling is no longer directly applicable.
    # We will need to derive indicators from embeddings later.
    change_features = vectors

    if change_features.size().getInfo() == 0:
        print(f"  ⚠️ No significant changes detected for {year1} → {year2}.")
        return

    # --- MODIFICATION FOR LOCAL SAVE ---
    local_filename = os.path.join(output_dir, f'bosque_east_change_{year1}_{year2}.geojson')
    
    try:
        # Attempt to get info directly. This can fail for very large collections.
        print(f"  📥 Attempting to download data for {year1} → {year2} locally...")
        feature_collection_json = change_features.getInfo()
        
        os.makedirs(output_dir, exist_ok=True)
        with open(local_filename, 'w') as f:
            json.dump(feature_collection_json, f, indent=2)
        print(f"  ✅ Saved changes for {year1} → {year2} to {local_filename}")
    except Exception as e:
        print(f"  ❌ Failed to save {year1} → {year2} locally. Data might be too large for direct download.")
        print(f"  Error: {e}")
        print("  Consider exporting to Google Drive/Cloud Storage and downloading manually for large areas.")

def main():
    """Main function to calculate and export AlphaEarth embedding change data for the east area."""
    print("🌍 Calculating AlphaEarth Embedding Changes for Bosque East Area, TX")
    print("="*60)
    
    initialize_gee()
    
    # Define the study area for the area directly to the east of the previous one
    # Original: [-98.05, 31.65, -97.35, 32.1]
    # Shifted east by 0.7 degrees longitude
    bosque_east_geom = ee.Geometry.Rectangle([-97.35, 31.65, -96.65, 32.1])
    
    # Define the output directory within the project's public folder
    project_root = os.path.dirname(os.path.abspath(__file__))
    output_directory = os.path.join(project_root, 'public', 'bosque_east_changes')
    
    year_pairs = [
        (2020, 2021),
        (2021, 2022),
        (2022, 2023),
        (2023, 2024)
    ]
    
    for year1, year2 in year_pairs:
        export_land_cover_changes_local(year1, year2, bosque_east_geom, output_directory)
        
    print("\n✅ All land cover change tasks have been initiated (local save attempted).")

if __name__ == "__main__":
    main()

