from PIL import Image
for f in ['icon_setting.png', 'music2.png', 'music.png']:
    img = Image.open(f'frontend/src/assets/icons/{f}')
    print(f'{f}: {img.size}')
