from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'tapright-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# Create the main app
app = FastAPI(title="TapRight API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============ MODELS ============

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: str
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    questionnaire: Optional[dict] = None

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class QuestionnaireData(BaseModel):
    monthly_rent: Optional[float] = None
    monthly_expenses: Optional[float] = None
    card_payments: Optional[float] = None
    other_data: Optional[dict] = None

class CreditCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    issuer: str
    image_base64: Optional[str] = None
    rewards: dict  # category -> percentage/points
    annual_fee: float = 0.0
    color: str = "#1a1a1a"

class UserCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    card_id: str
    card_name: str
    card_issuer: str
    card_color: str
    rewards: dict
    added_at: datetime = Field(default_factory=datetime.utcnow)

class POILocation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str  # dining, gas, grocery, retail, coffee, entertainment, travel, general
    latitude: float
    longitude: float
    address: Optional[str] = None
    radius: float = 150.0  # meters

class LocationCheck(BaseModel):
    latitude: float
    longitude: float
    user_id: str

class NotificationLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    poi_id: str
    card_recommended: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Recommendation(BaseModel):
    merchant_name: str
    category: str
    recommended_card: str
    reward_rate: str
    message: str

# ============ AUTHENTICATION ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        user = await db.users.find_one({'id': user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============ HELPER FUNCTIONS ============

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in meters using Haversine formula"""
    R = 6371000  # Earth radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def get_best_card_for_category(user_cards: List[UserCard], category: str) -> Optional[tuple]:
    """Return the best card for a given category"""
    best_card = None
    best_rate = 0.0
    
    for card in user_cards:
        rewards = card.rewards
        rate = 0.0
        
        # Check category match
        if category.lower() in rewards:
            rate = float(rewards[category.lower()])
        elif 'everything' in rewards:
            rate = float(rewards['everything'])
        elif 'general' in rewards:
            rate = float(rewards['general'])
        
        if rate > best_rate:
            best_rate = rate
            best_card = card
    
    if best_card:
        return (best_card, best_rate)
    return None

# ============ ROUTES ============

@api_router.get("/")
async def root():
    return {"message": "TapRight API", "version": "1.0.0"}

# AUTH ROUTES
@api_router.post("/auth/signup")
async def signup(user_data: UserSignup):
    # Check if user exists
    existing = await db.users.find_one({'email': user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password_hash=hash_password(user_data.password)
    )
    
    await db.users.insert_one(user.dict())
    token = create_token(user.id)
    
    return {
        'token': token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'phone': user.phone
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_data = await db.users.find_one({'email': credentials.email})
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**user_data)
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user.id)
    
    return {
        'token': token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'phone': user.phone
        }
    }

# PROFILE ROUTES
@api_router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {
        'id': current_user.id,
        'name': current_user.name,
        'email': current_user.email,
        'phone': current_user.phone,
        'questionnaire': current_user.questionnaire
    }

@api_router.put("/profile/questionnaire")
async def update_questionnaire(
    data: QuestionnaireData,
    current_user: User = Depends(get_current_user)
):
    await db.users.update_one(
        {'id': current_user.id},
        {'$set': {'questionnaire': data.dict()}}
    )
    return {'message': 'Questionnaire updated'}

# CREDIT CARD ROUTES
@api_router.get("/cards", response_model=List[CreditCard])
async def get_all_cards():
    """Get all available credit cards"""
    cards = await db.credit_cards.find().to_list(1000)
    if not cards:
        # Initialize default cards if empty
        await initialize_credit_cards()
        cards = await db.credit_cards.find().to_list(1000)
    return [CreditCard(**card) for card in cards]

@api_router.post("/user-cards")
async def add_user_card(
    card_id: str,
    current_user: User = Depends(get_current_user)
):
    # Get card details
    card_data = await db.credit_cards.find_one({'id': card_id})
    if not card_data:
        raise HTTPException(status_code=404, detail="Card not found")
    
    card = CreditCard(**card_data)
    
    # Check if already added
    existing = await db.user_cards.find_one({
        'user_id': current_user.id,
        'card_id': card_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Card already in wallet")
    
    user_card = UserCard(
        user_id=current_user.id,
        card_id=card.id,
        card_name=card.name,
        card_issuer=card.issuer,
        card_color=card.color,
        rewards=card.rewards
    )
    
    await db.user_cards.insert_one(user_card.dict())
    return user_card

@api_router.get("/user-cards", response_model=List[UserCard])
async def get_user_cards(current_user: User = Depends(get_current_user)):
    cards = await db.user_cards.find({'user_id': current_user.id}).to_list(1000)
    return [UserCard(**card) for card in cards]

@api_router.delete("/user-cards/{card_id}")
async def remove_user_card(
    card_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await db.user_cards.delete_one({
        'user_id': current_user.id,
        'card_id': card_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found in wallet")
    return {'message': 'Card removed from wallet'}

# LOCATION & RECOMMENDATION ROUTES
@api_router.post("/location/check")
async def check_location(
    location: LocationCheck,
    current_user: User = Depends(get_current_user)
):
    """Check if user is near any POI and return recommendation"""
    
    # Find nearby POIs
    all_pois = await db.poi_locations.find().to_list(1000)
    if not all_pois:
        # Initialize POIs if empty
        await initialize_poi_locations()
        all_pois = await db.poi_locations.find().to_list(1000)
    
    nearby_poi = None
    min_distance = float('inf')
    
    for poi_data in all_pois:
        poi = POILocation(**poi_data)
        distance = calculate_distance(
            location.latitude,
            location.longitude,
            poi.latitude,
            poi.longitude
        )
        
        if distance <= poi.radius and distance < min_distance:
            min_distance = distance
            nearby_poi = poi
    
    if not nearby_poi:
        return {'found': False, 'message': 'No merchants nearby'}
    
    # Check notification throttling (4 hours)
    four_hours_ago = datetime.utcnow() - timedelta(hours=4)
    recent_notification = await db.notification_logs.find_one({
        'user_id': current_user.id,
        'poi_id': nearby_poi.id,
        'timestamp': {'$gte': four_hours_ago}
    })
    
    if recent_notification:
        return {
            'found': True,
            'merchant': nearby_poi.name,
            'category': nearby_poi.category,
            'throttled': True,
            'message': 'Already notified recently'
        }
    
    # Get user's cards
    user_cards_data = await db.user_cards.find({'user_id': current_user.id}).to_list(1000)
    if not user_cards_data:
        return {
            'found': True,
            'merchant': nearby_poi.name,
            'category': nearby_poi.category,
            'no_cards': True,
            'message': 'No cards in wallet'
        }
    
    user_cards = [UserCard(**card) for card in user_cards_data]
    
    # Get best card for category
    best_match = get_best_card_for_category(user_cards, nearby_poi.category)
    
    if not best_match:
        return {
            'found': True,
            'merchant': nearby_poi.name,
            'category': nearby_poi.category,
            'no_match': True,
            'message': 'No matching rewards'
        }
    
    best_card, best_rate = best_match
    
    # Log notification
    log = NotificationLog(
        user_id=current_user.id,
        poi_id=nearby_poi.id,
        card_recommended=best_card.card_name
    )
    await db.notification_logs.insert_one(log.dict())
    
    # Create recommendation with proper formatting
    reward_text = f"{best_rate}% back" if best_rate < 10 else f"{int(best_rate)}x points"
    recommendation = Recommendation(
        merchant_name=nearby_poi.name,
        category=nearby_poi.category,
        recommended_card=best_card.card_name,
        reward_rate=reward_text,
        message=f"Hey, you're at {nearby_poi.name}! Use {best_card.card_name} to get {reward_text}."
    )
    
    return {
        'found': True,
        'recommendation': recommendation.dict()
    }

# ============ INITIALIZATION FUNCTIONS ============

async def initialize_credit_cards():
    """Initialize default credit card database"""
    cards = [
        CreditCard(
            name="Blue Cash Everyday",
            issuer="American Express",
            color="#006FCF",
            rewards={
                "gas": 3,
                "grocery": 2,
                "general": 1
            },
            annual_fee=0.0
        ),
        CreditCard(
            name="Freedom Flex",
            issuer="Chase",
            color="#0F4D92",
            rewards={
                "dining": 3,
                "gas": 3,
                "general": 1
            },
            annual_fee=0.0
        ),
        CreditCard(
            name="Discover it Cash Back",
            issuer="Discover",
            color="#FF6B00",
            rewards={
                "dining": 5,
                "grocery": 5,
                "gas": 5,
                "general": 1
            },
            annual_fee=0.0
        ),
        CreditCard(
            name="Double Cash",
            issuer="Citi",
            color="#003B71",
            rewards={
                "everything": 2
            },
            annual_fee=0.0
        ),
        CreditCard(
            name="SavorOne",
            issuer="Capital One",
            color="#D8232A",
            rewards={
                "dining": 3,
                "entertainment": 3,
                "grocery": 2,
                "general": 1
            },
            annual_fee=0.0
        ),
        CreditCard(
            name="Sapphire Preferred",
            issuer="Chase",
            color="#1A2870",
            rewards={
                "dining": 3,
                "travel": 3,
                "general": 1
            },
            annual_fee=95.0
        ),
        CreditCard(
            name="Gold Card",
            issuer="American Express",
            color="#C9A668",
            rewards={
                "dining": 4,
                "grocery": 4,
                "general": 1
            },
            annual_fee=250.0
        )
    ]
    
    for card in cards:
        await db.credit_cards.insert_one(card.dict())

async def initialize_poi_locations():
    """Initialize sample POI locations across USA with broader coverage"""
    pois = [
        # Starbucks locations (coffee)
        POILocation(name="Starbucks Downtown", category="coffee", latitude=37.7749, longitude=-122.4194, radius=200.0),
        POILocation(name="Starbucks Times Square", category="coffee", latitude=40.7580, longitude=-73.9855, radius=200.0),
        POILocation(name="Starbucks LA", category="coffee", latitude=34.0522, longitude=-118.2437, radius=200.0),
        
        # Gas stations
        POILocation(name="Chevron Station", category="gas", latitude=37.7849, longitude=-122.4094, radius=200.0),
        POILocation(name="Shell Gas", category="gas", latitude=40.7480, longitude=-73.9755, radius=200.0),
        POILocation(name="Exxon Station", category="gas", latitude=34.0422, longitude=-118.2537, radius=200.0),
        POILocation(name="BP Gas Station", category="gas", latitude=37.7949, longitude=-122.4194, radius=200.0),
        
        # Grocery stores
        POILocation(name="Whole Foods Market", category="grocery", latitude=37.7849, longitude=-122.4294, radius=200.0),
        POILocation(name="Trader Joe's", category="grocery", latitude=40.7680, longitude=-73.9655, radius=200.0),
        POILocation(name="Safeway", category="grocery", latitude=34.0622, longitude=-118.2337, radius=200.0),
        POILocation(name="Kroger", category="grocery", latitude=37.7449, longitude=-122.4394, radius=200.0),
        
        # Restaurants
        POILocation(name="Chipotle", category="dining", latitude=37.7649, longitude=-122.4394, radius=150.0),
        POILocation(name="McDonald's", category="dining", latitude=40.7380, longitude=-73.9955, radius=150.0),
        POILocation(name="Olive Garden", category="dining", latitude=34.0322, longitude=-118.2637, radius=150.0),
        POILocation(name="Panera Bread", category="dining", latitude=37.7849, longitude=-122.4494, radius=150.0),
        
        # Retail stores
        POILocation(name="Target", category="retail", latitude=37.7549, longitude=-122.4494, radius=250.0),
        POILocation(name="Walmart", category="retail", latitude=40.7280, longitude=-73.9855, radius=250.0),
        POILocation(name="Best Buy", category="retail", latitude=34.0222, longitude=-118.2737, radius=200.0),
        POILocation(name="CVS Pharmacy", category="retail", latitude=37.7649, longitude=-122.4194, radius=150.0),
        POILocation(name="Walgreens", category="retail", latitude=40.7580, longitude=-73.9755, radius=150.0),
    ]
    
    for poi in pois:
        await db.poi_locations.insert_one(poi.dict())

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
