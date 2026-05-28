"""MinIO / S3-compatible storage client."""
import io
import logging
import mimetypes
import urllib.error
import urllib.request
from typing import Optional
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from PIL import Image, UnidentifiedImageError

from .config import settings

logger = logging.getLogger(__name__)

_client = None


def get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
    return _client


def public_url(key: str) -> str:
    """Build a browser-accessible URL for an object."""
    base = settings.s3_public_url.rstrip("/")
    return f"{base}/{settings.s3_bucket}/{key.lstrip('/')}"


def exists(key: str) -> bool:
    try:
        get_client().head_object(Bucket=settings.s3_bucket, Key=key)
        return True
    except ClientError:
        return False


def upload_bytes(
    key: str,
    data: bytes,
    content_type: Optional[str] = None,
) -> str:
    if not content_type:
        content_type, _ = mimetypes.guess_type(key)
        content_type = content_type or "application/octet-stream"
    get_client().put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )
    return public_url(key)


def _process_image(raw: bytes, max_side: int = 1000) -> tuple[bytes, str]:
    """Open image, convert to RGB JPEG, downscale if huge. Returns (bytes, content_type)."""
    img = Image.open(io.BytesIO(raw))
    if img.mode in ("RGBA", "P", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.convert("RGBA").split()[-1] if img.mode != "P" else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")
    if max(img.size) > max_side:
        ratio = max_side / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85, optimize=True, progressive=True)
    return out.getvalue(), "image/jpeg"


def upload_image_bytes(key: str, raw: bytes, max_side: int = 1000) -> str:
    """Validate + normalize + upload an image. Raises ValueError on bad input."""
    try:
        processed, ct = _process_image(raw, max_side=max_side)
    except UnidentifiedImageError as e:
        raise ValueError("Файл не является изображением") from e
    # Ensure key ends with .jpg
    if "." in key.split("/")[-1]:
        key = key.rsplit(".", 1)[0] + ".jpg"
    else:
        key = key + ".jpg"
    return upload_bytes(key, processed, ct)


def fetch_url(url: str, timeout: float = 15.0, max_bytes: int = 8 * 1024 * 1024) -> Optional[bytes]:
    """Download bytes from an external URL with size cap. Returns None on failure."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "zoomarket-seed/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(max_bytes + 1)
            if len(data) > max_bytes:
                logger.warning("Image too large: %s", url)
                return None
            return data
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        logger.warning("Image download failed %s: %s", url, e)
        return None
