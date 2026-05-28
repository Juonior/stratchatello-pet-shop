import time
import logging
from typing import Optional
from cassandra.cluster import Cluster, Session
from cassandra.auth import PlainTextAuthProvider
from cassandra.policies import DCAwareRoundRobinPolicy
from .config import settings

logger = logging.getLogger(__name__)

_cluster: Optional[Cluster] = None
_session: Optional[Session] = None


def _connect_cluster() -> Cluster:
    auth = PlainTextAuthProvider(
        username=settings.cassandra_user, password=settings.cassandra_password
    )
    return Cluster(
        contact_points=settings.cassandra_hosts_list,
        port=settings.cassandra_port,
        auth_provider=auth,
        load_balancing_policy=DCAwareRoundRobinPolicy(local_dc="dc1"),
        protocol_version=5,
        connect_timeout=15,
    )


def wait_for_cassandra(max_attempts: int = 60, delay: float = 3.0) -> Cluster:
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            cluster = _connect_cluster()
            s = cluster.connect()
            s.shutdown()
            logger.info("Cassandra is ready (attempt %d)", attempt)
            return cluster
        except Exception as e:
            last_err = e
            logger.info("Waiting for Cassandra... (%d/%d): %s", attempt, max_attempts, e)
            time.sleep(delay)
    raise RuntimeError(f"Cassandra not reachable: {last_err}")


def init_session() -> Session:
    global _cluster, _session
    if _session is not None:
        return _session
    _cluster = wait_for_cassandra()
    s = _cluster.connect()
    rf = settings.cassandra_replication_factor
    s.execute(
        f"""
        CREATE KEYSPACE IF NOT EXISTS {settings.cassandra_keyspace}
        WITH REPLICATION = {{ 'class': 'SimpleStrategy', 'replication_factor': {rf} }}
        """
    )
    s.set_keyspace(settings.cassandra_keyspace)
    _session = s
    create_schema(s)
    return s


def get_session() -> Session:
    if _session is None:
        return init_session()
    return _session


def shutdown():
    global _cluster, _session
    try:
        if _session:
            _session.shutdown()
    finally:
        _session = None
    try:
        if _cluster:
            _cluster.shutdown()
    finally:
        _cluster = None


# ---- Schema ----

