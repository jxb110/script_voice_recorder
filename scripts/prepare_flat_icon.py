from pathlib import Path

from PIL import Image

source = Path("/home/ubuntu/webdev-static-assets/script-voice-recorder-flat-ai-icon.png")
target_dir = Path("/home/ubuntu/script_voice_recorder/assets/images")
target_names = [
    "icon.png",
    "splash-icon.png",
    "favicon.png",
    "android-icon-foreground.png",
    "android-icon-background.png",
    "android-icon-monochrome.png",
]

with Image.open(source) as image:
    icon = image.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    for name in target_names:
        icon.save(target_dir / name, "PNG", optimize=True, compress_level=9)
