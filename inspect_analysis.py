import json
import os

workspace_dir = r"C:\Users\Tin Ko Oo\Desktop\demo"
analyzed_file = os.path.join(workspace_dir, "analyzed_earthquakes.json")

with open(analyzed_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

features = data['features']
total = len(features)

named_fault_distances = []
named_fault_counts = {}

for feature in features:
    props = feature['properties']
    named_fault = props['Nearest_Named_Fault_Name']
    named_dist = props['Distance_to_Named_Fault_km']
    
    if named_dist >= 0:
        named_fault_distances.append(named_dist)
        named_fault_counts[named_fault] = named_fault_counts.get(named_fault, 0) + 1

print("Named Fault Distance Summary:")
print(f"  Average Distance: {sum(named_fault_distances)/len(named_fault_distances):.2f} km")
print(f"  Minimum Distance: {min(named_fault_distances):.2f} km")
print(f"  Maximum Distance: {max(named_fault_distances):.2f} km")

print("\nNamed Fault Distribution (Closest):")
for fault, count in sorted(named_fault_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {fault}: {count} earthquakes")
