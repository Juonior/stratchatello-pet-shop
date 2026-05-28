"""Seed initial data: categories, products, articles. Idempotent — runs only if empty.

Product/article images are fetched once from Openverse, then cached in MinIO (S3)
so the running app has zero external image dependencies.
"""
import json
import logging
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4
from cassandra.cluster import Session

from . import s3
from . import scraper

logger = logging.getLogger(__name__)


def _extract_brand(title: str) -> str | None:
    parts = re.findall(r"[A-Za-z][A-Za-z\-]*", title)
    if not parts:
        return None
    if len(parts) > 1 and parts[0].isupper() and parts[1].isupper():
        return f"{parts[0]} {parts[1]}"
    return parts[0]


def _detect_size_for(title: str) -> str:
    t = title.lower()
    if "мелк" in t or "мини" in t or "малень" in t:
        return "small"
    if "крупн" in t or "больш" in t:
        return "large"
    if "средн" in t:
        return "medium"
    return "any"


def _short_desc(title: str, full: str) -> str:
    """Build a short description; trim noisy ⭐ Гарантия... blocks."""
    txt = (full or "").strip()
    txt = re.sub(r"\s+", " ", txt)
    # Cut at common marketing markers
    for marker in ["✅", "Гарантия", "Доставк", "★", "•"]:
        i = txt.find(marker)
        if i > 60:
            txt = txt[:i].strip(" .,;-—–")
            break
    if not txt:
        txt = title
    return txt[:600]


# --- Image source: Openverse (Wikimedia, Flickr CC-licensed) ---
# We pick the first usable result whose hosting domain is known-stable.
_PREFERRED_HOSTS = (
    "live.staticflickr.com",
    "upload.wikimedia.org",
    "commons.wikimedia.org",
)


def _fetch_openverse_image(query: str, timeout: float = 10.0) -> str | None:
    """Search Openverse and return the first reasonable image URL. None on failure."""
    params = urllib.parse.urlencode({
        "q": query,
        "page_size": 12,
        "license": "cc0,by,by-sa",
        "mature": "false",
    })
    url = f"https://api.openverse.org/v1/images/?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "zoomarket-seed/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            logger.warning("Openverse rate-limited on %r, sleeping 10s", query)
            time.sleep(10)
            raise
        logger.warning("Openverse HTTP %s for %r", e.code, query)
        return None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        logger.warning("Openverse fetch failed for %r: %s", query, e)
        return None

    results = data.get("results", []) or []
    # Prefer Flickr/Wikimedia static URLs (stable, no auth)
    for r in results:
        u = r.get("url")
        if u and any(h in u for h in _PREFERRED_HOSTS):
            return u
    # Fallback: first result of any host
    for r in results:
        u = r.get("url")
        if u:
            return u
    return None


def _resolve_image(query: str, throttle_seconds: float = 3.5) -> str | None:
    """Throttled Openverse wrapper. Retries once on 429."""
    try:
        img = _fetch_openverse_image(query)
    except urllib.error.HTTPError:
        img = None
        try:
            img = _fetch_openverse_image(query)
        except urllib.error.HTTPError:
            img = None
    time.sleep(throttle_seconds)
    return img


# ---- Dog photos via dog.ceo (used for articles only) ----
def _fetch_dog_image(breed: str | None = None, timeout: float = 6.0) -> str | None:
    url = f"https://dog.ceo/api/breed/{breed}/images/random" if breed \
        else "https://dog.ceo/api/breeds/image/random"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "zoomarket-seed/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8"))
            if data.get("status") == "success":
                return data.get("message")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        logger.warning("dog.ceo failed (breed=%s): %s", breed, e)
    return None


# Map each article slug → relevant dog.ceo breed for the cover photo
ARTICLE_BREED: dict[str, str] = {
    "feeding-guide":     "labrador",
    "puppy-training":    "retriever/golden",
    "winter-care":       "husky",
    "vaccination-schedule": "beagle",
    "breed-choice":      "australian/shepherd",
    "anxiety-fireworks": "poodle/toy",
    "switching-food":    "labrador",
    "grooming":          "poodle/toy",
    "summer-heat":       "bulldog/french",
}


