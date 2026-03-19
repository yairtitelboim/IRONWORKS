# 3D Buildings Optimization Script

> **📋 Primary Documentation**: This README is part of the comprehensive system documentation. For the complete architectural overview and production readiness plan, see **[WEEK01_REPORT_SEPT2025.md](../WEEK01_REPORT_SEPT2025.md)**.

This directory contains scripts to optimize large GeoJSON files for better performance in the web application.

## `optimize_buildings.py`

This script processes a large 3D buildings GeoJSON file and creates an optimized version with the most significant buildings while reducing the overall file size.

### Prerequisites

```bash
pip install shapely numpy tqdm geopandas pandas
```

### Usage

```bash
python optimize_buildings.py [input_file] [output_file] [options]
```

#### Options

- `--min-height=X`: Minimum building height to include (meters) (default: 10)
- `--max-buildings=X`: Maximum number of buildings to include (default: 10000)
- `--simplify=X`: Simplification tolerance (meters) (default: 1.0)
- `--sample=X`: Random sample percentage (0-1) of buildings below height threshold (default: 0.05)

### Examples

#### Basic usage with default parameters

```bash
python optimize_buildings.py public/data/osm/la_buildings_3d.geojson public/data/osm/la_buildings_3d_optimized.geojson
```

#### Optimizing with custom parameters

```bash
python optimize_buildings.py public/data/osm/la_buildings_3d.geojson public/data/osm/la_buildings_3d_optimized.geojson --min-height=15 --max-buildings=5000 --simplify=1.5 --sample=0.01
```

This command will:
1. Include all buildings taller than 15 meters
2. Limit the total to 5000 buildings
3. Apply a 1.5 meter simplification tolerance to reduce geometry complexity
4. Sample only 1% of buildings below the height threshold

### How It Works

The script:

1. Processes the large GeoJSON file in chunks to avoid memory issues
2. Prioritizes taller buildings
3. Randomly samples a percentage of smaller buildings
4. Simplifies geometry to reduce file size
5. Removes unnecessary properties
6. Limits the total number of buildings

### Optimization Results

After running the script, it will report:
- Number of buildings included in the optimized file
- Original and optimized file sizes
- Compression ratio

Example output:
```
Optimized file created: public/data/osm/la_buildings_3d_optimized.geojson
Included 8520 buildings total
File size reduced from 847.25MB to 7.82MB
Compression ratio: 0.92%
```

## Integrating with the Map

The application is configured to load the optimized buildings file (`la_buildings_3d_optimized.geojson`) when the 3D Buildings toggle is activated. The buildings are displayed in red to distinguish them from the default Mapbox buildings, which appear in dark gray at higher zoom levels. 