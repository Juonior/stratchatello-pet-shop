"""Scrape product cards from msk.mirhvost.ru.

Used at seed time to populate the catalog with real product names,
prices and photos. Strictly for the academic demo (РТУ МИРЭА).
"""
import concurrent.futures as cf
import logging
import re
import urllib.error
import urllib.request
from html import unescape

logger = logging.getLogger(__name__)

BASE = "https://msk.mirhvost.ru"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 zoomarket-demo"

# Our category slug → list of mirhvost listing pages to harvest from
CATEGORY_SOURCES: dict[str, list[str]] = {
    "food":        ["/catalog/sobaki/korma_dlya_sobak/sukhie_korma_dlya_sobak/",
                    "/catalog/sobaki/korma_dlya_sobak/vlazhnye_korma_dlya_sobak/"],
    "treats":      ["/catalog/sobaki/vitaminy_i_lakomstva_dlya_sobak/"],
    "toys":        ["/catalog/sobaki/aksessuary_dlya_sobak/igrushki_dlya_sobak/"],
    "accessories": ["/catalog/sobaki/aksessuary_dlya_sobak/miski_dlya_sobak/",
                    "/catalog/sobaki/aksessuary_dlya_sobak/osheyniki_i_povodki_dlya_sobak/",
                    "/catalog/sobaki/aksessuary_dlya_sobak/ruletki_dlya_sobak/",
                    "/catalog/sobaki/aksessuary_dlya_sobak/lezhanki_dlya_sobak/",
                    "/catalog/sobaki/aksessuary_dlya_sobak/perenoski_dlya_sobak/",
                    "/catalog/sobaki/aksessuary_dlya_sobak/namordniki/"],
    "clothes":     ["/catalog/sobaki/aksessuary_dlya_sobak/odezhda_dlya_sobak/"],
    "health":      ["/catalog/sobaki/aksessuary_dlya_sobak/shampuni_i_konditsionery_dlya_sobak/",
                    "/catalog/sobaki/veterinarnye_korma_dlya_sobak/",
                    "/catalog/sobaki/aksessuary_dlya_sobak/sprei_sobaki/",
                    "/catalog/sobaki/aksessuary_dlya_sobak/gigiena_i_pelenki_dlya_sobak/",
                    "/catalog/sobaki/aksessuary_dlya_sobak/gruming_dlya_sobak/"],
}


def _fetch(path: str, timeout: float = 15.0) -> str | None:
    url = path if path.startswith("http") else BASE + path
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ru"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        logger.warning("fetch failed %s: %s", url, e)
        return None


def _extract_product_links(listing_html: str, listing_path: str) -> list[str]:
    """Find unique product-page paths inside a category listing."""
    pattern = rf'href="({re.escape(listing_path)}[a-z0-9_]+/[a-z0-9_]+\.html)"'
    found = re.findall(pattern, listing_html)
    if not found:
        # Some categories don't have a subcategory level — try one-level deep
        pattern2 = rf'href="({re.escape(listing_path)}[a-z0-9_]+\.html)"'
        found = re.findall(pattern2, listing_html)
    return list(dict.fromkeys(found))


def _parse_product_page(html: str) -> dict | None:
    """Return {title, image, price, description} or None."""
    title = None
    h1 = re.search(r"<h1[^>]*>([^<]+)</h1>", html)
    if h1:
        title = unescape(h1.group(1)).strip()
    og_title = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', html)
    if not title and og_title:
        title = unescape(og_title.group(1)).split(" купить ")[0].strip()

    img = None
    og_img = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html)
    if og_img:
        img = og_img.group(1).strip()
        if img.startswith("/"):
            img = BASE + img

    price = None
    pm = re.search(r'itemprop="price"[^>]*content="(\d+(?:\.\d+)?)"', html)
    if pm:
        price = float(pm.group(1))
    if price is None:
        pm = re.search(r'"price"\s*:\s*"?(\d+(?:\.\d+)?)"?', html)
        if pm:
            price = float(pm.group(1))

    desc = None
    og_desc = re.search(r'<meta\s+property="og:description"\s+content="([^"]+)"', html)
    if og_desc:
        desc = unescape(og_desc.group(1)).strip()

    if not (title and img and price):
        return None
    return {"title": title, "image": img, "price": price, "description": desc or ""}


def _fetch_and_parse(link: str) -> dict | None:
    page = _fetch(link)
    if not page:
        return None
    data = _parse_product_page(page)
    if data:
        data["source_url"] = BASE + link
    return data


def scrape_category(slug: str, max_items: int = 10) -> list[dict]:
    """Return up to `max_items` products for a category. Parallel page fetch."""
    paths = CATEGORY_SOURCES.get(slug, [])
    candidate_links: list[str] = []
    for p in paths:
        listing = _fetch(p)
        if not listing:
            continue
        for link in _extract_product_links(listing, p):
            if link not in candidate_links:
                candidate_links.append(link)
        if len(candidate_links) >= max_items * 2:
            break

    # Take a bit more than needed to absorb parse failures
    candidates = candidate_links[: max_items * 2]
    collected: list[dict] = []
    seen_titles: set[str] = set()
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for link, data in zip(candidates, ex.map(_fetch_and_parse, candidates)):
            if not data:
                continue
            t = data["title"].strip().lower()
            if t in seen_titles:
                continue
            seen_titles.add(t)
            collected.append(data)
            if len(collected) >= max_items:
                break
    return collected


def scrape_all(per_category: int = 10) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for slug in CATEGORY_SOURCES.keys():
        items = scrape_category(slug, max_items=per_category)
        logger.info("scrape: %s -> %d products", slug, len(items))
        out[slug] = items
    return out
