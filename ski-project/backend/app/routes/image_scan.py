import base64
import json
import os
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request

from app.core.config import settings
from app.core.auth import get_current_user
from app.core.db import scans_collection
from app.models.product import Product, NutritionFacts
from app.services.health_score import calculate_health_score

router = APIRouter()

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

EXTRACTION_PROMPT = """You are a food label analyst. Carefully examine this food product label image.

Extract ALL visible information and respond with ONLY a valid JSON object — no markdown, no explanation.

JSON structure (use null for any field not visible):
{
  "name": "product name",
  "brand": "brand name",
  "ingredients": "full ingredients text as shown",
  "nutrition": {
    "energy_kcal": number or null,
    "fat": number or null,
    "saturated_fat": number or null,
    "sugars": number or null,
    "sodium": number or null,
    "fiber": number or null,
    "proteins": number or null
  },
  "nutriscore": "a/b/c/d/e or null",
  "nova_group": 1-4 or null,
  "additives_detected": ["list", "of", "any", "visible", "additives"],
  "allergens": ["list", "of", "allergens"],
  "extraction_confidence": "high/medium/low",
  "healthy_alternatives": [
    {
      "name": "healthy alternative food/drink product name",
      "reason": "short explanation of why this is a healthier option than the scanned product"
    }
  ],
  "notes": "anything else relevant or unclear on the label"
}

Rules:
- Nutrition values must be per 100g or per 100ml (convert if shown per serving)
- Sodium: return in g/100g (so 500mg = 0.5)
- If only serving size values shown, estimate per-100g by dividing accordingly
- Extract ALL ingredients even if the text is small
- Suggest 2-3 products in the `healthy_alternatives` array based on whether the product is healthy (e.g. low sugar, low sodium, low saturated fat, NOVA group 1-2) or unhealthy (e.g. high sugar, high sodium, ultra-processed NOVA group 4, high saturated fat, or many additives):
  1. If the scanned product is HEALTHY: Recommend 2-3 other healthy, high-quality popular Indian products of the EXACT SAME category/type (e.g., if you scan a healthy whole-grain biscuit, recommend other healthy whole-grain biscuit brands like 'Sunfeast Farmlite Oats' or 'NutriChoice Digestive'; if a healthy juice, recommend other natural unsweetened juices).
  2. If the scanned product is UNHEALTHY: Recommend 2-3 healthier related items commonly available in India (e.g., if you scan an unhealthy biscuit, recommend healthy whole-grain fiber biscuits; if you scan unhealthy fried potato chips, recommend baked beetroot chips or roasted makhana; if you scan sugary cola, recommend stevia-sweetened fruit juices, coconut water, or buttermilk)."""


def _extract_text_from_gemini(payload: dict) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        raise HTTPException(status_code=502, detail="Gemini returned no candidates")

    parts = candidates[0].get("content", {}).get("parts", [])
    text_chunks = [part.get("text", "") for part in parts if part.get("text")]
    if not text_chunks:
        raise HTTPException(status_code=502, detail="Gemini returned no text content")

    response_text = "".join(text_chunks).strip()

    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]

    return response_text.strip()


async def call_gemini_vision(image_b64: str, media_type: str) -> dict:
    """Send image to Gemini and extract structured food label data."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not set in environment",
        )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": EXTRACTION_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": media_type,
                            "data": image_b64,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0,
        },
    }

    with httpx.Client(timeout=30) as client:
        res = client.post(
            GEMINI_API_URL,
            headers={
                "x-goog-api-key": api_key,
                "content-type": "application/json",
            },
            json=payload,
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Gemini API error: {res.text}")

    response_text = _extract_text_from_gemini(res.json())

    try:
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Could not parse Gemini response: {e}")


@router.post("/")
async def scan_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a food label image.
    Enforces authentication, saves image locally, extracts data via Gemini,
    saves the scan in MongoDB, and returns the analyzed product + recommendations.
    """
    # Validate file type
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG, or WebP."
        )

    # Read image
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="Image too large. Max 10MB.")

    # Save image locally inside backend uploads directory
    uploads_dir = os.path.join(settings.BASE_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(uploads_dir, unique_filename)
    
    with open(file_path, "wb") as buffer:
        buffer.write(image_bytes)

    # Base64 encode for Gemini
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    # Extract data via Gemini Vision
    extracted = await call_gemini_vision(image_b64, file.content_type)

    # Build Product model from extracted data
    nutrition_data = extracted.get("nutrition") or {}
    product = Product(
        barcode=f"image_{unique_filename}",
        name=extracted.get("name") or "Unknown Product",
        brand=extracted.get("brand"),
        ingredients=extracted.get("ingredients"),
        nutriscore=extracted.get("nutriscore"),
        nova_group=extracted.get("nova_group"),
        nutrition=NutritionFacts(
            energy_kcal=nutrition_data.get("energy_kcal"),
            fat=nutrition_data.get("fat"),
            saturated_fat=nutrition_data.get("saturated_fat"),
            sugars=nutrition_data.get("sugars"),
            sodium=nutrition_data.get("sodium"),
            fiber=nutrition_data.get("fiber"),
            proteins=nutrition_data.get("proteins"),
        ),
    )

    health = calculate_health_score(product)
    
    # Save the scan history in MongoDB (using nested object format matching client expectations)
    scan_doc = {
        "user_email": current_user["email"],
        "product": product.model_dump(),
        "health_score": health.model_dump(),
        "additives_detected": extracted.get("additives_detected", []),
        "allergens": extracted.get("allergens", []),
        "extraction_confidence": extracted.get("extraction_confidence", "medium"),
        "healthy_alternatives": extracted.get("healthy_alternatives", []),
        "notes": extracted.get("notes"),
        "image_url": f"data:{file.content_type};base64,{image_b64}",
        "scanned_at": datetime.utcnow()
    }
    
    await scans_collection.insert_one(scan_doc)
    
    # Convert MongoDB _id to string for response
    scan_doc["_id"] = str(scan_doc["_id"])
    scan_doc["scanned_at"] = scan_doc["scanned_at"].isoformat()
    
    return scan_doc


@router.get("/my-scans")
async def get_my_scans(current_user: dict = Depends(get_current_user)):
    """Retrieve all historical scans for the currently logged-in user, sorted newest first."""
    cursor = scans_collection.find({"user_email": current_user["email"]}).sort("scanned_at", -1)
    scans = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "scanned_at" in doc and isinstance(doc["scanned_at"], datetime):
            doc["scanned_at"] = doc["scanned_at"].isoformat()
        scans.append(doc)
    return scans
