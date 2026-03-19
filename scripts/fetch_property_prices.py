import os
import json
import time
import logging
from bs4 import BeautifulSoup
from firecrawl import FirecrawlApp
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from datetime import datetime
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich.table import Table
from rich.logging import RichHandler
import shapely.geometry
import random
import argparse

# Initialize rich console and logging
console = Console()
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True, console=console)]
)
log = logging.getLogger("property_scraper")

# Load environment variables
load_dotenv()

# Firecrawl API configuration
FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1"
FIRECRAWL_API_KEY = os.getenv('firecrawl')

# Default configuration
DEFAULT_SAMPLE_POINTS = 20
DEFAULT_MAX_ATTEMPTS = 200  # Increased to accommodate more points

class PropertySchema(BaseModel):
    price: str = Field(description="The listing price of the property")
    address: str = Field(description="The full address of the property")
    square_footage: str = Field(description="The square footage of the property")
    property_type: str = Field(description="The type of property (e.g., Single Family, Condo, etc.)")
    bedrooms: str = Field(description="Number of bedrooms")
    bathrooms: str = Field(description="Number of bathrooms")
    year_built: str = Field(description="Year the property was built")
    listing_url: str = Field(description="URL of the property listing")
    latitude: float = Field(description="Property latitude")
    longitude: float = Field(description="Property longitude")

def load_neighborhood_boundaries():
    """
    Load LA Times neighborhood boundaries from GeoJSON file
    """
    try:
        log.info("Loading neighborhood boundaries from GeoJSON file...")
        with open('public/LA_Times_Neighborhood_Boundaries.geojson', 'r') as f:
            data = json.load(f)
        log.info(f"Successfully loaded {len(data['features'])} neighborhood boundaries")
        return data['features']
    except Exception as e:
        log.error(f"Error loading neighborhood boundaries: {e}")
        return []

def get_sample_points(geometry, num_points=DEFAULT_SAMPLE_POINTS):
    """
    Get a sample of points within a neighborhood boundary
    
    Args:
        geometry (dict): GeoJSON geometry object
        num_points (int): Number of points to sample
        
    Returns:
        list: List of (lat, lon) tuples
    """
    try:
        log.info(f"Generating {num_points} sample points...")
        
        # Convert GeoJSON geometry to shapely
        shape = shapely.geometry.shape(geometry)
        
        # Get the bounds
        minx, miny, maxx, maxy = shape.bounds
        log.debug(f"Boundary bounds: ({minx}, {miny}) to ({maxx}, {maxy})")
        
        points = []
        attempts = 0
        max_attempts = DEFAULT_MAX_ATTEMPTS
        
        while len(points) < num_points and attempts < max_attempts:
            # Generate random point within bounds
            point = shapely.geometry.Point(
                random.uniform(minx, maxx),
                random.uniform(miny, maxy)
            )
            
            # Check if point is within polygon
            if shape.contains(point):
                points.append((point.y, point.x))  # Convert to (lat, lon)
                if len(points) % 5 == 0:  # Log progress every 5 points
                    log.info(f"Generated {len(points)}/{num_points} points...")
            
            attempts += 1
            
        if len(points) < num_points:
            log.warning(f"Could only generate {len(points)} points after {attempts} attempts")
        else:
            log.info(f"Successfully generated {len(points)} points")
            
        return points
    except Exception as e:
        log.error(f"Error generating sample points: {e}")
        return []

