from typing import List, Optional, Set
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# ===== Auth =====
class RegisterIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: UUID
    email: str
    name: str
    role: str = "user"
    photo: Optional[str] = None


class UserUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    photo: Optional[str] = None


# ===== Categories =====
class CategoryOut(BaseModel):
    id: UUID
    slug: str
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0
    cover_image: Optional[str] = None


# ===== Products =====
class ProductCardOut(BaseModel):
    id: UUID
    category_id: UUID
    title: str
    brand: Optional[str] = None
    price: float
    old_price: Optional[float] = None
    rating: float = 0
    rating_count: int = 0
    image: Optional[str] = None
    in_stock: bool = True
    size_for: Optional[str] = None
    tags: List[str] = []


class ProductOut(ProductCardOut):
    description: Optional[str] = None
    composition: Optional[str] = None
    instruction: Optional[str] = None


# ===== Reviews =====
class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=1, max_length=2000)


class ReviewOut(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    rating: int
    text: str
    created_at: datetime


# ===== Cart =====
class CartItemIn(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=1, le=999)


class CartItemOut(BaseModel):
    product_id: UUID
    title: str
    image: Optional[str] = None
    price: float
    quantity: int
    subtotal: float


class CartOut(BaseModel):
    items: List[CartItemOut]
    total: float
    count: int


# ===== Orders =====
class CheckoutIn(BaseModel):
    address: str = Field(min_length=3, max_length=400)
    delivery_time: str
    payment_method: str  # "card" | "cash" | "wallet"


class OrderItemSnap(BaseModel):
    product_id: UUID
    title: str
    price: float
    quantity: int
    image: Optional[str] = None


class OrderOut(BaseModel):
    id: UUID
    total: float
    status: str
    address: str
    delivery_time: str
    payment_method: str
    items: List[OrderItemSnap]
    created_at: datetime


# ===== Pets =====
class PetIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    breed: str
    age: int = Field(ge=0, le=40)
    weight: Optional[float] = Field(default=None, ge=0, le=200)
    size: Optional[str] = "medium"  # small / medium / large
    gender: Optional[str] = None
    allergies: Optional[str] = ""
    favorite_treat: Optional[str] = ""
    photo: Optional[str] = None


class PetOut(PetIn):
    id: UUID
    created_at: datetime


# ===== Articles =====
class ArticleCardOut(BaseModel):
    id: UUID
    slug: str
    title: str
    annotation: str
    topic: str
    image: Optional[str] = None
    author: Optional[str] = None
    published_at: datetime


class ArticleOut(ArticleCardOut):
    body: str


# ===== Recommendations =====
class RecommendationsOut(BaseModel):
    title: str
    reason: str
    products: List[ProductCardOut]


# ===== Social: public user profile =====
class PublicUser(BaseModel):
    id: UUID
    name: str
    email: str
    photo: Optional[str] = None
    # Relation to the requesting user
    relation: str = "stranger"  # "self" | "friend" | "request_sent" | "request_received" | "stranger"


# ===== Social: posts =====
class PostIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    image: Optional[str] = None
    video: Optional[str] = None


class PostFromUrlIn(BaseModel):
    text: str = Field(default="", max_length=2000)
    url: str = Field(min_length=10, max_length=600)


class PostOut(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    user_photo: Optional[str] = None
    text: str
    image: Optional[str] = None
    video: Optional[str] = None
    created_at: datetime


# ===== Social: friends =====
class FriendOut(BaseModel):
    id: UUID
    name: str
    email: Optional[str] = None
    photo: Optional[str] = None
    since: Optional[datetime] = None


class FriendRequestOut(BaseModel):
    user_id: UUID
    name: str
    photo: Optional[str] = None
    created_at: datetime


# ===== Social: messages =====
class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: UUID
    from_user_id: UUID
    text: str
    created_at: datetime
    mine: bool


class ThreadOut(BaseModel):
    peer_id: UUID
    peer_name: str
    peer_photo: Optional[str] = None
    last_message_text: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_from_me: bool = False


# ===== Comments =====
class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class CommentOut(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    user_photo: Optional[str] = None
    text: str
    created_at: datetime


# ===== Group chats (беседы) =====
class ChatRoomIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    member_ids: List[UUID] = Field(default_factory=list)
    photo: Optional[str] = None


class ChatMemberOut(BaseModel):
    id: UUID
    name: str
    photo: Optional[str] = None


class ChatRoomOut(BaseModel):
    id: UUID
    title: str
    photo: Optional[str] = None
    created_by: UUID
    created_at: datetime
    members: List[ChatMemberOut] = []


class ChatThreadOut(BaseModel):
    room_id: UUID
    title: str
    photo: Optional[str] = None
    last_message_text: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_from_name: Optional[str] = None


class ChatMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class ChatMessageOut(BaseModel):
    id: UUID
    from_user_id: UUID
    from_name: str
    from_photo: Optional[str] = None
    text: str
    created_at: datetime
    mine: bool


# ===== Social: feed =====
class FeedItem(BaseModel):
    post: PostOut
    section: str  # "friends" | "discover"


TokenOut.model_rebuild()
