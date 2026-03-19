import geojson
from shapely.geometry import Point, mapping
from shapely.ops import transform
import pyproj

# City centers and names
cities = [
    ("Rocksprings, TX", -100.2104, 30.0152),
    ("Leakey, TX", -99.7576, 29.7283),
    ("Ozona, TX", -101.2007, 30.7116),
    ("Sonora, TX", -100.6432, 30.5671),
    ("Utopia, TX", -99.5270, 29.6161),
    ("Hondo, TX", -99.1417, 29.3477),
    ("Fort Stockton, TX", -102.8771, 30.8943),
]

radius_normal = 6437.38  # 4 miles in meters
radius_large = 19312.14   # 12 miles in meters (3X normal)

features = []

for name, lon, lat in cities:
    proj_wgs84 = pyproj.CRS('EPSG:4326')
    proj_aeqd = pyproj.CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m +no_defs")
    project = pyproj.Transformer.from_crs(proj_wgs84, proj_aeqd, always_xy=True).transform
    project_back = pyproj.Transformer.from_crs(proj_aeqd, proj_wgs84, always_xy=True).transform
    point = Point(lon, lat)
    # Normal circle
    buffer_normal = transform(project, point).buffer(radius_normal, resolution=64)
    buffer_normal_wgs84 = transform(project_back, buffer_normal)
    features.append(geojson.Feature(geometry=mapping(buffer_normal_wgs84), properties={"name": name, "type": "normal"}))
    # Large circle
    buffer_large = transform(project, point).buffer(radius_large, resolution=64)
    buffer_large_wgs84 = transform(project_back, buffer_large)
    features.append(geojson.Feature(geometry=mapping(buffer_large_wgs84), properties={"name": name, "type": "large"}))

fc = geojson.FeatureCollection(features)
with open("public/data/path_a_circles.geojson", "w") as f:
    geojson.dump(fc, f) 