#!/usr/bin/env python3

import os
import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Any
from dotenv import load_dotenv
from openai import OpenAI
import asyncio
from concurrent.futures import ThreadPoolExecutor
from tqdm import tqdm
import argparse
from rich.console import Console
from rich.table import Table
from rich import print as rprint
from tenacity import retry, stop_after_attempt, wait_exponential
import aiohttp
import asyncio.exceptions

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
console = Console()

class RateLimiter:
    def __init__(self, calls_per_minute):
        self.calls_per_minute = calls_per_minute
        self.calls = []
        
    async def acquire(self):
        now = time.time()
        # Remove calls older than 1 minute
        self.calls = [t for t in self.calls if now - t < 60]
        
        if len(self.calls) >= self.calls_per_minute:
            # Wait until we can make another call
            wait_time = 60 - (now - self.calls[0])
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self.calls = self.calls[1:]
        
        self.calls.append(now)

class MarkerEnricher:
    def __init__(self, test_mode=False, limit=None):
        """Initialize the MarkerEnricher with OpenAI client."""
        self.api_key = os.getenv('OPENAI_KEY')
        if not self.api_key:
            raise ValueError("OPENAI_KEY environment variable is required")
        self.client = OpenAI(api_key=self.api_key)
        self.cache_dir = Path("public/processed_planning_docs/enrichment_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache = self._load_cache()
        self.test_mode = test_mode
        self.limit = limit
        self.test_results = []
        self.rate_limiter = RateLimiter(calls_per_minute=50)  # OpenAI rate limit
        self.progress_bar = None

    def _load_cache(self) -> Dict[str, str]:
        """Load existing enriched descriptions from cache."""
        cache_file = self.cache_dir / "enriched_descriptions.json"
        if cache_file.exists():
            with open(cache_file, 'r') as f:
                return json.load(f)
        return {}

    def _save_cache(self):
        """Save enriched descriptions to cache."""
        try:
            cache_file = self.cache_dir / "enriched_descriptions.json"
            temp_file = cache_file.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json.dump(self.cache, f, indent=2)
            temp_file.replace(cache_file)  # Atomic write
        except Exception as e:
            logger.error(f"Error saving cache: {str(e)}")

    def _generate_cache_key(self, feature: Dict[str, Any]) -> str:
        """Generate a unique cache key for a feature."""
        props = feature['properties']
        key_parts = [
            str(props.get('name', '')),
            str(props.get('neighborhood', '')),
            str(props.get('description', ''))[:100],  # First 100 chars of description
            str(props.get('source_document', ''))
        ]
        return '_'.join(key_parts)

    def _display_test_results(self):
        """Display test results in a formatted table."""
        table = Table(title="Enrichment Test Results")
        table.add_column("Location", style="cyan")
        table.add_column("Type", style="magenta")
        table.add_column("Original Description", style="yellow", width=40)
        table.add_column("Enriched Description", style="green", width=40)

        for result in self.test_results:
            table.add_row(
                f"{result['name']} ({result['neighborhood']})",
                result['type'],
                result['original_desc'][:200] + ('...' if len(result['original_desc']) > 200 else ''),
                result['enriched_desc']
            )

        console.print(table)
        
        # Save test results to file
        try:
            test_output = self.cache_dir / "test_results.json"
            with open(test_output, 'w') as f:
                json.dump(self.test_results, f, indent=2)
            logger.info(f"Test results saved to {test_output}")
        except Exception as e:
            logger.error(f"Error saving test results: {str(e)}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry_error_callback=lambda retry_state: retry_state.outcome.result()
    )
    async def _call_openai(self, prompt: str) -> str:
        """Make an OpenAI API call with retry logic."""
        await self.rate_limiter.acquire()
        try:
            response = await asyncio.to_thread(
                lambda: self.client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are an expert urban planner providing specific, actionable site analyses based on LA City planning documents."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_tokens=200
                )
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise

    async def enrich_description(self, feature: Dict[str, Any], marker_type: str) -> str:
        """Enrich a single feature's description using OpenAI."""
        try:
            cache_key = self._generate_cache_key(feature)
            props = feature['properties']
            
            # Return cached description if available and not in test mode
            if cache_key in self.cache and not self.test_mode:
                return self.cache[cache_key]
            
            prompt = f"""As an urban planning expert, analyze this location based on LA City planning documents and provide actionable insights.

LOCATION CONTEXT:
- Site: {props.get('name', 'Unknown location')}
- Neighborhood: {props.get('neighborhood', 'Los Angeles')}
- Type: {marker_type}
- Source Document: {props.get('source_document', 'Unknown source')}

CURRENT INFORMATION:
{props.get('description', 'No description available')}

Provide a concise, specific analysis focusing on:
1. KEY POLICY OBJECTIVES: What specific policy goals or initiatives target this area?
2. DEVELOPMENT OPPORTUNITIES: What concrete development or reuse potential exists here?
3. LOCAL IMPACT: How will changes affect the immediate neighborhood (within 15-minute walk)?
4. IMPLEMENTATION: What specific programs, funding, or incentives are available?

Format the response as 2-3 clear, action-oriented sentences that:
- Highlight specific policy initiatives and programs
- Include concrete details about development plans
- Mention actual community benefits and neighborhood context
- Reference real funding sources or incentives when available

Example good response:
"This Arts District site is designated for adaptive reuse under the Industrial Land Reform ordinance, with $2.5M in AHLF funding available for conversion to mixed-income housing. The 50,000 sq ft warehouse will be transformed into 75 housing units with ground-floor creative space, supported by the Creative Enterprise Zone program. The project aligns with the Community Plan's goal of 15-minute neighborhood development, adding housing within walking distance of the Little Tokyo Gold Line station and the Arts District Park."

AVOID:
- Generic planning language
- Vague possibilities
- Unspecified benefits
- Missing local context
"""

            enriched_description = await self._call_openai(prompt)
            
            # Store test results if in test mode
            if self.test_mode:
                self.test_results.append({
                    'name': props.get('name', 'Unknown'),
                    'neighborhood': props.get('neighborhood', 'Los Angeles'),
                    'type': marker_type,
                    'original_desc': props.get('description', 'No description available'),
                    'enriched_desc': enriched_description
                })
            
            # Cache the result
            self.cache[cache_key] = enriched_description
            if len(self.cache) % 10 == 0:  # Save cache periodically
                self._save_cache()
                
            return enriched_description
            
        except Exception as e:
            logger.error(f"Error enriching description for {props.get('name', 'Unknown')}: {str(e)}")
            return props.get('description', 'Site identified for potential development.')

    async def process_geojson(self, input_file: Path, output_file: Path, marker_type: str):
        """Process a GeoJSON file and enrich all feature descriptions."""
        try:
            logger.info(f"Processing {input_file}")
            
            with open(input_file, 'r') as f:
                data = json.load(f)
                
            features = data['features']
            total_features = len(features)
            logger.info(f"Found {total_features} features to process")
            
            # Apply limit if specified
            if self.limit:
                features = features[:self.limit]
                logger.info(f"Processing limited set of {len(features)} features")
            elif self.test_mode:
                test_size = min(3, total_features)
                features = features[:test_size]
                logger.info(f"Test mode: Processing {test_size} features")
            
            # Process features in smaller batches with progress bar
            batch_size = 3  # Reduced batch size for better stability
            enriched_count = 0
            
            with tqdm(total=len(features), desc=f"Processing {marker_type}") as pbar:
                for i in range(0, len(features), batch_size):
                    batch = features[i:i + batch_size]
                    tasks = [self.enrich_description(feature, marker_type) for feature in batch]
                    
                    try:
                        enriched_descriptions = await asyncio.gather(*tasks, return_exceptions=True)
                        
                        # Update features with enriched descriptions
                        for feature, description in zip(batch, enriched_descriptions):
                            if isinstance(description, Exception):
                                logger.error(f"Error in batch: {str(description)}")
                                description = feature['properties'].get('description', 'Site identified for potential development.')
                            
                            feature['properties']['description'] = description
                            enriched_count += 1
                            pbar.update(1)
                        
                        # Add delay between batches to respect rate limits
                        if i + batch_size < len(features):
                            await asyncio.sleep(1)
                            
                    except Exception as e:
                        logger.error(f"Error processing batch: {str(e)}")
                        continue
            
            if self.test_mode:
                self._display_test_results()
            else:
                # Save enriched GeoJSON
                try:
                    temp_file = output_file.with_suffix('.tmp')
                    with open(temp_file, 'w') as f:
                        json.dump(data, f, indent=2)
                    temp_file.replace(output_file)  # Atomic write
                    logger.info(f"Saved enriched data to {output_file}")
                except Exception as e:
                    logger.error(f"Error saving enriched data: {str(e)}")
                
                # Save final cache
                self._save_cache()
            
            return enriched_count
            
        except Exception as e:
            logger.error(f"Error processing GeoJSON file: {str(e)}")
            return 0

async def main():
    """Main function to run the enrichment process."""
    parser = argparse.ArgumentParser(description="Enrich planning markers with improved descriptions")
    parser.add_argument("--test", action="store_true", help="Run in test mode with sample markers")
    parser.add_argument("--limit", type=int, help="Limit the number of markers to process")
    args = parser.parse_args()

    try:
        input_dir = Path("public/processed_planning_docs/single")
        output_dir = Path("public/processed_planning_docs/enriched")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        enricher = MarkerEnricher(test_mode=args.test, limit=args.limit)
        
        if args.test:
            console.print("[yellow]Running in TEST MODE - processing sample markers only[/yellow]")
        elif args.limit:
            console.print(f"[yellow]Processing limited set of {args.limit} markers[/yellow]")
        
        # Process both types of markers
        marker_types = {
            'adaptive_reuse.geojson': 'Adaptive Reuse Site',
            'development_potential.geojson': 'Development Potential Site'
        }
        
        total_enriched = 0
        
        for filename, marker_type in marker_types.items():
            input_file = input_dir / filename
            output_file = output_dir / filename
            
            if not input_file.exists():
                logger.warning(f"Input file not found: {input_file}")
                continue
                
            enriched_count = await enricher.process_geojson(input_file, output_file, marker_type)
            total_enriched += enriched_count
        
        if args.test:
            console.print("\n[green]Test complete! Review the results above to ensure quality.[/green]")
            console.print("[yellow]To process all markers, run the script without the --test flag.[/yellow]")
        else:
            logger.info(f"Enrichment complete. Total features enriched: {total_enriched}")
            
    except Exception as e:
        logger.error(f"Error in main process: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 