def _cache_dog_photo_to_s3(slug: str, breed: str | None) -> str | None:
    key = f"articles/{slug}.jpg"
    if s3.exists(key):
        return s3.public_url(key)
    src = _fetch_dog_image(breed) or _fetch_dog_image(None)
    if not src:
        return None
    raw = s3.fetch_url(src)
    if not raw:
        return None
    try:
        return s3.upload_image_bytes(key, raw, max_side=1400)
    except Exception as e:
        logger.warning("S3 upload failed for %s: %s", key, e)
        return None


def _slugify(s: str) -> str:
    """Latin slug from a string, used as S3 key suffix."""
    s = s.lower()
    # transliterate common cyrillic chars (cheap)
    table = str.maketrans({
        "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z",
        "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
        "с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"c","ч":"ch","ш":"sh","щ":"sch",
        "ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya",
    })
    s = s.translate(table)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "item"


def _cache_image_to_s3(key: str, *queries: str) -> str | None:
    """Look up an image via Openverse (tries each query in order), cache it in S3.
    Skips download if S3 already has the key.
    """
    if s3.exists(key):
        return s3.public_url(key)
    src = None
    for q in queries:
        if not q:
            continue
        src = _resolve_image(q)
        if src:
            break
    if not src:
        logger.warning("No image found for queries=%s (key=%s)", queries, key)
        return None
    raw = s3.fetch_url(src)
    if not raw:
        return None
    try:
        return s3.upload_image_bytes(key, raw)
    except Exception as e:
        logger.warning("S3 upload failed for %s: %s", key, e)
        return None


# Generic per-category fallback queries
_CATEGORY_FALLBACK_QUERY = {
    "food": "dog food",
    "treats": "dog treats",
    "toys": "dog toy",
    "accessories": "dog leash",
    "clothes": "dog coat",
    "health": "veterinary",
}


CATEGORIES = [
    {"slug": "food", "title": "Корма", "icon": "🍖",
     "description": "Сухие, влажные и лечебные корма для собак всех пород и возрастов",
     "sort_order": 1},
    {"slug": "treats", "title": "Лакомства", "icon": "🦴",
     "description": "Натуральные и тренировочные лакомства для дрессировки",
     "sort_order": 2},
    {"slug": "toys", "title": "Игрушки", "icon": "🎾",
     "description": "Жевательные, интерактивные и пищалки",
     "sort_order": 3},
    {"slug": "accessories", "title": "Аксессуары", "icon": "🎀",
     "description": "Ошейники, поводки, шлейки, миски и переноски",
     "sort_order": 4},
    {"slug": "clothes", "title": "Одежда", "icon": "🧥",
     "description": "Комбинезоны, дождевики и тёплая одежда для прогулок",
     "sort_order": 5},
    {"slug": "health", "title": "Здоровье", "icon": "💊",
     "description": "Витамины, средства от паразитов и уход",
     "sort_order": 6},
]


def _slug_to_emoji_image(slug: str, emoji: str) -> str:
    # Build a simple SVG data-URI with emoji over gradient — works without external CDN
    bg1 = {
        "food": ("#fde68a", "#fb923c"),
        "treats": ("#fecaca", "#f97316"),
        "toys": ("#bae6fd", "#0ea5e9"),
        "accessories": ("#fbcfe8", "#ec4899"),
        "clothes": ("#ddd6fe", "#8b5cf6"),
        "health": ("#bbf7d0", "#10b981"),
    }.get(slug, ("#fde68a", "#fb923c"))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="{bg1[0]}"/><stop offset="100%" stop-color="{bg1[1]}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="50%" y="55%" font-size="180" text-anchor="middle" dominant-baseline="middle">{emoji}</text></svg>'''
    import base64
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")


