#!/usr/bin/env python3
"""
墨渊求生 Inkfield — AI Art Asset Generation Pipeline
Uses OpenRouter API (FLUX.2-Pro / Gemini) to generate all game art.
"""
import os, sys, json, base64, time, requests
from pathlib import Path

# ─── Config ──────────────────────────────────────────────────────────────────
API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
if not API_KEY:
    # Try loading from known .env files
    for envpath in [
        Path.home() / "root/code-ai/Daimon/web/.env.local",
        Path.home() / "root/code-ai/CaptainCast/.env",
    ]:
        if envpath.exists():
            for line in envpath.read_text().splitlines():
                if line.startswith("OPENROUTER_API_KEY="):
                    API_KEY = line.split("=", 1)[1].strip()
                    break
        if API_KEY:
            break

if not API_KEY:
    print("ERROR: No OpenRouter API key found. Set OPENROUTER_API_KEY env var.")
    sys.exit(1)

print(f"✓ API key loaded ({len(API_KEY)} chars)")

BASE_URL = "https://openrouter.ai/api/v1"
OUT_DIR = Path(__file__).parent.parent / "public" / "assets"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Gemini Flash Image works with OpenRouter modalities API
IMAGE_MODEL = "google/gemini-2.5-flash-image"
FALLBACK_MODEL = "google/gemini-2.5-flash-image"

# ─── Generation function ─────────────────────────────────────────────────────
def generate_image(prompt: str, output_path: Path, model: str = IMAGE_MODEL, retries: int = 2) -> bool:
    """Generate an image via OpenRouter and save to disk."""
    if output_path.exists():
        print(f"  ✓ Already exists: {output_path.name}")
        return True

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://inkfield.joyboy.games",
        "X-Title": "Inkfield",
    }

    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image", "text"],
    }

    for attempt in range(retries + 1):
        try:
            print(f"  → Generating {output_path.name} (attempt {attempt+1})...")
            resp = requests.post(f"{BASE_URL}/chat/completions", headers=headers, json=body, timeout=120)

            if resp.status_code == 429:
                wait = 10 * (attempt + 1)
                print(f"  ⏳ Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue

            if resp.status_code != 200:
                print(f"  ✗ HTTP {resp.status_code}: {resp.text[:200]}")
                # Try fallback model
                if model != FALLBACK_MODEL:
                    print(f"  → Trying fallback model: {FALLBACK_MODEL}")
                    return generate_image(prompt, output_path, model=FALLBACK_MODEL, retries=retries)
                continue

            data = resp.json()
            # Extract image from response
            choices = data.get("choices", [])
            if not choices:
                print(f"  ✗ No choices in response")
                continue

            message = choices[0].get("message", {})

            # Gemini returns images in message.images array
            image_data = None
            images = message.get("images", [])
            if images:
                url = images[0].get("image_url", {}).get("url", "")
                if url.startswith("data:image"):
                    image_data = base64.b64decode(url.split(",", 1)[1])
                elif url.startswith("http"):
                    img_resp = requests.get(url, timeout=60)
                    if img_resp.status_code == 200:
                        image_data = img_resp.content

            # Fallback: check content field
            if not image_data:
                content = message.get("content", "")
                if isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "image_url":
                            url = part.get("image_url", {}).get("url", "")
                            if url.startswith("data:image"):
                                image_data = base64.b64decode(url.split(",", 1)[1])
                elif isinstance(content, str):
                    import re
                    b64_match = re.search(r'data:image/[^;]+;base64,([A-Za-z0-9+/=]+)', content)
                    if b64_match:
                        image_data = base64.b64decode(b64_match.group(1))

            if image_data:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                # Post-process: optimize for web
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(image_data))
                # Compress to reasonable web size (max 512px for sprites, 1024 for bg)
                max_dim = 1024 if "bg/" in str(output_path) or "sky" in str(output_path) else 512
                if max(img.width, img.height) > max_dim:
                    ratio = max_dim / max(img.width, img.height)
                    img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
                # Save as optimized PNG
                buf = io.BytesIO()
                img.save(buf, format="PNG", optimize=True)
                output_path.write_bytes(buf.getvalue())
                size_kb = buf.tell() / 1024
                print(f"  ✓ Saved: {output_path.name} ({img.width}x{img.height}, {size_kb:.0f}KB)")
                return True
            else:
                print(f"  ✗ No image data found in response")
                print(f"    Response keys: {list(data.keys())}")
                if choices:
                    print(f"    Message content type: {type(content).__name__}")
                    if isinstance(content, str):
                        print(f"    Content preview: {content[:200]}")
                    elif isinstance(content, list):
                        print(f"    Parts: {[p.get('type','?') if isinstance(p,dict) else type(p).__name__ for p in content]}")

        except Exception as e:
            print(f"  ✗ Error: {e}")
            if attempt < retries:
                time.sleep(3)

    return False

