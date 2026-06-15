import json
import os

workspace_dir = r"C:\Users\Tin Ko Oo\Desktop\demo"
tectonic_file = os.path.join(workspace_dir, "Myanmar_Tectonic_Map_2011.geojson")

with open(tectonic_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

features = data['features']
total = len(features)

has_name = 0
has_code = 0
has_segment = 0
has_type = 0

names = {}
types = {}

for f in features:
    props = f.get('properties', {})
    name = props.get('NAME')
    code = props.get('CODE')
    segment = props.get('SEGMENT')
    type_descr = props.get('TYPE_DESCR')
    
    if name:
        has_name += 1
        names[name] = names.get(name, 0) + 1
    if code:
        has_code += 1
    if segment:
        has_segment += 1
    if type_descr:
        has_type += 1
        types[type_descr] = types.get(type_descr, 0) + 1

print(f"Total tectonic lineaments: {total}")
print(f"Features with NAME: {has_name} ({has_name/total*100:.1f}%)")
print(f"Features with CODE: {has_code} ({has_code/total*100:.1f}%)")
print(f"Features with SEGMENT: {has_segment} ({has_segment/total*100:.1f}%)")
print(f"Features with TYPE_DESCR: {has_type} ({has_type/total*100:.1f}%)")

print("\nNamed Faults:")
for name, cnt in sorted(names.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f"  {name}: {cnt} segments")

print("\nTectonic Types:")
for t, cnt in sorted(types.items(), key=lambda x: x[1], reverse=True):
    print(f"  {t}: {cnt} segments")
