import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_session, get_session, shutdown
from .seed import seed_all
from .routers import (
    auth_router,
    catalog,
    reviews_router,
    cart_router,
    orders_router,
    payments_router,
    pets_router,
    articles_router,
    recommendations_router,
    upload_router,
    users_router,
    friends_router,
    posts_router,
    messages_router,
    feed_router,
    comments_router,
    chats_router,
    likes_router,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
log = logging.getLogger("zoomarket")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_session()
    if settings.seed_on_start:
        try:
            seed_all(get_session())
        except Exception as e:
            log.exception("Seed failed: %s", e)
    yield
    shutdown()


app = FastAPI(
    title="Зоомагазин для собак — API",
    version="1.0.0",
    description="REST API на FastAPI с базой данных Cassandra. Mock-оплата всегда успешна.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(catalog.router)
app.include_router(reviews_router.router)
app.include_router(cart_router.router)
app.include_router(orders_router.router)
app.include_router(payments_router.router)
app.include_router(pets_router.router)
app.include_router(articles_router.router)
app.include_router(recommendations_router.router)
app.include_router(upload_router.router)
app.include_router(users_router.router)
app.include_router(friends_router.router)
app.include_router(posts_router.router)
app.include_router(messages_router.router)
app.include_router(feed_router.router)
app.include_router(comments_router.router)
app.include_router(chats_router.router)
app.include_router(likes_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "db": "cassandra", "payment": settings.payment_provider}


@app.get("/")
def root():
    return {"name": "Zoomarket API", "docs": "/docs"}
