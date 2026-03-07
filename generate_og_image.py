"""Generate og-image.png for Signova - run with: python generate_og_image.py"""
from PIL import Image, ImageDraw, ImageFont
import os, sys

W, H = 1200, 630
img = Image.new('RGB', (W, H), '#0e0e0e')
draw = ImageDraw.Draw(img)

# Draw gold glow circles (simulated)
for r in range(250, 0, -2):
    opacity_factor = r / 250
    gold_r = int(14 + (201-14) * opacity_factor * 0.08)
    gold_g = int(14 + (168-14) * opacity_factor * 0.06)
    gold_b = int(14 + (76-14) * opacity_factor * 0.03)
    draw.ellipse([W//2 - r*2, H//2 - 60 - r, W//2 + r*2, H//2 - 60 + r], fill=(gold_r, gold_g, gold_b))

# Gold logo square
logo_size = 56
logo_x, logo_y = W//2 - logo_size//2, 120
draw.rounded_rectangle([logo_x, logo_y, logo_x + logo_size, logo_y + logo_size], radius=12, fill='#c9a84c')

# Load fonts
try:
    # Try common Windows font paths
    font_paths = [
        "C:/Windows/Fonts/georgia.ttf",
        "C:/Windows/Fonts/georgiab.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    serif_bold = None
    sans = None
    for fp in font_paths:
        if os.path.exists(fp):
            if 'georgiab' in fp: serif_bold = fp
            elif 'georgia' in fp and not serif_bold: serif_bold = fp
            elif 'segoeui' in fp: sans = fp
    
    if not serif_bold: serif_bold = "C:/Windows/Fonts/timesbd.ttf"
    if not sans: sans = "C:/Windows/Fonts/arial.ttf"
    
    font_logo_s = ImageFont.truetype(serif_bold, 32)
    font_brand = ImageFont.truetype(serif_bold, 36)
    font_title = ImageFont.truetype(serif_bold, 48)
    font_sub = ImageFont.truetype(sans, 22)
    font_stats = ImageFont.truetype(sans, 18)
    font_small = ImageFont.truetype(sans, 14)
except Exception as e:
    print(f"Font error: {e}, using defaults")
    font_logo_s = font_brand = font_title = font_sub = font_stats = font_small = ImageFont.load_default()

# "S" in logo
s_bbox = draw.textbbox((0,0), "S", font=font_logo_s)
s_w, s_h = s_bbox[2] - s_bbox[0], s_bbox[3] - s_bbox[1]
draw.text((logo_x + (logo_size - s_w)//2, logo_y + (logo_size - s_h)//2 - 4), "S", fill='#0e0e0e', font=font_logo_s)

# Brand name
brand_text = "Signova"
brand_bbox = draw.textbbox((0,0), brand_text, font=font_brand)
brand_w = brand_bbox[2] - brand_bbox[0]
draw.text((W//2 - brand_w//2, 195), brand_text, fill='#f0ece4', font=font_brand)

# Main title
title = "Professional Legal Documents"
title_bbox = draw.textbbox((0,0), title, font=font_title)
title_w = title_bbox[2] - title_bbox[0]
draw.text((W//2 - title_w//2, 260), title, fill='#f0ece4', font=font_title)

title2 = "in Minutes"
title2_bbox = draw.textbbox((0,0), title2, font=font_title)
title2_w = title2_bbox[2] - title2_bbox[0]
draw.text((W//2 - title2_w//2, 320), title2, fill='#c9a84c', font=font_title)

# Subtitle
sub = "AI-powered document generator for businesses worldwide"
sub_bbox = draw.textbbox((0,0), sub, font=font_sub)
sub_w = sub_bbox[2] - sub_bbox[0]
draw.text((W//2 - sub_w//2, 400), sub, fill='#c8c4bc', font=font_sub)

# Stats bar
stats_y = 470
stats = ["27 Document Types", "~2 Min Average", "$4.99 Per Document", "180+ Countries"]
stat_widths = []
for s in stats:
    bbox = draw.textbbox((0,0), s, font=font_stats)
    stat_widths.append(bbox[2] - bbox[0])

spacing = 40
total_with_spacing = sum(stat_widths) + spacing * (len(stats) - 1)
start_x = (W - total_with_spacing) // 2

# Stats background bar
bar_pad = 20
draw.rounded_rectangle(
    [start_x - bar_pad, stats_y - 12, start_x + total_with_spacing + bar_pad, stats_y + 30],
    radius=8, fill='#1a1a1a', outline='#2a2a2a'
)

x = start_x
for i, (s, w) in enumerate(zip(stats, stat_widths)):
    draw.text((x, stats_y), s, fill='#c9a84c', font=font_stats)
    x += w
    if i < len(stats) - 1:
        draw.text((x + spacing//2 - 4, stats_y - 2), "\u00b7", fill='#3a3a3a', font=font_stats)
        x += spacing

# Bottom bar
draw.rectangle([0, H-4, W, H], fill='#c9a84c')

# Footer text
footer = "getsignova.com"
footer_bbox = draw.textbbox((0,0), footer, font=font_small)
footer_w = footer_bbox[2] - footer_bbox[0]
draw.text((W//2 - footer_w//2, 550), footer, fill='#5a5754', font=font_small)

# Save
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'og-image.png')
img.save(output_path, 'PNG', quality=95)
print(f"SUCCESS: og-image.png saved to {output_path} ({os.path.getsize(output_path)} bytes)")