# ─── Asset Definitions ────────────────────────────────────────────────────────
# Each asset: (filename, prompt, subfolder)

STYLE_PREFIX = "Chinese ink wash painting (水墨画) style, splashing ink art, dramatic brushstrokes, on rice paper texture"
GAME_PREFIX = "top-down 2D game asset, clean edges, high contrast"
CHAR_PREFIX = "cute chibi 3-head-tall character, thick ink brush outline, transparent background, centered"
ENEMY_PREFIX = "top-down view game enemy sprite, dark menacing, glitch aesthetic, thick ink outline, transparent background"

ASSETS = [
    # ── Backgrounds ──
    ("bg/ground_01.png",
     f"{STYLE_PREFIX}, {GAME_PREFIX}, wasteland ground texture tile, cracked earth with faint glowing purple veins beneath the surface, scattered debris and ancient ruins fragments, muted earth tones with hints of cyan neon glow, seamless tileable texture, overhead view"),

    ("bg/ground_02.png",
     f"{STYLE_PREFIX}, {GAME_PREFIX}, dark forest floor texture tile, dead leaves and twisted roots, faint bioluminescent mushrooms casting purple light, ink wash dark greens and blacks, seamless tileable, overhead view"),

    ("bg/wall_stone.png",
     f"{STYLE_PREFIX}, {GAME_PREFIX}, ruined stone wall segment, ancient Chinese architecture mixed with cyberpunk tech, exposed wiring and glowing circuits in cracked stone, ink brush texture, top-down view, 256x64 pixels"),

    ("bg/sky_mountains.png",
     f"{STYLE_PREFIX}, panoramic mountain landscape background, misty peaks in distance fading into fog, traditional Chinese shanshui (山水) composition, layered mountain silhouettes from dark foreground to pale background, purple-gold dusk sky with subtle tech grid pattern overlay, dramatic ink wash clouds, 1200x400 pixels, wide format"),

    # ── Characters ──
    ("chars/taotie_sheet.png",
     f"{STYLE_PREFIX}, {CHAR_PREFIX}, game character sprite sheet of Taotie (饕餮) - a round cute mythical beast, brown fur with golden belly, two small curved horns, HUGE mouth with sharp teeth (signature feature), big expressive eyes, carrying a sci-fi repair tool. Show 4 poses in a row: front view idle, side view walking, back view, action pose shooting. Each pose 128x128 pixels, 4 columns 1 row, 512x128 total"),

    ("chars/qiongqi_sheet.png",
     f"{STYLE_PREFIX}, {CHAR_PREFIX}, game character sprite sheet of Qiongqi (穷奇) - a winged tiger-like beast, gray-blue fur, large feathered wings, fierce but cute expression, wearing a tattered work vest. Show 4 poses in a row: front idle, side walking, back view, flying pose. Each 128x128, 4 columns, 512x128 total"),

    ("chars/baize_sheet.png",
     f"{STYLE_PREFIX}, {CHAR_PREFIX}, game character sprite sheet of Bai Ze (白泽) - a white scholarly mythical beast, elegant white fur, single horn on forehead, wearing round glasses and a lab coat, carrying a glowing data tablet. Show 4 poses: front idle, side walk, back, scanning pose. Each 128x128, 512x128 total"),

    ("chars/hundun_sheet.png",
     f"{STYLE_PREFIX}, {CHAR_PREFIX}, game character sprite sheet of Hundun (混沌) - a perfectly round faceless golden-yellow blob creature, NO face, NO eyes, NO mouth, smooth egg-like surface, slightly translucent and glowing. Show 4 poses: idle (floating), tilting curiously, dancing pose with one side raised, spinning. Each 128x128, 512x128 total. This creature has ABSOLUTELY NO facial features - it is a smooth round ball."),

    # ── Enemies ──
    ("enemies/logic_soldier.png",
     f"{STYLE_PREFIX}, {ENEMY_PREFIX}, Logic Soldier - a corrupted digital entity that looks like a broken code block with legs, square body made of fragmented data, glowing green scan lines across its surface, glitch artifacts around edges, two red pixel eyes. 128x128 single sprite, dark green and black with neon green accents"),

    ("enemies/algo_hunter.png",
     f"{STYLE_PREFIX}, {ENEMY_PREFIX}, Algorithm Hunter - a triangular predatory entity, sharp angular body like a search algorithm visualization, multiple tracking tendrils extending from body, single large purple glowing eye, fast and dangerous looking. 128x128 single sprite, dark purple with magenta neon accents"),

    ("enemies/protocol_enforcer.png",
     f"{STYLE_PREFIX}, {ENEMY_PREFIX}, Protocol Enforcer - a massive armored circular entity, heavy plated body with ancient Chinese bronze patterns mixed with circuit board traces, golden cross symbol on center, imposing and tank-like. 128x128 single sprite, dark bronze and gold with orange accents"),

    ("enemies/harvester_drone.png",
     f"{STYLE_PREFIX}, {ENEMY_PREFIX}, Harvester Drone - a floating geometric entity from a higher dimension, impossible geometry like an Escher drawing, surface covered in flowing golden runes and symbols, emanates golden light, terrifying and otherworldly. 128x128 single sprite, black with gold geometric patterns"),

    # ── UI Elements ──
    ("ui/work_badge_frame.png",
     f"{STYLE_PREFIX}, game UI element, employee work badge / ID card frame, Chinese corporate style mixed with sci-fi, ornate ink brush border with subtle circuit patterns, top banner reads '灵机运维公司', space for portrait and text, dark background with gold trim, 200x80 pixels, transparent background"),

    ("ui/lingji_meter_bg.png",
     f"{STYLE_PREFIX}, game UI element, horizontal energy meter / progress bar background, ink brush stroke shape, rough brush edges, ornate Chinese pattern borders, gold and dark ink colors, 300x30 pixels, transparent background"),

    ("ui/loot_icons.png",
     f"{STYLE_PREFIX}, game UI sprite sheet, 5 small item icons in a row: toolbox (工具箱), drawer (抽屉), safe (保险柜), trash bin (废品箱), spirit crystal (灵矿). Each icon 48x48 pixels, ink brush style, glowing highlights, transparent background, 240x48 total"),

    # ── Effects ──
    ("fx/ink_splatter_01.png",
     f"Black ink splatter on white background, realistic Chinese calligraphy ink splash, dynamic splashing pattern with droplets and streaks, high contrast, isolated on pure white background, 256x256 pixels"),

    ("fx/ink_splatter_02.png",
     f"Dark purple-black ink splatter on white background, Chinese ink wash splash pattern, asymmetric with finger-like extensions, scattered droplets, high contrast, isolated on pure white, 256x256"),

    ("fx/ink_splatter_03.png",
     f"Gold and black ink splatter on white background, mixing of metallic gold ink with traditional black Chinese ink, dramatic splash pattern, high contrast, isolated on pure white, 256x256"),

    ("fx/muzzle_flash.png",
     f"{STYLE_PREFIX}, game effect sprite, muzzle flash in ink wash style, burst of ink droplets and brush stroke energy radiating outward, mix of black ink and golden sparks, transparent background, 64x64 pixels"),

    ("fx/bullet_trail.png",
     f"{STYLE_PREFIX}, game effect, bullet trail in ink brush stroke style, horizontal streak of flowing ink with calligraphy brush energy, fading at the end, black with faint purple glow, transparent background, 64x16 pixels"),
]

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("墨渊求生 Inkfield — AI Art Asset Pipeline")
    print(f"Model: {IMAGE_MODEL} (fallback: {FALLBACK_MODEL})")
    print(f"Output: {OUT_DIR}")
    print(f"Assets to generate: {len(ASSETS)}")
    print("=" * 60)

    success = 0
    failed = 0

    for filename, prompt, *_ in ASSETS:
        output_path = OUT_DIR / filename
        print(f"\n[{success + failed + 1}/{len(ASSETS)}] {filename}")

        if generate_image(prompt, output_path):
            success += 1
        else:
            failed += 1

        # Rate limit respect
        time.sleep(2)

    print("\n" + "=" * 60)
    print(f"Done! {success} succeeded, {failed} failed")
    print(f"Assets at: {OUT_DIR}")
    if failed > 0:
        print(f"Re-run script to retry failed assets (existing ones will be skipped)")
    print("=" * 60)

if __name__ == "__main__":
    main()
