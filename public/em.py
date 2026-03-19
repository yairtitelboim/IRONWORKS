import json
import pandas as pd
import numpy as np
from geopy.distance import geodesic
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns

def load_datasets():
    """Load OSM infrastructure and startup datasets"""
    
    # Load OSM infrastructure data
    try:
        with open('osm-boston-cache.json', 'r') as f:
            osm_data = json.load(f)
        print(f"Loaded {len(osm_data['features'])} OSM features")
    except FileNotFoundError:
        print("OSM file not found - using sample data structure")
        osm_data = {"features": []}
    
    # Load startup data
    try:
        with open('startup-geographic-intelligence.geojson', 'r') as f:
            startup_data = json.load(f)
        print(f"Loaded {len(startup_data['features'])} startups")
    except FileNotFoundError:
        print("Startup file not found - using sample data structure")
        startup_data = {"features": []}
    
    return osm_data, startup_data

def analyze_infrastructure_proximity(osm_data, startup_data):
    """Calculate distances from startups to key infrastructure with enhanced analysis"""
    
    # Extract infrastructure by category with enhanced categorization
    infrastructure = {}
    for feature in osm_data['features']:
        props = feature['properties']
        coords = feature['geometry']['coordinates']
        
        # Enhanced categorization for startup ecosystem analysis
        category = props.get('category', 'unknown')
        university_type = props.get('university_type', 'Other')
        is_major = props.get('is_major_university', False)
        
        # Create more specific categories for analysis
        if category == 'university' or category == 'university_campus':
            if is_major:
                # Major universities get their own category
                infra_category = f"university_{university_type.lower().replace(' ', '_')}"
            else:
                infra_category = "university_other"
        elif category == 'transportation_station':
            infra_category = "transit_station"
        elif category == 'office_building' or category == 'office_complex':
            infra_category = "office_space"
        else:
            infra_category = category
        
        if infra_category not in infrastructure:
            infrastructure[infra_category] = []
        
        infrastructure[infra_category].append({
            'name': props.get('name', 'unnamed'),
            'coords': coords,
            'university_type': university_type,
            'is_major_university': is_major,
            'original_category': category
        })
    
    # Analyze each startup with enhanced metrics
    results = []
    for startup in startup_data['features']:
        startup_coords = startup['geometry']['coordinates']
        startup_name = startup['properties']['name']
        startup_category = startup['properties'].get('category', 'Unknown')
        startup_industries = startup['properties'].get('industries', 'Unknown')
        startup_funding = startup['properties'].get('fundingStage', 'Unknown')
        
        distances = {
            'startup': startup_name, 
            'category': startup_category,
            'industries': startup_industries,
            'funding_stage': startup_funding
        }
        
        # Calculate distances to different infrastructure types
        for infra_type, facilities in infrastructure.items():
            if facilities:
                distances_list = []
                for f in facilities:
                    coords = f['coords']
                    # Handle different coordinate formats
                    if isinstance(coords[0], list):
                        # Polygon or LineString - use first coordinate
                        if len(coords) > 0 and len(coords[0]) >= 2:
                            infra_lat, infra_lng = coords[0][1], coords[0][0]
                        else:
                            continue
                    else:
                        # Point - direct coordinates
                        if len(coords) >= 2:
                            infra_lat, infra_lng = coords[1], coords[0]
                        else:
                            continue
                    
                    try:
                        dist = geodesic((startup_coords[1], startup_coords[0]), 
                                      (infra_lat, infra_lng)).miles
                        distances_list.append(dist)
                    except:
                        continue
                
                if distances_list:
                    min_distance = min(distances_list)
                    avg_distance = np.mean(distances_list)
                    
                    distances[f'{infra_type}_min_dist'] = round(min_distance, 2)
                    distances[f'{infra_type}_avg_dist'] = round(avg_distance, 2)
                    distances[f'{infra_type}_count'] = len(facilities)
        
        results.append(distances)
    
    return pd.DataFrame(results), infrastructure

