from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user
from app.core.db import scans_collection
from app.models.product import NutritionFacts, Product
from app.services.health_score import calculate_health_score

router = APIRouter()

# Mock Barcode Catalog of popular Indian packaged food products
BARCODE_CATALOG = {
    "8901058862413": {
        "name": "Maggi 2-Minute Noodles (Masala)",
        "brand": "Nestlé",
        "ingredients": "Wheat Flour (Maida), Palm Oil, Salt, Wheat Gluten, Mineral (Calcium Carbonate), Thickener (508), Acidity Regulators (501(i) & 500(i)), Humectant (451(i)), Spices & Condiments, Onion Powder, Garlic Powder",
        "nutrition": {
            "energy_kcal": 389.0,
            "fat": 13.5,
            "saturated_fat": 6.1,
            "sugars": 1.2,
            "sodium": 1.15,  # 1.15g per 100g
            "fiber": 2.0,
            "proteins": 8.0
        },
        "nutriscore": "d",
        "nova_group": 4,
        "additives_detected": ["E508 (Thickener)", "E501(i) (Acidity Regulator)", "E500(i) (Acidity Regulator)", "E451(i) (Humectant)"],
        "allergens": ["Wheat", "Gluten"],
        "healthy_alternatives": [
            {"name": "Whole Grain Oats Granola", "reason": "Oats contain high fiber and natural honey sweetness without palm oil or high sodium."},
            {"name": "Baked Beetroot Chips", "reason": "A clean, baked whole-food snack that has low saturated fat and sodium."}
        ],
        "notes": "Contains refined flour (maida) and high palm oil fats. Extremely high sodium content detected."
    },
    "8901725181223": {
        "name": "Lays Classic Salted Chips",
        "brand": "Lay's",
        "ingredients": "Potato, Edible Vegetable Oil (Palmolein Oil), Salt",
        "nutrition": {
            "energy_kcal": 543.0,
            "fat": 33.3,
            "saturated_fat": 14.2,
            "sugars": 0.5,
            "sodium": 0.65,  # 650mg per 100g
            "fiber": 1.5,
            "proteins": 7.2
        },
        "nutriscore": "d",
        "nova_group": 4,
        "additives_detected": [],
        "allergens": [],
        "healthy_alternatives": [
            {"name": "Baked Beetroot Chips", "reason": "Prepared with cold-pressed olive oil, providing a high-fiber alternative that is low in saturated fats."}
        ],
        "notes": "High palmolein oil content triggers high saturated fat and calorie warnings."
    },
    "8902080004035": {
        "name": "Coca-Cola Classic",
        "brand": "Coca-Cola",
        "ingredients": "Carbonated Water, Sugar, Acidity Regulator (338), Caffeine, Natural Color (150d)",
        "nutrition": {
            "energy_kcal": 44.0,
            "fat": 0.0,
            "saturated_fat": 0.0,
            "sugars": 13.0,  # 13g sugar to trigger deduction
            "sodium": 0.01,
            "fiber": 0.0,
            "proteins": 0.0
        },
        "nutriscore": "e",
        "nova_group": 4,
        "additives_detected": ["E338 (Phosphoric Acid)", "E150d (Caramel Color IV)"],
        "allergens": ["Caffeine"],
        "healthy_alternatives": [
            {"name": "i-Drink Mango", "reason": "A certified clean drink sweetened with natural stevia extract and 100% natural fruit sugars."}
        ],
        "notes": "Extremely high sugar content (13g per 100ml). Contains phosphoric acid and artificial coloring additives."
    },
    "8901207040510": {
        "name": "Kurkure Masala Munch",
        "brand": "Kurkure",
        "ingredients": "Cereal Products (Corn Meal, Rice Meal), Edible Vegetable Oil (Palmolein Oil), Spices & Condiments, Salt, Maltodextrin, Flavor Enhancer (631, 627), Acidity Regulator (330)",
        "nutrition": {
            "energy_kcal": 558.0,
            "fat": 34.6,
            "saturated_fat": 15.6,
            "sugars": 1.5,
            "sodium": 0.88,  # 880mg per 100g
            "fiber": 1.0,
            "proteins": 6.1
        },
        "nutriscore": "d",
        "nova_group": 4,
        "additives_detected": ["E631 (Disodium Inosinate)", "E627 (Disodium Guanylate)", "E330 (Citric Acid)"],
        "allergens": ["Soy"],
        "healthy_alternatives": [
            {"name": "Baked Beetroot Chips", "reason": "Baked beetroot slices contain far lower fats, no artificial flavor enhancers, and high dietary fiber."}
        ],
        "notes": "Highly processed oil-fried snack. Contains flavor enhancers E631 and E627."
    },
    "8901058895053": {
        "name": "i-Drink Mango",
        "brand": "SKI Approved Alternative",
        "ingredients": "Alphonso Mango Pulp (85%), Stevia Extract, Purified Water, Vitamin C",
        "nutrition": {
            "energy_kcal": 48.0,
            "fat": 0.1,
            "saturated_fat": 0.0,
            "sugars": 4.5,
            "sodium": 0.01,
            "fiber": 3.2,
            "proteins": 0.5
        },
        "nutriscore": "a",
        "nova_group": 1,
        "additives_detected": [],
        "allergens": [],
        "healthy_alternatives": [],
        "notes": "Contains high natural fruit pulp, zero added sugars, and fortified with Vitamin C."
    }
}