PRODUCTS = [
    # food
    {"cat": "food", "title": "Royal Canin Adult Medium", "brand": "Royal Canin",
     "price": 4290, "old_price": 4990, "rating": 4.8, "rating_count": 312,
     "emoji": "🥩", "size_for": "medium", "tags": ["сухой", "premium"],
     "img_q": "dog food kibble bowl",
     "description": "Полнорационный корм для собак средних пород от 12 месяцев. Поддерживает здоровье костей, суставов и идеальный вес.",
     "composition": "Дегидратированный белок птицы, рис, кукуруза, животные жиры, минеральные вещества, рыбий жир",
     "instruction": "10 кг — 174 г/день. Разделить на 2 кормления. Свежая вода в свободном доступе."},
    {"cat": "food", "title": "Hill's Science Plan Puppy", "brand": "Hill's",
     "price": 3590, "old_price": None, "rating": 4.7, "rating_count": 204,
     "emoji": "🍗", "size_for": "small", "tags": ["щенки", "premium"],
     "img_q": "puppy dog food bag",
     "description": "Корм для щенков мелких пород с курицей. Поддержка иммунитета и развития мозга.",
     "composition": "Курица, рис, кукуруза, льняное семя, рыбий жир, минералы",
     "instruction": "По таблице на упаковке в зависимости от веса щенка."},
    {"cat": "food", "title": "Acana Wild Prairie", "brand": "Acana",
     "price": 5890, "old_price": 6490, "rating": 4.9, "rating_count": 411,
     "emoji": "🦃", "size_for": "large", "tags": ["сухой", "беззерновой"],
     "img_q": "premium dog food kibble",
     "description": "Беззерновой корм с цыплёнком, индейкой и форелью. 60% мяса, без злаков.",
     "composition": "Свежий цыплёнок, индейка, форель, чечевица, горох, водоросли",
     "instruction": "До 25 кг — 220 г/день. От 25 кг — 320 г/день."},
    {"cat": "food", "title": "Pedigree влажный 'Говядина'", "brand": "Pedigree",
     "price": 89, "old_price": None, "rating": 4.3, "rating_count": 1287,
     "emoji": "🥫", "size_for": "any", "tags": ["влажный"],
     "img_q": "wet dog food can pouch",
     "description": "Влажный корм-пауч с говядиной в желе для взрослых собак.",
     "composition": "Мясо и субпродукты (в том числе говядина 4%), злаки, желирующие вещества",
     "instruction": "Взрослой собаке 10 кг — 3 пакета в день."},

    # treats
    {"cat": "treats", "title": "Жевательные косточки с курицей", "brand": "Titbit",
     "price": 290, "old_price": None, "rating": 4.6, "rating_count": 522,
     "emoji": "🦴", "size_for": "any", "tags": ["натуральное"],
     "img_q": "dog chew bone treat",
     "description": "Натуральные сушёные косточки с куриной грудкой. Для чистки зубов и укрепления челюстей.",
     "composition": "Куриная грудка 70%, говяжья кость",
     "instruction": "До 2 шт в день. Не давать щенкам до 6 месяцев."},
    {"cat": "treats", "title": "Тренировочные мини-снеки", "brand": "TrainMe",
     "price": 320, "old_price": 380, "rating": 4.8, "rating_count": 833,
     "emoji": "🥨", "size_for": "any", "tags": ["дрессировка"],
     "img_q": "dog training treats biscuits",
     "description": "Мягкие мини-кусочки с лососем. Идеальны для дрессировки и поощрения.",
     "composition": "Лосось, рис, глицерин",
     "instruction": "До 30 шт в день для собак до 10 кг."},
    {"cat": "treats", "title": "Оленьи рога натуральные", "brand": "WildChew",
     "price": 690, "old_price": None, "rating": 4.9, "rating_count": 144,
     "emoji": "🦌", "size_for": "large", "tags": ["долгоиграющее"],
     "img_q": "antler dog chew",
     "description": "Натуральный рог северного оленя. Очищает зубы, занимает на несколько недель.",
     "composition": "100% натуральный рог",
     "instruction": "Для собак с крепкими зубами. Под присмотром хозяина."},

    # toys
    {"cat": "toys", "title": "Канат-узел с пищалкой", "brand": "PlayBone",
     "price": 450, "old_price": None, "rating": 4.5, "rating_count": 290,
     "emoji": "🪢", "size_for": "medium", "tags": ["перетягивание"],
     "img_q": "rope dog toy",
     "description": "Прочный канат с пищалкой внутри. Игра в перетягивание и развитие челюстей.",
     "composition": "Хлопок, полиэстер",
     "instruction": "Стирка вручную. Не для одиночной игры."},
    {"cat": "toys", "title": "Мяч KONG Classic", "brand": "KONG",
     "price": 990, "old_price": 1190, "rating": 4.9, "rating_count": 1654,
     "emoji": "🎾", "size_for": "any", "tags": ["прочное", "интерактивное"],
     "img_q": "rubber dog ball toy",
     "description": "Легендарный мяч KONG. Прыгает, плавает, можно набивать лакомствами.",
     "composition": "Натуральный каучук",
     "instruction": "Подберите размер по весу питомца."},
    {"cat": "toys", "title": "Уточка-пищалка плюшевая", "brand": "Soft&Squeak",
     "price": 350, "old_price": None, "rating": 4.4, "rating_count": 411,
     "emoji": "🦆", "size_for": "small", "tags": ["мягкое"],
     "img_q": "plush dog toy squeaky",
     "description": "Мягкая плюшевая уточка с пищалкой. Любимая игрушка маленьких пород.",
     "composition": "Плюш, полиэстер, силиконовая пищалка",
     "instruction": "Не оставляйте с агрессивными жевателями."},

    # accessories
    {"cat": "accessories", "title": "Шлейка нейлоновая Reflective", "brand": "WalkMate",
     "price": 1290, "old_price": 1590, "rating": 4.7, "rating_count": 312,
     "emoji": "🎒", "size_for": "medium", "tags": ["отражающая"],
     "img_q": "dog harness vest",
     "description": "Шлейка со светоотражающими полосами. Регулируется по объёму груди.",
     "composition": "Нейлон, металлические пряжки",
     "instruction": "Подберите размер по обхвату груди."},
    {"cat": "accessories", "title": "Поводок-рулетка 5м", "brand": "FlexiLine",
     "price": 1490, "old_price": None, "rating": 4.6, "rating_count": 240,
     "emoji": "🪢", "size_for": "medium", "tags": ["рулетка"],
     "img_q": "dog leash retractable",
     "description": "Поводок-рулетка с лентой 5 метров. Кнопка стопора и плавный возврат.",
     "composition": "Пластик ABS, нейлоновая лента",
     "instruction": "До 25 кг."},
    {"cat": "accessories", "title": "Миска двойная на подставке", "brand": "DogDine",
     "price": 890, "old_price": None, "rating": 4.5, "rating_count": 175,
     "emoji": "🥣", "size_for": "any", "tags": ["миска"],
     "img_q": "dog food bowl ceramic",
     "description": "Двойная керамическая миска на бамбуковой подставке. Гигиенично и стильно.",
     "composition": "Керамика, бамбук",
     "instruction": "Можно мыть в посудомоечной машине."},

    # clothes
    {"cat": "clothes", "title": "Дождевик с капюшоном", "brand": "RainPaw",
     "price": 1690, "old_price": 1990, "rating": 4.5, "rating_count": 188,
     "emoji": "🧥", "size_for": "medium", "tags": ["непромокаемое"],
     "img_q": "dog raincoat jacket",
     "description": "Лёгкий дождевик с капюшоном и светоотражающими швами. Защита от дождя и грязи.",
     "composition": "Полиэстер с PU-покрытием",
     "instruction": "Стирка при 30°C, без отжима."},
    {"cat": "clothes", "title": "Зимний комбинезон с мехом", "brand": "WinterDog",
     "price": 3490, "old_price": 3990, "rating": 4.8, "rating_count": 144,
     "emoji": "🥶", "size_for": "small", "tags": ["зима"],
     "img_q": "dog winter coat snow",
     "description": "Тёплый комбинезон с искусственным мехом. Для прогулок при -20°C.",
     "composition": "Полиэстер, искусственный мех, флис",
     "instruction": "Деликатная стирка."},
    {"cat": "clothes", "title": "Свитер в полоску", "brand": "DogKnit",
     "price": 990, "old_price": None, "rating": 4.4, "rating_count": 91,
     "emoji": "🧶", "size_for": "small", "tags": ["вязаное"],
     "img_q": "dog sweater knit",
     "description": "Уютный вязаный свитер. Для домашних прогулок и сна.",
     "composition": "Акрил, шерсть",
     "instruction": "Ручная стирка."},

    # health
    {"cat": "health", "title": "Капли от блох и клещей", "brand": "Bravecto",
     "price": 1890, "old_price": None, "rating": 4.9, "rating_count": 532,
     "emoji": "💧", "size_for": "any", "tags": ["паразиты"],
     "img_q": "pet medicine drops bottle",
     "description": "Капли на холку. Защита на 12 недель от блох, клещей и власоедов.",
     "composition": "Флураланер 280 мг/мл",
     "instruction": "Применять 1 раз в 12 недель. По весу."},
    {"cat": "health", "title": "Витамины для шерсти Omega-3", "brand": "VetCare",
     "price": 1290, "old_price": 1490, "rating": 4.6, "rating_count": 312,
     "emoji": "✨", "size_for": "any", "tags": ["витамины"],
     "img_q": "fish oil capsules supplement",
     "description": "Комплекс с омега-3 и биотином. Здоровье шерсти и кожи.",
     "composition": "Рыбий жир, витамин Е, биотин, цинк",
     "instruction": "1 капсула в день с едой."},
    {"cat": "health", "title": "Шампунь гипоаллергенный", "brand": "ZooSpa",
     "price": 590, "old_price": None, "rating": 4.5, "rating_count": 220,
     "emoji": "🧴", "size_for": "any", "tags": ["груминг"],
     "img_q": "dog shampoo bottle bath",
     "description": "Мягкий гипоаллергенный шампунь без сульфатов. Для чувствительной кожи.",
     "composition": "Кокосовое ПАВ, алоэ, овсяная мука, пантенол",
     "instruction": "Намылить, выдержать 2 мин, смыть."},
]