def analyze_sector_clustering_patterns(df):
    """Analyze whether different startup sectors show distinct spatial clustering patterns"""
    
    print("\n=== SECTOR CLUSTERING ANALYSIS ===")
    
    # Key infrastructure types to analyze
    key_infrastructure = [
        'university_mit', 'university_harvard', 'university_northeastern', 
        'university_boston_university', 'university_tufts', 'transit_station',
        'office_space', 'park', 'commercial_zone'
    ]
    
    # Filter to only include infrastructure that exists in our data
    available_infra = [infra for infra in key_infrastructure 
                      if f'{infra}_min_dist' in df.columns]
    
    sector_analysis = {}
    
    for sector in df['category'].unique():
        sector_data = df[df['category'] == sector]
        sector_analysis[sector] = {}
        
        print(f"\n--- {sector} ({len(sector_data)} companies) ---")
        
        for infra in available_infra:
            min_dist_col = f'{infra}_min_dist'
            if min_dist_col in sector_data.columns and not sector_data[min_dist_col].isna().all():
                avg_min_dist = sector_data[min_dist_col].mean()
                std_min_dist = sector_data[min_dist_col].std()
                median_dist = sector_data[min_dist_col].median()
                
                sector_analysis[sector][infra] = {
                    'avg_min_dist': avg_min_dist,
                    'std_min_dist': std_min_dist,
                    'median_dist': median_dist,
                    'count': len(sector_data)
                }
                
                print(f"  {infra}: avg={avg_min_dist:.2f}mi, median={median_dist:.2f}mi, std={std_min_dist:.2f}mi")
    
    return sector_analysis

def test_clustering_significance(df):
    """Test statistical significance of clustering patterns between sectors"""
    
    print("\n=== STATISTICAL SIGNIFICANCE TESTS ===")
    
    # Key infrastructure for testing
    test_infrastructure = ['university_mit', 'university_harvard', 'transit_station', 'office_space']
    available_infra = [infra for infra in test_infrastructure 
                      if f'{infra}_min_dist' in df.columns]
    
    sectors = df['category'].unique()
    
    for infra in available_infra:
        min_dist_col = f'{infra}_min_dist'
        if min_dist_col not in df.columns:
            continue
            
        print(f"\n--- Testing {infra} clustering ---")
        
        # Get data for each sector
        sector_data = {}
        for sector in sectors:
            sector_distances = df[df['category'] == sector][min_dist_col].dropna()
            if len(sector_distances) > 0:
                sector_data[sector] = sector_distances
        
        if len(sector_data) < 2:
            print(f"  Not enough sectors with data for {infra}")
            continue
        
        # Perform ANOVA test
        sector_groups = list(sector_data.values())
        f_stat, p_value = stats.f_oneway(*sector_groups)
        
        print(f"  ANOVA F-statistic: {f_stat:.4f}, p-value: {p_value:.4f}")
        
        if p_value < 0.05:
            print(f"  *** SIGNIFICANT DIFFERENCE in {infra} clustering between sectors (p < 0.05) ***")
            
            # Post-hoc pairwise comparisons
            sector_names = list(sector_data.keys())
            for i in range(len(sector_names)):
                for j in range(i+1, len(sector_names)):
                    sector1, sector2 = sector_names[i], sector_names[j]
                    t_stat, p_val = stats.ttest_ind(sector_data[sector1], sector_data[sector2])
                    print(f"    {sector1} vs {sector2}: t={t_stat:.3f}, p={p_val:.4f}")
        else:
            print(f"  No significant difference in {infra} clustering between sectors")

