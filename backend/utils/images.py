from pathlib import Path
from uuid import uuid4
from io import BytesIO
from typing import Dict, Optional
from PIL import Image, ImageOps

from config import settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "JPG"}

def _ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)

def _open_image(data: bytes) -> Image.Image:
    img = Image.open(BytesIO(data))
    img.load()
    img = ImageOps.exif_transpose(img)
    return img

def _resize_max(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_side:
        return img
    scale = max_side / float(max(w, h))
    return img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

def save_image_bytes(
    data: bytes,
    subdir: str,
    base_name: Optional[str] = None,
    max_side: int = 1280,
    thumb_side: int = 384,
    webp_quality: int = 82
) -> Dict[str, str]:
    """
    Salva immagine in WEBP.
    Ritorna sia URL pubblici, sia path relativi/assoluti per eventuale delete.
    """
    root = Path(settings.UPLOAD_DIR).resolve()
    _ensure_dir(root)

    # Sottocartella (es. "plants/<userId>/<plantId>")
    target_dir = (root / subdir).resolve()
    _ensure_dir(target_dir)

    # Apertura & validazione
    try:
        img = _open_image(data)
    except Exception:
        raise ValueError("File non riconosciuto come immagine valida")

    fmt = (img.format or "").upper()
    if fmt == "JPG":
        fmt = "JPEG"
    img = img.convert("RGB")

    uid = base_name or uuid4().hex[:10]
    main_name = f"{uid}.webp"
    thumb_name = f"{uid}_sm.webp"

    # Main
    main_img = _resize_max(img, max_side)
    main_path = target_dir / main_name
    main_img.save(main_path, format="WEBP", quality=webp_quality, method=6)

    # Thumb
    th_img = _resize_max(img, thumb_side)
    thumb_path = target_dir / thumb_name
    th_img.save(thumb_path, format="WEBP", quality=webp_quality, method=6)

    # Percorsi relativi (rispetto alla root "/uploads")
    rel_main = f"uploads/{subdir}/{main_name}"
    rel_thumb = f"uploads/{subdir}/{thumb_name}"

    # URL pubblici
    base_url = settings.SERVER_BASE_URL.rstrip("/")
    public_main = f"{base_url}/{rel_main}"
    public_thumb = f"{base_url}/{rel_thumb}"

    return {
        "url": public_main,
        "thumbUrl": public_thumb,
        "rel": rel_main,
        "relThumb": rel_thumb,
        "abs": str(main_path),
        "absThumb": str(thumb_path),
    }