from pathlib import Path

from PIL import Image


PROJECT = Path("/home/ubuntu/script_voice_recorder")
SOURCE = Path("/home/ubuntu/webdev-static-assets/script_voice_recorder_icon.png")
TARGETS = [
    PROJECT / "assets/images/icon.png",
    PROJECT / "assets/images/splash-icon.png",
    PROJECT / "assets/images/favicon.png",
    PROJECT / "assets/images/android-icon-foreground.png",
]

image = Image.open(SOURCE).convert("RGB")
image.thumbnail((768, 768), Image.Resampling.LANCZOS)
for target in TARGETS:
    image.save(target, "PNG", optimize=True, compress_level=9)
    print(f"{target.name}: {target.stat().st_size} bytes")