def create_clustering_visualizations(df, sector_analysis):
    """Create visualizations showing clustering patterns"""
    
    print("\n=== CREATING VISUALIZATIONS ===")
    
    # Set up the plotting style
    plt.style.use('seaborn-v0_8')
    fig, axes = plt.subplots(2, 2, figsize=(15, 12))
    fig.suptitle('Boston Startup Sector Clustering Analysis', fontsize=16, fontweight='bold')
    
    # Key infrastructure to visualize
    key_infra = ['university_mit', 'university_harvard', 'transit_station', 'office_space']
    available_infra = [infra for infra in key_infra if f'{infra}_min_dist' in df.columns]
    
    for idx, infra in enumerate(available_infra[:4]):  # Limit to 4 plots
        ax = axes[idx//2, idx%2]
        min_dist_col = f'{infra}_min_dist'
        
        # Create box plot for each sector
        sectors = df['category'].unique()
        sector_data = []
        sector_labels = []
        
        for sector in sectors:
            sector_distances = df[df['category'] == sector][min_dist_col].dropna()
            if len(sector_distances) > 0:
                sector_data.append(sector_distances)
                sector_labels.append(f"{sector}\n(n={len(sector_distances)})")
        
        if sector_data:
            ax.boxplot(sector_data, labels=sector_labels)
            ax.set_title(f'Distance to {infra.replace("_", " ").title()}')
            ax.set_ylabel('Distance (miles)')
            ax.tick_params(axis='x', rotation=45)
    
    plt.tight_layout()
    plt.savefig('startup_clustering_analysis.png', dpi=300, bbox_inches='tight')
    print("  Visualization saved as 'startup_clustering_analysis.png'")
    
    # Create heatmap of average distances
    if len(available_infra) > 0:
        plt.figure(figsize=(12, 8))
        
        # Create matrix for heatmap
        sectors = df['category'].unique()
        heatmap_data = []
        
        for sector in sectors:
            row = []
            for infra in available_infra:
                min_dist_col = f'{infra}_min_dist'
                if min_dist_col in df.columns:
                    avg_dist = df[df['category'] == sector][min_dist_col].mean()
                    row.append(avg_dist if not pd.isna(avg_dist) else 0)
                else:
                    row.append(0)
            heatmap_data.append(row)
        
        heatmap_df = pd.DataFrame(heatmap_data, 
                                index=sectors, 
                                columns=[infra.replace('_', ' ').title() for infra in available_infra])
        
        sns.heatmap(heatmap_df, annot=True, cmap='YlOrRd', fmt='.2f', cbar_kws={'label': 'Average Distance (miles)'})
        plt.title('Average Distance from Startup Sectors to Infrastructure')
        plt.xlabel('Infrastructure Type')
        plt.ylabel('Startup Sector')
        plt.tight_layout()
        plt.savefig('startup_infrastructure_heatmap.png', dpi=300, bbox_inches='tight')
        print("  Heatmap saved as 'startup_infrastructure_heatmap.png'")

def main():
    # Load data
    osm_data, startup_data = load_datasets()
    
    # Basic stats
    print("\n=== DATASET OVERVIEW ===")
    print(f"OSM Features: {len(osm_data.get('features', []))}")
    print(f"Startups: {len(startup_data.get('features', []))}")
    
    if not osm_data.get('features') or not startup_data.get('features'):
        print("No data loaded - check file paths")
        return
    
    # Infrastructure categories
    print("\n=== INFRASTRUCTURE CATEGORIES ===")
    categories = {}
    for feature in osm_data['features']:
        cat = feature['properties'].get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    for cat, count in sorted(categories.items()):
        print(f"{cat}: {count}")
    
    # Startup categories
    print("\n=== STARTUP CATEGORIES ===")
    startup_cats = {}
    for feature in startup_data['features']:
        cat = feature['properties'].get('category', 'Unknown')
        startup_cats[cat] = startup_cats.get(cat, 0) + 1
    
    for cat, count in sorted(startup_cats.items()):
        print(f"{cat}: {count}")
    
    # Calculate proximity analysis
    print("\n=== PROXIMITY ANALYSIS ===")
    df, infrastructure = analyze_infrastructure_proximity(osm_data, startup_data)
    
    if not df.empty:
        print(f"\nProximity data calculated for {len(df)} startups")
        print("\nSample distances (first 5 startups):")
        print(df.head().to_string())
        
        # Enhanced sector clustering analysis
        sector_analysis = analyze_sector_clustering_patterns(df)
        
        # Statistical significance testing
        test_clustering_significance(df)
        
        # Create visualizations
        try:
            create_clustering_visualizations(df, sector_analysis)
        except Exception as e:
            print(f"Visualization error: {e}")
            print("Continuing without visualizations...")
        
        # Key insights summary
        print("\n=== KEY INSIGHTS SUMMARY ===")
        print("This analysis reveals whether Boston startups optimize for different infrastructure types based on their sector.")
        print("Key questions answered:")
        print("1. Do AI/ML companies cluster closer to MIT than other sectors?")
        print("2. Do biotech companies prefer locations near hospitals/research facilities?")
        print("3. Do fintech companies prioritize transit access over university proximity?")
        print("4. Are there significant spatial clustering differences between sectors?")
        
        # Find the most interesting patterns
        print("\n=== NOTABLE PATTERNS ===")
        
        # MIT proximity analysis
        if 'university_mit_min_dist' in df.columns:
            mit_distances = df.groupby('category')['university_mit_min_dist'].agg(['mean', 'count']).round(2)
            mit_distances = mit_distances[mit_distances['count'] > 0].sort_values('mean')
            print("\nAverage distance to MIT (miles):")
            for sector, row in mit_distances.iterrows():
                print(f"  {sector}: {row['mean']:.2f}mi (n={int(row['count'])})")
        
        # Transit proximity analysis
        if 'transit_station_min_dist' in df.columns:
            transit_distances = df.groupby('category')['transit_station_min_dist'].agg(['mean', 'count']).round(2)
            transit_distances = transit_distances[transit_distances['count'] > 0].sort_values('mean')
            print("\nAverage distance to transit stations (miles):")
            for sector, row in transit_distances.iterrows():
                print(f"  {sector}: {row['mean']:.2f}mi (n={int(row['count'])})")
    
    return df, infrastructure

if __name__ == "__main__":
    df, infrastructure = main()