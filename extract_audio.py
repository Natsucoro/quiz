import sys
import xml.etree.ElementTree as ET
try:
    from svgpathtools import parse_path
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "svgpathtools"])
    from svgpathtools import parse_path

ET.register_namespace('', "http://www.w3.org/2000/svg")
tree = ET.parse('frontend/src/assets/icons/music.svg')
root = tree.getroot()
defs = root.find('.//{http://www.w3.org/2000/svg}defs')

def bbox(path_d):
    try:
        if not path_d: return None
        return parse_path(path_d).bbox()
    except:
        return None

speaker_paths = []
mic_paths = []

for p in root.findall('.//{http://www.w3.org/2000/svg}path'):
    d = p.attrib.get('d', '')
    b = bbox(d)
    if not b: continue
    cx, cy = (b[0]+b[1])/2, (b[2]+b[3])/2
    # Full SVG is 340x301
    if cx < 170 and cy < 150:
        speaker_paths.append(p)
    elif cx > 170 and cy < 150:
        mic_paths.append(p)

def write_svg(paths, filename):
    new_root = ET.Element('svg', xmlns="http://www.w3.org/2000/svg")
    if defs is not None:
        new_root.append(defs)
    bboxes = [bbox(p.attrib.get('d', '')) for p in paths]
    bboxes = [b for b in bboxes if b]
    min_x = min(b[0] for b in bboxes)
    max_x = max(b[1] for b in bboxes)
    min_y = min(b[2] for b in bboxes)
    max_y = max(b[3] for b in bboxes)
    w = max_x - min_x
    h = max_y - min_y
    size = max(w, h)
    cx = (min_x + max_x) / 2
    cy = (min_y + max_y) / 2
    
    padding = size * 0.15 # 15% padding
    v_size = size + padding * 2
    v_minx = cx - v_size / 2
    v_miny = cy - v_size / 2
    
    new_root.attrib['viewBox'] = f'{v_minx} {v_miny} {v_size} {v_size}'
    
    # We also need the g tag if styles are inherited, but paths here have direct classes
    for p in paths:
        new_root.append(p)
    
    ET.ElementTree(new_root).write(filename)

write_svg(speaker_paths, 'frontend/src/assets/icons/speaker_standalone.svg')
write_svg(mic_paths, 'frontend/src/assets/icons/mic_standalone.svg')
print("Extraction complete.")