def fetch_property_prices(location, sample_points):
    """
    Fetch property prices for a given location using Firecrawl API.
    
    Args:
        location (dict): Dictionary containing neighborhood name
        sample_points (list): List of (lat, lon) tuples to search around
    """
    all_properties = []
    
    # Initialize Firecrawl client
    app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)
    
    # Process each sample point
    for i, (lat, lon) in enumerate(sample_points, 1):
        log.info(f"Processing point {i}/{len(sample_points)} at ({lat:.4f}, {lon:.4f})")
        
        # Format location string for URLs
        location_str = f"{location['name'].replace(' ', '-').replace('/', '-').lower()}-los-angeles-ca"
        
        # Define target sites with their URLs
        target_sites = [
            {
                'name': 'Zillow',
                'url': f'https://www.zillow.com/homes/{location_str}?lat={lat}&lon={lon}'
            },
            {
                'name': 'Redfin',
                'url': f'https://www.redfin.com/neighborhood/{location_str}?lat={lat}&lon={lon}'
            },
            {
                'name': 'Realtor',
                'url': f'https://www.realtor.com/realestateandhomes-search/{location_str}?lat={lat}&lon={lon}'
            },
            {
                'name': 'Trulia',
                'url': f'https://www.trulia.com/for_sale/{location_str}?lat={lat}&lon={lon}'
            }
        ]
        
        # Process each URL
        for site in target_sites:
            log.info(f"Fetching data from {site['name']}: {site['url']}")
            
            max_retries = 3
            retry_delay = 60  # Start with 60 seconds delay
            
            for attempt in range(max_retries):
                try:
                    # Extract data using a specific prompt
                    result = app.extract(
                        [site['url']],  # List of URLs
                        {
                            'prompt': f"""
                            Find all property listings on this page. For each property listing, extract:
                            1. The price (look for elements with class containing 'price', 'Price', or data-test='property-price')
                            2. The address (look for elements with class containing 'address', 'Address', or data-test='property-address')
                            3. The square footage (look for elements with class containing 'sqft', 'Sqft', or data-test='property-sqft')
                            4. The property type (look for elements with class containing 'type', 'Type', or data-test='property-type')
                            5. The number of bedrooms (look for elements with class containing 'bed', 'Bed', or data-test='property-beds')
                            6. The number of bathrooms (look for elements with class containing 'bath', 'Bath', or data-test='property-baths')
                            7. The year built (look for elements containing 'Built in', 'Year built', or data-test='property-year')
                            8. The listing URL
                            9. The latitude and longitude coordinates
                            
                            Return the data as an array of objects, where each object represents a property listing with the above fields.
                            If a field is not found, set it to null.
                            """,
                            'enableWebSearch': True,  # Enable web search for better results
                            'scrapeOptions': {
                                'waitFor': 5000,  # Wait 5 seconds for dynamic content
                                'onlyMainContent': True,
                                'headers': {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                                }
                            }
                        }
                    )
                    
                    log.debug(f"Response from {site['name']}:")
                    log.debug(json.dumps(result, indent=2)[:1000])  # Print first 1000 chars
                    
                    if result.get('success') and result.get('data'):
                        properties = result['data']
                        if isinstance(properties, dict) and 'propertyListings' in properties:
                            properties = properties['propertyListings']
                        if isinstance(properties, list):
                            log.info(f"Found {len(properties)} properties from {site['name']}")
                            for prop in properties:
                                prop['source'] = site['name']
                                prop['search_lat'] = lat
                                prop['search_lon'] = lon
                                all_properties.append(prop)
                        else:
                            log.warning(f"Unexpected data format from {site['name']}")
                    else:
                        log.warning(f"No valid data received from {site['name']}")
                    
                    # If successful, break the retry loop
                    break
                    
                except Exception as e:
                    error_msg = str(e)
                    if '429' in error_msg or 'Rate limit exceeded' in error_msg:
                        if attempt < max_retries - 1:
                            log.warning(f"Rate limit hit, waiting {retry_delay} seconds before retry {attempt + 1}/{max_retries}")
                            time.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                            continue
                    log.error(f"Error processing {site['name']}: {error_msg}")
                    break
            
            # Add delay between requests
            time.sleep(5)
    
    # Create GeoJSON structure
    geojson = {
        "type": "FeatureCollection",
        "features": [],
        "metadata": {
            "neighborhood": location['name'],
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_properties": len(all_properties),
            "sources": list(set(prop['source'] for prop in all_properties)),
            "sample_points": sample_points
        }
    }
    
    # Add properties to features
    for prop in all_properties:
        feature = {
            "type": "Feature",
            "properties": prop,
            "geometry": {
                "type": "Point",
                "coordinates": [
                    float(prop.get('longitude', prop.get('search_lon'))),
                    float(prop.get('latitude', prop.get('search_lat')))
                ]
            } if prop.get('latitude') or prop.get('search_lat') else None
        }
        geojson['features'].append(feature)
    
    # Save to file
    output_dir = "data/los_angeles_ca"
    os.makedirs(output_dir, exist_ok=True)
    
    # Sanitize neighborhood name for file path
    safe_name = location['name'].replace('/', '-').replace(' ', '_').lower()
    output_file = f"{output_dir}/{safe_name}.geojson"
    
    with open(output_file, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    log.info(f"Data saved to {output_file}")
    log.info(f"Found {len(all_properties)} total properties for {location['name']}")
    
    return len(all_properties)

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Fetch property prices for LA neighborhoods')
    parser.add_argument('--sample-points', type=int, default=DEFAULT_SAMPLE_POINTS,
                      help=f'Number of sample points per neighborhood (default: {DEFAULT_SAMPLE_POINTS})')
    parser.add_argument('--debug', action='store_true',
                      help='Enable debug logging')
    args = parser.parse_args()
    
    # Set logging level
    if args.debug:
        log.setLevel(logging.DEBUG)
    
    log.info("[bold green]Starting property price data collection for LA neighborhoods...[/bold green]")
    log.info(f"Using {args.sample_points} sample points per neighborhood")
    
    # Load neighborhood boundaries
    neighborhoods = load_neighborhood_boundaries()
    if not neighborhoods:
        return
    
    total_properties = 0
    processed_neighborhoods = 0
    
    # Process each neighborhood
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("[yellow]Processing neighborhoods...", total=len(neighborhoods))
        
        for feature in neighborhoods:
            neighborhood = feature['properties']
            log.info(f"\n[bold blue]Processing {neighborhood['name']}...[/bold blue]")
            
            # Get sample points within neighborhood boundary
            sample_points = get_sample_points(feature['geometry'], args.sample_points)
            if not sample_points:
                log.warning(f"No sample points generated for {neighborhood['name']}, skipping...")
                continue
            
            # Fetch property data
            num_properties = fetch_property_prices(neighborhood, sample_points)
            total_properties += num_properties
            processed_neighborhoods += 1
            
            progress.advance(task)
            
            # Add delay between neighborhoods
            time.sleep(5)
    
    # Print summary
    log.info("\n[bold green]Data collection complete![/bold green]")
    log.info(f"Processed {processed_neighborhoods} neighborhoods")
    log.info(f"Found {total_properties} total properties")

if __name__ == "__main__":
    main() 