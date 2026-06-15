import json
import os
import math

workspace_dir = r"C:\Users\Tin Ko Oo\Desktop\demo"
eq_file = os.path.join(workspace_dir, "dmh_myanmar_earthquake_data.geojson")
tectonic_file = os.path.join(workspace_dir, "Myanmar_Tectonic_Map_2011.geojson")
output_file = os.path.join(workspace_dir, "analyzed_earthquakes.json")

# Load data
with open(eq_file, 'r', encoding='utf-8') as f:
    eq_data = json.load(f)

with open(tectonic_file, 'r', encoding='utf-8') as f:
    tect_data = json.load(f)

# Helper function to project lon/lat to local flat coordinates in km
def project(lon, lat):
    lat_rad = math.radians(lat)
    y = lat * 110.574
    x = lon * 111.320 * math.cos(lat_rad)
    return x, y

def point_to_segment_distance_km(px, py, ax, ay, bx, by):
    abx = bx - ax
    aby = by - ay
    apx = px - ax
    apy = py - ay
    
    ab_len_sq = abx * abx + aby * aby
    if ab_len_sq == 0:
        return math.sqrt(apx * apx + apy * apy)
    
    t = (apx * abx + apy * aby) / ab_len_sq
    t = max(0.0, min(1.0, t))
    
    cx = ax + t * abx
    cy = ay + t * aby
    
    dx = px - cx
    dy = py - cy
    return math.sqrt(dx * dx + dy * dy)

# Preprocess tectonic lines into coordinate segments in km
all_segments = []
named_segments = []

for idx, feature in enumerate(tect_data['features']):
    props = feature.get('properties', {})
    geom = feature.get('geometry', {})
    
    name = props.get('NAME')
    # Clean up name typos
    if name:
        name = name.strip()
        if name == "Momeik Faul":
            name = "Momeik Fault"
    
    code = props.get('CODE') or "N/A"
    segment_name = props.get('SEGMENT') or "N/A"
    type_descr = props.get('TYPE_DESCR') or "N/A"
    
    geom_type = geom.get('type')
    coords_list = []
    
    if geom_type == 'LineString':
        coords_list = [geom['coordinates']]
    elif geom_type == 'MultiLineString':
        coords_list = geom['coordinates']
        
    for coords in coords_list:
        proj_coords = []
        for c in coords:
            lon, lat = c[0], c[1]
            px, py = project(lon, lat)
            proj_coords.append((px, py, lon, lat))
            
        for i in range(len(proj_coords) - 1):
            p1 = proj_coords[i]
            p2 = proj_coords[i+1]
            segment_data = {
                'feature_index': idx,
                'name': name or "Unnamed Tectonic Lineament",
                'code': code,
                'segment_name': segment_name,
                'type_descr': type_descr,
                'p1_km': (p1[0], p1[1]),
                'p2_km': (p2[0], p2[1]),
                'p1_deg': (p1[2], p1[3]),
                'p2_deg': (p2[2], p2[3])
            }
            all_segments.append(segment_data)
            if name: # Only named segments
                named_segments.append(segment_data)

print(f"Prepared {len(all_segments)} total segments and {len(named_segments)} named fault segments.")

# For each earthquake, perform nearest-fault queries
analyzed_features = []
for feature in eq_data['features']:
    props = feature['properties'].copy()
    geom = feature['geometry']
    
    if geom['type'] == 'Point':
        eq_lon, eq_lat = geom['coordinates'][0], geom['coordinates'][1]
        eq_x, eq_y = project(eq_lon, eq_lat)
        
        # 1. Distance to nearest fault (overall)
        min_dist_overall = float('inf')
        nearest_overall = None
        for seg in all_segments:
            dist = point_to_segment_distance_km(
                eq_x, eq_y,
                seg['p1_km'][0], seg['p1_km'][1],
                seg['p2_km'][0], seg['p2_km'][1]
            )
            if dist < min_dist_overall:
                min_dist_overall = dist
                nearest_overall = seg
                
        # 2. Distance to nearest named fault
        min_dist_named = float('inf')
        nearest_named = None
        for seg in named_segments:
            dist = point_to_segment_distance_km(
                eq_x, eq_y,
                seg['p1_km'][0], seg['p1_km'][1],
                seg['p2_km'][0], seg['p2_km'][1]
            )
            if dist < min_dist_named:
                min_dist_named = dist
                nearest_named = seg
                
        props['Nearest_Fault_Name'] = nearest_overall['name'] if nearest_overall else "Unknown"
        props['Nearest_Fault_Code'] = nearest_overall['code'] if nearest_overall else "N/A"
        props['Nearest_Fault_Segment'] = nearest_overall['segment_name'] if nearest_overall else "N/A"
        props['Nearest_Fault_Type'] = nearest_overall['type_descr'] if nearest_overall else "N/A"
        props['Distance_to_Fault_km'] = round(min_dist_overall, 2)
        
        props['Nearest_Named_Fault_Name'] = nearest_named['name'] if nearest_named else "None"
        props['Nearest_Named_Fault_Code'] = nearest_named['code'] if nearest_named else "N/A"
        props['Nearest_Named_Fault_Segment'] = nearest_named['segment_name'] if nearest_named else "N/A"
        props['Distance_to_Named_Fault_km'] = round(min_dist_named, 2) if nearest_named else -1.0
        
        # Determine seismic classification
        mag = props['Magnitude']
        if mag < 3.0:
            mag_class = "Micro"
        elif mag < 4.0:
            mag_class = "Minor"
        elif mag < 5.0:
            mag_class = "Light"
        elif mag < 6.0:
            mag_class = "Moderate"
        else:
            mag_class = "Strong"
        props['Magnitude_Class'] = mag_class
        
        # Depth classification
        depth = props['Depth_km']
        if depth <= 30:
            depth_class = "Shallow (<30km)"
        elif depth <= 70:
            depth_class = "Intermediate (30-70km)"
        else:
            depth_class = "Deep (>70km)"
        props['Depth_Class'] = depth_class
        
        feature_copy = {
            'type': 'Feature',
            'properties': props,
            'geometry': geom
        }
        analyzed_features.append(feature_copy)

# Save back to a new geojson-like structured JSON
output_data = {
    'type': 'FeatureCollection',
    'features': analyzed_features
}

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, indent=2)

print(f"Saved {len(analyzed_features)} analyzed earthquakes to {output_file}")
