import sys
import xml.etree.ElementTree as ET
try:
    from svgpathtools import parse_path
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "svgpathtools"])
    from svgpathtools import parse_path

tree = ET.parse('frontend/src/assets/icons/gear.svg')
root = tree.getroot()
paths = []
for p in root.findall('.//{http://www.w3.org/2000/svg}path'):
    d = p.attrib.get('d')
    if d:
        paths.append(parse_path(d))

bboxes = [p.bbox() for p in paths if p]
# bbox returns (xmin, xmax, ymin, ymax)
min_x = min(b[0] for b in bboxes)
max_x = max(b[1] for b in bboxes)
min_y = min(b[2] for b in bboxes)
max_y = max(b[3] for b in bboxes)

print("CX:", (min_x + max_x) / 2)
print("CY:", (min_y + max_y) / 2)
print("W:", max_x - min_x)
print("H:", max_y - min_y)