ARTICLES = [
    {"slug": "feeding-guide", "topic": "Питание",
     "title": "Как правильно подобрать корм собаке: полный гайд",
     "annotation": "Размер, возраст, активность и аллергии — разбираем по полочкам, как не ошибиться с кормом.",
     "image_emoji": "🍖",
     "img_q": "dog eating bowl food",
     "author": "Ветеринар Анна Соколова",
     "body": "Выбор корма — это первое, с чем сталкивается каждый владелец собаки. Главное правило — соответствие корма размеру и возрасту питомца. Маленьким породам нужны более калорийные корма с мелкими гранулами, крупным — с глюкозамином для суставов. Щенкам — с повышенным содержанием белка и DHA. Взрослым — баланс. Пожилым — пониженная калорийность и поддержка почек. Никогда не смешивайте корма разных производителей: это нарушает баланс нутриентов и приводит к расстройствам ЖКТ. Переход на новый корм всегда делайте плавно — за 7 дней, постепенно увеличивая долю нового и уменьшая долю старого. Если собака чешется, появилась перхоть или слезятся глаза — возможна пищевая аллергия. В этом случае попробуйте монобелковый корм с одним источником протеина (ягнёнок, утка, лосось) и без курицы и злаков."},
    {"slug": "puppy-training", "topic": "Дрессировка",
     "title": "Первые 30 дней со щенком: чек-лист",
     "annotation": "Социализация, базовые команды и приучение к туалету — план действий с первого дня дома.",
     "image_emoji": "🐶",
     "img_q": "puppy training sit",
     "author": "Кинолог Иван Петров",
     "body": "Первый месяц щенка дома — самый важный. С первых дней приучайте к режиму: одно и то же время кормления, прогулок и сна. Кличку повторяйте 50–100 раз в день в позитивном контексте. Команды 'ко мне' и 'сидеть' начинайте на 5–7 день после адаптации. Используйте лакомства, голос и игру как поощрение — никогда не наказывайте физически. Социализация критична до 16 недель: показывайте щенку других собак (привитых!), людей, машины, лестницы, разные поверхности. Это формирует психику. К туалету приучайте через постоянство: после еды, сна и игры выносите на улицу или относите на пелёнку. Хвалите бурно за правильное место. Никогда не тыкайте носом — это формирует невроз."},
    {"slug": "winter-care", "topic": "Уход",
     "title": "Как защитить лапы собаки зимой",
     "annotation": "Реагенты, обморожение, треснувшие подушечки — что делать и чем мазать.",
     "image_emoji": "❄️",
     "img_q": "dog winter snow",
     "author": "Грумер Елена Краснова",
     "body": "Зимние реагенты — главный враг собачьих лап. Соль и химия буквально разъедают подушечки. Перед прогулкой наносите защитный воск (есть готовые от Mushers Secret, 4 Paws). После прогулки обязательно мойте лапы тёплой водой и насухо вытирайте — особенно между пальцами. Если кожа треснула — обработайте Бепантеном или мазью на основе календулы. При длительных прогулках в сильный мороз надевайте обувь — да, многие собаки сначала её ненавидят, но привыкают за неделю. Признаки обморожения: лапы холодные, бледные, собака поджимает их. В этом случае согревайте постепенно (не горячей водой!), и сразу к ветеринару."},
    {"slug": "vaccination-schedule", "topic": "Здоровье",
     "title": "Календарь прививок для собак",
     "annotation": "Когда, какие и зачем — от 8 недель до пожилого возраста.",
     "image_emoji": "💉",
     "img_q": "veterinarian dog vaccine",
     "author": "Ветеринар Анна Соколова",
     "body": "Первая прививка щенку делается в 8–9 недель — комплексная против чумы плотоядных, парвовируса, аденовируса и парагриппа (DHPP). Ревакцинация через 3–4 недели. В 12 недель — добавляется бешенство (по закону РФ обязательна). Дальше — ежегодная ревакцинация в течение всей жизни. Перед каждой прививкой за 10–14 дней — обработка от глистов. После прививки 10 дней нельзя купать, переохлаждаться и сильно нагружать. Бешенство — единственная прививка, без отметки о которой собаку не пустят в поезд, самолёт и за границу."},
    {"slug": "breed-choice", "topic": "Породы",
     "title": "Как выбрать породу под образ жизни",
     "annotation": "Квартира, дети, активность, аллергии — подбираем подходящую породу.",
     "image_emoji": "🐕",
     "img_q": "different dog breeds group",
     "author": "Кинолог Иван Петров",
     "body": "Главное при выборе породы — честно оценить свой ритм жизни. Хаски, маламут, бордер-колли требуют 2–3 часа активных нагрузок ежедневно — иначе разнесут квартиру. Бульдоги, мопсы — диванные, но имеют брахицефальные проблемы и плохо переносят жару. Семьям с детьми подходят лабрадор, ретривер, бигль. Для аллергиков — пудель, бишон-фризе, португальская водяная (не линяют). Маленьким квартирам — чихуахуа, той-терьер, такса. Не покупайте породу 'для статуса' — собака не аксессуар."},
    {"slug": "anxiety-fireworks", "topic": "Поведение",
     "title": "Что делать, если собака боится салютов",
     "annotation": "Подготовка к новогодним фейерверкам и работа со страхами.",
     "image_emoji": "🎆",
     "img_q": "scared dog hiding",
     "author": "Зоопсихолог Мария Лебедева",
     "body": "Боязнь громких звуков — одна из самых частых фобий. К новому году готовьтесь с октября: проигрывайте записи салютов на минимальной громкости во время еды и игры, постепенно увеличивая громкость. В сам день: закройте окна, шторы, включите белый шум или музыку. Создайте 'безопасное место' — закрытое логово, домик, шкаф с одеялами. Туда нельзя заходить никому. Не успокаивайте собаку голосом и объятиями — это закрепит реакцию. Просто будьте рядом. В тяжёлых случаях ветеринар выписывает Серенин, Стоп-стресс или человеческие препараты — только по назначению."},
    {"slug": "switching-food", "topic": "Питание",
     "title": "Как правильно перевести собаку на другой корм",
     "annotation": "Постепенная схема замены за 7 дней без расстройств ЖКТ и пищевой аллергии.",
     "image_emoji": "🍖",
     "img_q": "dog food transition",
     "author": "Ветеринар Анна Соколова",
     "body": "Резкий переход с одного корма на другой почти всегда заканчивается диареей, рвотой или сильным газообразованием. Микрофлора кишечника собаки адаптирована под конкретный набор белков и клетчатки — менять её нужно постепенно. Классическая схема рассчитана на 7 дней. День 1–2: 75% старого корма + 25% нового. День 3–4: 50/50. День 5–6: 25% старого + 75% нового. День 7: 100% нового. Если собака чувствительна или у неё в прошлом были проблемы с ЖКТ — растяните на 10–14 дней. В переходный период не давайте лакомств с других белков, не смешивайте сухой и влажный корм разных производителей, не меняйте режим прогулок и физических нагрузок. Параллельно следите за стулом: рыхлый, со слизью или с кровью — это повод вернуться на старый корм и обратиться к ветеринару. После полного перехода контрольный период — 4 недели: если за это время появились зуд, перхоть, слезятся глаза или собака набирает / теряет вес — корм не подходит, попробуйте другой источник белка."},
    {"slug": "grooming", "topic": "Уход",
     "title": "Груминг дома: чек-лист по уходу за шерстью",
     "annotation": "Расчёсывание, мытьё, стрижка когтей и чистка ушей — как часто и чем.",
     "image_emoji": "✂️",
     "img_q": "dog grooming brush",
     "author": "Грумер Елена Краснова",
     "body": "Уход за собакой в домашних условиях — это не косметика, а гигиена. Базовый набор: пуходёрка, расчёска-гребень, когтерез, ватные диски, гипоаллергенный шампунь. Длинношёрстных (йорки, ши-тцу, мальтезе, шелти) расчёсывайте ежедневно — иначе колтуны. Короткошёрстных (лабрадор, бигль, такса) — 1–2 раза в неделю резиновой перчаткой или фурминатором, особенно в линьку. Купание: не чаще 1 раза в месяц, иначе нарушите естественный жировой слой кожи. Шампунь — только для собак (человеческий = pH 5.5, собачий = pH 7.5). После мытья обязательно высушите феном на тёплом режиме до самой кожи. Когти подстригайте по мере отрастания — обычно раз в 3–4 недели. Стригите только белую часть, до 'пульпы' (тёмный кровеносный сосуд внутри когтя). Уши осматривайте раз в неделю — у вислоухих пород (кокер, бигль) чистите от серы каждые 10–14 дней лосьоном, ни в коем случае не ватными палочками. Чёрный налёт, неприятный запах или собака трясёт головой — отит, к ветеринару."},
    {"slug": "summer-heat", "topic": "Уход",
     "title": "Как помочь собаке пережить летнюю жару",
     "annotation": "Тепловой удар, ожоги лап и обезвоживание — что делать и чего избегать.",
     "image_emoji": "🌞",
     "img_q": "dog summer heat",
     "author": "Ветеринар Анна Соколова",
     "body": "Собаки плохо переносят жару — у них почти нет потовых желёз, охлаждаются через дыхание. Особенно тяжело брахицефалам (бульдоги, мопсы, боксёры) и пожилым собакам. Главное правило лета: гуляйте до 9 утра и после 20 вечера. Днём — только в тенистом парке, не на солнцепёке. Никогда не оставляйте собаку в припаркованной машине даже на 5 минут — внутри +50°C за четверть часа. Асфальт нагревается до +60°C — проверяйте тыльной стороной ладони: если вам горячо за 7 секунд, лапам собаки тоже горячо. Носите воду на прогулки, охлаждающий коврик и жилет смочите перед выходом. Признаки теплового удара: учащённое дыхание с вываленным языком, заторможенность, рвота, температура выше 40°C. Действия: в тень, обливайте лапы и живот прохладной (не ледяной!) водой, дайте попить, везите к ветеринару. Стрижка машинкой 'под ноль' летом — миф: шерсть защищает от солнца и не даёт перегреться. Достаточно проредить подшёрсток фурминатором."},
]


