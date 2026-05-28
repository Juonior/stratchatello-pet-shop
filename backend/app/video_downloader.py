"""Download a video from a public URL (TikTok, YouTube, Instagram, etc.) via yt-dlp."""
import logging
import os
import tempfile
from typing import Optional

import yt_dlp

logger = logging.getLogger(__name__)

# 40 MB cap — bigger files would chew through our limited VPS disk
MAX_FILESIZE = 40 * 1024 * 1024


class VideoTooLarge(Exception):
    pass


class VideoFetchError(Exception):
    pass


def fetch_video(url: str) -> tuple[bytes, str]:
    """Return (raw_bytes, content_type). Raises on failure."""
    with tempfile.TemporaryDirectory() as tmp:
        outtmpl = os.path.join(tmp, "%(id)s.%(ext)s")
        ydl_opts = {
            "outtmpl": outtmpl,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "max_filesize": MAX_FILESIZE,
            # Prefer single-file mp4 to avoid ffmpeg merging (still works if installed)
            "format": "best[ext=mp4][filesize<40M]/best[ext=mp4]/best",
            "merge_output_format": "mp4",
            "http_headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                # yt-dlp may have remuxed to .mp4 — adjust
                base, ext = os.path.splitext(filename)
                if not os.path.exists(filename):
                    for cand in (base + ".mp4", base + ".webm", base + ".mkv"):
                        if os.path.exists(cand):
                            filename = cand
                            break
        except yt_dlp.DownloadError as e:
            msg = str(e)
            if "File is larger than max-filesize" in msg or "max-filesize" in msg.lower():
                raise VideoTooLarge("Видео больше 40 МБ — мы такие не храним") from e
            logger.warning("yt-dlp failed for %s: %s", url, e)
            raise VideoFetchError("Не удалось скачать видео по этой ссылке") from e
        except Exception as e:
            logger.exception("Unexpected fetch error for %s: %s", url, e)
            raise VideoFetchError("Не удалось скачать видео по этой ссылке") from e

        if not os.path.exists(filename):
            raise VideoFetchError("Видео не найдено после скачивания")

        size = os.path.getsize(filename)
        if size > MAX_FILESIZE:
            raise VideoTooLarge("Видео больше 40 МБ")

        with open(filename, "rb") as f:
            data = f.read()

        ext_lower = os.path.splitext(filename)[1].lower()
        content_type = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mkv": "video/x-matroska",
            ".mov": "video/quicktime",
        }.get(ext_lower, "video/mp4")
        return data, content_type