@router.get("/")
def list_products() -> list[Product]:
    """Returns a list of demo products for general reference."""
    return [
        Product(
            barcode=code,
            name=details["name"],
            brand=details["brand"],
            ingredients=details["ingredients"],
            nutrition=NutritionFacts(**details["nutrition"]),
            nutriscore=details["nutriscore"],
            nova_group=details["nova_group"]
        )
        for code, details in BARCODE_CATALOG.items()
    ]

@router.get("/{barcode}")
async def get_product_by_barcode(
    barcode: str,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Looks up a food product by its barcode. 
    If found, it automatically inserts a scan history record into MongoDB for the user,
    then returns the computed health profile.
    """
    clean_barcode = barcode.strip()
    
    # 1. Search in local Catalog
    if clean_barcode in BARCODE_CATALOG:
        catalog_item = BARCODE_CATALOG[clean_barcode]
        
        # Build Product object
        product = Product(
            barcode=clean_barcode,
            name=catalog_item["name"],
            brand=catalog_item["brand"],
            ingredients=catalog_item["ingredients"],
            nutrition=NutritionFacts(**catalog_item["nutrition"]),
            nutriscore=catalog_item["nutriscore"],
            nova_group=catalog_item["nova_group"]
        )
        
        # Compute Health Score
        health = calculate_health_score(product)
        
        # Build scan document structure matching image scanner
        scan_doc = {
            "user_email": current_user["email"],
            "product": product.model_dump(),
            "health_score": health.model_dump(),
            "additives_detected": catalog_item["additives_detected"],
            "allergens": catalog_item["allergens"],
            "extraction_confidence": "high",
            "healthy_alternatives": catalog_item["healthy_alternatives"],
            "notes": catalog_item["notes"],
            "image_url": "barcode_scan",  # Special marker for frontend
            "scanned_at": datetime.utcnow()
        }
        
        # Insert scan into user's DB history
        await scans_collection.insert_one(scan_doc)
        
        # Convert _id for JSON output
        scan_doc["_id"] = str(scan_doc["_id"])
        scan_doc["scanned_at"] = scan_doc["scanned_at"].isoformat()
        
        return scan_doc

    # 2. If not found in catalog, search scans_collection in case it was scanned before
    existing_scan = await scans_collection.find_one({"product.barcode": clean_barcode})
    if existing_scan:
        # Create a new scan record for the CURRENT user
        scan_doc = {
            "user_email": current_user["email"],
            "product": existing_scan["product"],
            "health_score": existing_scan["health_score"],
            "additives_detected": existing_scan.get("additives_detected", []),
            "allergens": existing_scan.get("allergens", []),
            "extraction_confidence": existing_scan.get("extraction_confidence", "medium"),
            "healthy_alternatives": existing_scan.get("healthy_alternatives", []),
            "notes": existing_scan.get("notes"),
            "image_url": existing_scan.get("image_url", "barcode_scan"),
            "scanned_at": datetime.utcnow()
        }
        await scans_collection.insert_one(scan_doc)
        scan_doc["_id"] = str(scan_doc["_id"])
        scan_doc["scanned_at"] = scan_doc["scanned_at"].isoformat()
        return scan_doc

    # 3. Not found anywhere
    raise HTTPException(
        status_code=404,
        detail=f"Barcode '{clean_barcode}' not found in the Scan Karega India catalog. Please use the 'Upload Label' option to scan the packaging details."
    )