def _seed_hardcoded_products(s: Session, cat_id_by_slug: dict, now: datetime) -> None:
    """Fallback: use the hardcoded PRODUCTS list (with Openverse images)."""
    for p in PRODUCTS:
        pid = uuid4()
        cat_id = cat_id_by_slug.get(p["cat"])
        if not cat_id:
            continue
        key = f"products/{p['cat']}/{_slugify(p['title'])}.jpg"
        fallback_q = _CATEGORY_FALLBACK_QUERY.get(p["cat"])
        real = _cache_image_to_s3(key, p["img_q"], fallback_q)
        img = real or _slug_to_emoji_image(p["cat"], p["emoji"])
        s.execute(
            """INSERT INTO products (id, category_id, title, brand, price, old_price,
               rating, rating_count, description, composition, instruction, image, tags,
               size_for, in_stock, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (pid, cat_id, p["title"], p["brand"], float(p["price"]),
             float(p["old_price"]) if p.get("old_price") else None,
             float(p["rating"]), int(p["rating_count"]),
             p["description"], p["composition"], p["instruction"],
             img, set(p.get("tags", [])), p.get("size_for", "any"), True, now),
        )
        s.execute(
            """INSERT INTO products_by_category (category_id, product_id, title, brand,
               price, rating, image, in_stock, size_for)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (cat_id, pid, p["title"], p["brand"], float(p["price"]),
             float(p["rating"]), img, True, p.get("size_for", "any")),
        )


