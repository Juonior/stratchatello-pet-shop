# 🐕 Хвостайл — Зоомагазин для собак

Веб-приложение «Зоомагазин для собак» — практические работы №5–8 по дисциплине «Системная и программная инженерия», РТУ МИРЭА, команда «Страчателла» (ИКБО-61-23).

## Стек

| Слой | Технология |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite, Tailwind CSS, Framer Motion, React Router, Zustand, react-hot-toast |
| **Backend** | FastAPI (Python 3.11), Pydantic v2, JWT, bcrypt |
| **Database** | **Apache Cassandra 4.1** (основное хранилище) |
| **Cache** | Redis 7 |
| **Контейнеризация** | Docker + docker-compose |
| **Web-server** | Nginx (раздача SPA) |

## Возможности

- Каталог товаров по категориям (Корма, Лакомства, Игрушки, Аксессуары, Одежда, Здоровье)
- Фильтры: цена, бренд, рейтинг + сортировки + поиск
- Карточка товара: описание, состав, инструкция, отзывы
- Авторизация (JWT)
- Корзина: добавление, изменение количества, удаление
- Оформление заказа в 4 шага (адрес → время → оплата → подтверждение)
- **Mock-оплата:** всегда успешна, без реальных платёжных шлюзов
- Паспорта питомцев (CRUD): кличка, порода, возраст, размер, аллергии
- **Персональные подборки** на главной — учитывают размер и аллергии питомца
- Статьи: список + поиск + фильтрация по темам + детальная страница
- Анимации: вход страниц, hover-карточки, blob-фоны, плавающие эмодзи, степпер оплаты

## Запуск

### 1. Конфиг

```bash
cp .env.example .env
# Отредактируйте .env при необходимости (JWT_SECRET и др.)
```

### 2. Поднять весь стек

```bash
docker compose up -d --build
```

Подождите ~60–90 секунд на первичную инициализацию Cassandra (healthcheck).

### 3. Открыть

- **Фронтенд:** http://localhost:5173
- **Backend API:** http://localhost:8000/api
- **OpenAPI docs:** http://localhost:8000/docs
- **Health:** http://localhost:8000/api/health

При первом запуске бэкенд автоматически создаёт keyspace, таблицы и засеивает каталог (6 категорий, 19 товаров, 6 статей).

### 4. Остановить

```bash
docker compose down            # сохранить данные
docker compose down -v         # вместе с volume Cassandra (полная очистка)
```

## Архитектура

```
┌──────────────┐    HTTPS    ┌──────────────────────┐
│ React (Nginx)│ ──────────► │ FastAPI (uvicorn)    │
│  :5173       │  /api/*     │ JWT + bcrypt + REST  │
└──────────────┘             └──────────┬───────────┘
                                        │
                       ┌────────────────┴────────────────┐
                       ▼                                 ▼
                ┌─────────────┐                   ┌────────────┐
                │  Cassandra  │                   │   Redis    │
                │  :9042      │                   │   :6379    │
                └─────────────┘                   └────────────┘
```

Cassandra-таблицы (см. [backend/app/database.py](backend/app/database.py)) спроектированы по принципу «таблица под запрос»:
- `users`, `users_by_email`
- `categories`
- `products`, `products_by_category`
- `reviews_by_product`
- `cart_items`
- `orders_by_user`
- `pets_by_user`
- `articles`

## Структура проекта

```
stratchatella/
├── docker-compose.yml          ← оркестрация (Cassandra, Redis, backend, frontend)
├── .env / .env.example         ← все переменные окружения
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             ← точка входа FastAPI
│       ├── config.py           ← Pydantic settings
│       ├── database.py         ← подключение и схема Cassandra
│       ├── auth.py             ← JWT + bcrypt
│       ├── schemas.py          ← Pydantic-модели
│       ├── seed.py             ← начальные данные
│       └── routers/
│           ├── auth_router.py        ← /auth/register, /auth/login, /auth/me
│           ├── catalog.py            ← /categories, /products
│           ├── reviews_router.py     ← /products/{id}/reviews
│           ├── cart_router.py        ← /cart
│           ├── orders_router.py      ← /orders/checkout
│           ├── payments_router.py    ← /payments  (MOCK — всегда успех)
│           ├── pets_router.py        ← /pets
│           ├── articles_router.py    ← /articles
│           └── recommendations_router.py ← /recommendations (с учётом профиля питомца)
└── frontend/
    ├── Dockerfile               (multi-stage: node build → nginx)
    ├── nginx.conf
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── package.json
    └── src/
        ├── main.tsx / App.tsx
        ├── api.ts               ← axios-обёртка
        ├── store.ts             ← zustand (auth, cart)
        ├── types.ts
        ├── components/
        │   ├── Navbar / Footer / Hero
        │   ├── ProductCard / Skeleton
        │   └── PageTransition
        └── pages/
            ├── Home / Catalog / Product
            ├── Cart / Checkout
            ├── Articles / Article
            ├── Pets
            └── Login / Register / Profile
```

## API-эндпоинты (главное)

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Логин (получение JWT) |
| GET | `/api/auth/me` | Профиль текущего пользователя |
| GET | `/api/categories` | Все категории |
| GET | `/api/products` | Список товаров с фильтрами |
| GET | `/api/products/{id}` | Карточка товара |
| GET | `/api/products/{id}/reviews` | Отзывы |
| POST | `/api/products/{id}/reviews` | Добавить отзыв 🔐 |
| GET/POST/PUT/DELETE | `/api/cart` | Корзина 🔐 |
| POST | `/api/orders/checkout` | Оформить заказ 🔐 |
| GET | `/api/orders` | Мои заказы 🔐 |
| POST | `/api/payments` | **Mock-оплата** (всегда success) 🔐 |
| GET/POST/PUT/DELETE | `/api/pets` | Паспорта питомцев 🔐 |
| GET | `/api/articles` | Статьи (фильтр/поиск) |
| GET | `/api/articles/{id}` | Статья |
| GET | `/api/recommendations` | Персональные подборки |

🔐 — требуется JWT-токен в заголовке `Authorization: Bearer <token>`.

## Mock-оплата

В соответствии с заданием реальный YooKassa **не используется**. Эндпоинт `POST /api/payments` всегда возвращает:

```json
{
  "payment_id": "...",
  "order_id": "...",
  "amount": 1234.0,
  "status": "succeeded",
  "provider": "mock",
  "receipt": "MOCK-XXXXXXXX"
}
```

Поведение управляется флагом `PAYMENT_AUTOAPPROVE` в `.env`.

## Полезное

```bash
# Логи всех сервисов
docker compose logs -f

# Только backend
docker compose logs -f backend

# Зайти в cqlsh
docker compose exec cassandra cqlsh

# Перезапустить только backend (например, после правки кода)
docker compose restart backend

# Пересборка после изменений зависимостей
docker compose up -d --build
```

## Команда «Страчателла»

- **Астапович К.А.** — дизайн, frontend
- **Колосова С.А.** — аналитика, тех. писатель
- **Корягин А.Д.** — разработка
- **Титов Д.А.** — руководитель группы, backend
- **Филиппова Т.А.** — тестирование
