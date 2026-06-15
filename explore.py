import json
import os

workspace_dir = r"C:\Users\Tin Ko Oo\Desktop\demo"
eq_file = os.path.join(workspace_dir, "dmh_myanmar_earthquake_data.geojson")
tectonic_file = os.path.join(workspace_dir, "Myanmar_Tectonic_Map_2011.geojson")

with open(eq_file, 'r', encoding='utf-8') as f:
    eq_data = json.load(f)

with open(tectonic_file, 'r', encoding='utf-8') as f:
    tect_data = json.load(f)

print(f"Total earthquakes: {len(eq_data['features'])}")
print(f"Total tectonic lines: {len(tect_data['features'])}")

# Analyze earthquakes
magnitudes = []
depths = []
dates = []
locations = []
latitudes = []
longitudes = []

for feature in eq_data['features']:
    props = feature['properties']
    geom = feature['geometry']
    magnitudes.append(props.get('Magnitude', 0))
    depths.append(props.get('Depth_km', 0))
    dates.append(props.get('Date', ''))
    locations.append(props.get('Location', ''))
    if geom and geom['type'] == 'Point':
        longitudes.append(geom['coordinates'][0])
        latitudes.append(geom['coordinates'][1])

min_m, max_m = min(magnitudes), max(magnitudes)
avg_m = sum(magnitudes)/len(magnitudes)
min_d, max_d = min(depths), max(depths)
avg_d = sum(depths)/len(depths)

print(f"Magnitude: Min={min_m}, Max={max_m}, Avg={avg_m:.2f}")
print(f"Depth (km): Min={min_d}, Max={max_d}, Avg={avg_d:.2f}")
print(f"Dates: Min={min(dates)}, Max={max(dates)}")
print(f"Latitudes: Min={min(latitudes)}, Max={max(latitudes)}")
print(f"Longitudes: Min={min(longitudes)}, Max={max(longitudes)}")

# Let's count some location keywords
from collections import Counter
words = []
for loc in locations:
    words.append(loc)
print("Top 10 Locations:")
for loc, cnt in Counter(words).most_common(10):
    print(f"  {loc}: {cnt}")