SCHEMA_STATEMENTS = [
    # Users
    """
    CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        email text,
        name text,
        password_hash text,
        role text,
        photo text,
        created_at timestamp
    )
    """,
    "ALTER TABLE users ADD photo text",  # safe upgrade for existing keyspaces
    """
    CREATE TABLE IF NOT EXISTS users_by_email (
        email text PRIMARY KEY,
        user_id uuid
    )
    """,

    # Categories
    """
    CREATE TABLE IF NOT EXISTS categories (
        id uuid PRIMARY KEY,
        slug text,
        title text,
        description text,
        icon text,
        sort_order int,
        cover_image text
    )
    """,
    "ALTER TABLE categories ADD cover_image text",

    # Products
    """
    CREATE TABLE IF NOT EXISTS products (
        id uuid PRIMARY KEY,
        category_id uuid,
        title text,
        brand text,
        price double,
        old_price double,
        rating double,
        rating_count int,
        description text,
        composition text,
        instruction text,
        image text,
        tags set<text>,
        size_for text,
        in_stock boolean,
        created_at timestamp
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS products_by_category (
        category_id uuid,
        product_id uuid,
        title text,
        brand text,
        price double,
        rating double,
        image text,
        in_stock boolean,
        size_for text,
        PRIMARY KEY ((category_id), product_id)
    )
    """,

    # Reviews
    """
    CREATE TABLE IF NOT EXISTS reviews_by_product (
        product_id uuid,
        review_id timeuuid,
        user_id uuid,
        user_name text,
        rating int,
        text text,
        created_at timestamp,
        PRIMARY KEY ((product_id), review_id)
    ) WITH CLUSTERING ORDER BY (review_id DESC)
    """,

    # Cart (per user)
    """
    CREATE TABLE IF NOT EXISTS cart_items (
        user_id uuid,
        product_id uuid,
        quantity int,
        added_at timestamp,
        PRIMARY KEY ((user_id), product_id)
    )
    """,

    # Orders
    """
    CREATE TABLE IF NOT EXISTS orders_by_user (
        user_id uuid,
        order_id timeuuid,
        total double,
        status text,
        address text,
        delivery_time text,
        payment_method text,
        items_json text,
        created_at timestamp,
        PRIMARY KEY ((user_id), order_id)
    ) WITH CLUSTERING ORDER BY (order_id DESC)
    """,

    # Pets
    """
    CREATE TABLE IF NOT EXISTS pets_by_user (
        user_id uuid,
        pet_id uuid,
        name text,
        breed text,
        age int,
        weight double,
        size text,
        gender text,
        allergies text,
        favorite_treat text,
        photo text,
        created_at timestamp,
        PRIMARY KEY ((user_id), pet_id)
    )
    """,

    # Articles
    """
    CREATE TABLE IF NOT EXISTS articles (
        id uuid PRIMARY KEY,
        slug text,
        title text,
        annotation text,
        body text,
        topic text,
        image text,
        author text,
        published_at timestamp
    )
    """,

    # ===== Social network =====

    # Posts — main table (lookup by post id)
    """
    CREATE TABLE IF NOT EXISTS posts (
        id timeuuid PRIMARY KEY,
        user_id uuid,
        user_name text,
        user_photo text,
        text text,
        image text,
        video text,
        created_at timestamp
    )
    """,
    "ALTER TABLE posts ADD video text",

    # Posts by user (timeline of one author)
    """
    CREATE TABLE IF NOT EXISTS posts_by_user (
        user_id uuid,
        post_id timeuuid,
        text text,
        image text,
        video text,
        created_at timestamp,
        PRIMARY KEY ((user_id), post_id)
    ) WITH CLUSTERING ORDER BY (post_id DESC)
    """,
    "ALTER TABLE posts_by_user ADD video text",

    # Friendships — one row per direction (so we always know "my friends")
    """
    CREATE TABLE IF NOT EXISTS friendships (
        user_id uuid,
        friend_id uuid,
        friend_name text,
        friend_photo text,
        friend_email text,
        since timestamp,
        PRIMARY KEY ((user_id), friend_id)
    )
    """,

    # Pending friend requests — split for incoming/outgoing lookup
    """
    CREATE TABLE IF NOT EXISTS friend_requests_incoming (
        user_id uuid,
        from_user_id uuid,
        from_user_name text,
        from_user_photo text,
        created_at timestamp,
        PRIMARY KEY ((user_id), from_user_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS friend_requests_outgoing (
        user_id uuid,
        to_user_id uuid,
        to_user_name text,
        to_user_photo text,
        created_at timestamp,
        PRIMARY KEY ((user_id), to_user_id)
    )
    """,

    # Direct messages: messages indexed by deterministic thread_key
    """
    CREATE TABLE IF NOT EXISTS dm_messages (
        thread_key text,
        msg_id timeuuid,
        from_user_id uuid,
        text text,
        created_at timestamp,
        PRIMARY KEY ((thread_key), msg_id)
    ) WITH CLUSTERING ORDER BY (msg_id ASC)
    """,

    # Threads per user: shows summary of each conversation
    """
    CREATE TABLE IF NOT EXISTS dm_threads_by_user (
        user_id uuid,
        peer_id uuid,
        peer_name text,
        peer_photo text,
        last_message_text text,
        last_message_at timestamp,
        last_from_me boolean,
        PRIMARY KEY ((user_id), peer_id)
    )
    """,

    # ===== Post likes =====
    """
    CREATE TABLE IF NOT EXISTS post_likes (
        post_id timeuuid,
        user_id uuid,
        liked_at timestamp,
        PRIMARY KEY ((post_id), user_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS post_likes_by_user (
        user_id uuid,
        post_id timeuuid,
        liked_at timestamp,
        PRIMARY KEY ((user_id), post_id)
    )
    """,

    # ===== Post comments =====
    """
    CREATE TABLE IF NOT EXISTS post_comments (
        post_id timeuuid,
        comment_id timeuuid,
        user_id uuid,
        user_name text,
        user_photo text,
        text text,
        created_at timestamp,
        PRIMARY KEY ((post_id), comment_id)
    ) WITH CLUSTERING ORDER BY (comment_id ASC)
    """,

    # ===== Group chats (беседы) =====
    """
    CREATE TABLE IF NOT EXISTS chat_rooms (
        id uuid PRIMARY KEY,
        title text,
        photo text,
        created_by uuid,
        created_at timestamp
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS chat_room_members (
        room_id uuid,
        user_id uuid,
        name text,
        photo text,
        joined_at timestamp,
        PRIMARY KEY ((room_id), user_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS chat_rooms_by_user (
        user_id uuid,
        room_id uuid,
        title text,
        photo text,
        last_message_text text,
        last_message_at timestamp,
        last_from_name text,
        PRIMARY KEY ((user_id), room_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS chat_messages (
        room_id uuid,
        msg_id timeuuid,
        from_user_id uuid,
        from_name text,
        from_photo text,
        text text,
        created_at timestamp,
        PRIMARY KEY ((room_id), msg_id)
    ) WITH CLUSTERING ORDER BY (msg_id ASC)
    """,
]


def create_schema(s: Session) -> None:
    for stmt in SCHEMA_STATEMENTS:
        try:
            s.execute(stmt)
        except Exception as e:
            # ALTER TABLE for already-existing column raises InvalidRequest — ignore.
            if "Invalid column name" in str(e) or "already exists" in str(e).lower() \
                    or "conflicts with an existing" in str(e).lower():
                continue
            raise
    logger.info("Cassandra schema ready")