def is_seeded(s: Session) -> bool:
    row = s.execute("SELECT id FROM categories LIMIT 1").one()
    return row is not None


def seed_all(s: Session) -> None:
    if is_seeded(s):
        logger.info("Seed: skipped (data exists)")
        return
    now = datetime.now(timezone.utc)

    cat_id_by_slug = {}
    for c in CATEGORIES:
        cid = uuid4()
        cat_id_by_slug[c["slug"]] = cid
        s.execute(
            "INSERT INTO categories (id, slug, title, description, icon, sort_order) VALUES (%s,%s,%s,%s,%s,%s)",
            (cid, c["slug"], c["title"], c["description"], c["icon"], c["sort_order"]),
        )

    logger.info("Seed: scraping mirhvost.ru for real product cards...")
    scraped = {}
    try:
        scraped = scraper.scrape_all(per_category=10)
    except Exception as e:
        logger.warning("Scrape failed: %s", e)
    total_scraped = sum(len(v) for v in scraped.values())
    rng = random.Random(42)

    product_image_pool: list[str] = []  # populated as we upload to S3

    if total_scraped >= 12:
        logger.info("Seed: using %d scraped products", total_scraped)
        for cat_slug, items in scraped.items():
            cat_id = cat_id_by_slug.get(cat_slug)
            if not cat_id:
                continue
            cat_cover: str | None = None
            for item in items:
                pid = uuid4()
                brand = _extract_brand(item["title"]) or ""
                size_for = _detect_size_for(item["title"])
                price = float(item["price"])
                old_price = round(price * rng.uniform(1.10, 1.25) / 10) * 10 if rng.random() < 0.35 else None
                rating = round(rng.uniform(4.3, 4.95), 1)
                rating_count = rng.randint(40, 1500)
                desc = _short_desc(item["title"], item.get("description") or "")

                key = f"products/{cat_slug}/{pid.hex[:12]}.jpg"
                raw = s3.fetch_url(item["image"])
                img = None
                if raw:
                    try:
                        img = s3.upload_image_bytes(key, raw)
                    except Exception as e:
                        logger.warning("S3 upload failed for %s: %s", key, e)
                if img:
                    product_image_pool.append(img)
                    if not cat_cover:
                        cat_cover = img
                else:
                    continue  # skip products without real photo (no more SVG fallback)

                s.execute(
                    """INSERT INTO products (id, category_id, title, brand, price, old_price,
                       rating, rating_count, description, composition, instruction, image, tags,
                       size_for, in_stock, created_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (pid, cat_id, item["title"], brand, price, old_price,
                     rating, rating_count, desc, "", "",
                     img, set(), size_for, True, now),
                )
                s.execute(
                    """INSERT INTO products_by_category (category_id, product_id, title, brand,
                       price, rating, image, in_stock, size_for)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (cat_id, pid, item["title"], brand, price, rating, img, True, size_for),
                )
            if cat_cover:
                s.execute("UPDATE categories SET cover_image=%s WHERE id=%s", (cat_cover, cat_id))
    else:
        logger.info("Seed: falling back to hardcoded products (scrape returned %d)", total_scraped)
        _seed_hardcoded_products(s, cat_id_by_slug, now)

    logger.info("Seed: fetching article photos from dog.ceo → S3...")
    for a in ARTICLES:
        aid = uuid4()
        breed = ARTICLE_BREED.get(a["slug"])
        img = _cache_dog_photo_to_s3(a["slug"], breed)
        if not img:
            # Last-resort fallback (very unlikely): use a product photo.
            img = product_image_pool[0] if product_image_pool else _slug_to_emoji_image("food", a["image_emoji"])
        s.execute(
            """INSERT INTO articles (id, slug, title, annotation, body, topic, image,
               author, published_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (aid, a["slug"], a["title"], a["annotation"], a["body"], a["topic"],
             img, a["author"], now),
        )

    logger.info("Seed: inserted %d categories, %d products, %d articles",
                len(CATEGORIES), len(PRODUCTS), len(ARTICLES))
