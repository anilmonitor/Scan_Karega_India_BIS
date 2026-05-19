# Scan Karega India (SKI)

Scan Karega India is an AI-powered food quality monitoring and label analysis platform. It enables users to upload photos of packaged food and drink labels, instantly extracts ingredient list and nutrition details using **Google Gemini Vision**, computes a comprehensive health score based on official FSSAI/BIS guidelines, and suggests cleaner, local Indian alternatives.

**Tagline:** *Scan Karega India, Healthy banega India*

Ready to Scan Your Food?

---

## Key Interactive Features

The SKI platform includes the following user-facing and backend features:

1. **Google OAuth & Mock Login Bypass**
   - Secure authentication using Google Accounts (`/api/auth/google/login`).
   - Developer/Testing **Mock Login** bypass (`/api/auth/mock/login`) for quick dashboard access without configuring OAuth credentials.

2. **Personalized Health & Identity Profile**
   - Customized user profile dashboard tracks demographic and medical attributes (Name, Gender, Blood Group, Diabetic Status, Allergies, and other Medical/Health conditions).
   - Profiles help users align food scanning recommendations to their specific bodily requirements.
   - **Account Deletion Option**: Users can permanently wipe their profile and linked historical scan records from MongoDB.

3. **Dual-Mode Scanner (Upload & Live Camera)**
   - Supports both drag-and-drop file upload and real-time device camera scanning.
   - **Label Capture Mode**: Take a photo of the food ingredients label using a web camera, then send it to the Gemini OCR backend.
   - **Barcode Scanner Mode**: Point the camera at a product barcode to automatically detect and decode the value (uses browser's native `BarcodeDetector` API) and query the catalog backend. Also provides manual barcode search and quick-test mock buttons for instant lookup testing.
   - Integrates with the Google Gemini Pro API (`gemini-2.5-flash` model) to perform OCR and structured data extraction from captured product labels.
   - Extracts product name, brand, ingredients list, nutrition facts (energy, fat, saturated fat, sugars, sodium, fiber, proteins), allergens, additives, and NOVA classification.

4. **Dynamic Health Score Engine**
   - Automatically evaluates ingredient toxicity and calculates a score out of 100 based on NutriScore and NOVA food processing standards.
   - Displays color-coded ratings:
     - 🟢 **Healthy** (Score 75 - 100)
     - 🟡 **Moderate** (Score 50 - 74)
     - 🔴 **Needs Caution** (Score 0 - 49)

5. **Interactive Clean Alternatives Engine**
   - Automatically detects if the scanned food is unhealthy (high sugars, sodium, palm oil, or excessive additives).
   - Generates organic, traditional, and clean local Indian product recommendations (e.g., swapping a high-sugar Mango drink with stevia-sweetened *i-Drink Mango*).

6. **Interactive Scan History Gallery & Detailed Drawer**
   - Keep a history of all scan profiles in MongoDB.
   - Beautiful dashboard grid with hover effects displaying product cards.
   - Clicking a card opens a detailed glassmorphic drawer containing:
     - Circular health score indicator.
     - Highlighted health metrics reasons (e.g., "High sugar content").
     - Clear nutrition facts table per 100g.
     - Detected chemical additives and allergens.
     - Custom recommendations for healthy swaps.
     - Full ingredient list text.

7. **Floating AI Chat Health Assistant Bot**
   - A floating interactive chat bot pre-populated with a friendly greeting.
   - Quick suggestion chips for prompt insights: **Palm Oil?**, **NOVA-4?**, and **Healthy Drink?**.
   - Keyword-recognition algorithm triggers detailed responses explaining NOVA processing scales, daily sugar thresholds, palm oil cholesterol risks, and specific product swaps.
   - Fully responsive modal backdrop overlay for mobile screens.

8. **Premium Glassmorphic Design System**
   - Curated HSL dark/light colors, glass panels, dynamic laser-scanning simulator preview animations, and smooth transitions.
   - Responsive layouts featuring a mobile-specific carousel slider for browsing gallery products on small screens.

---

## Tech Stack

### Frontend
- **Framework:** React 18 & Vite
- **Styling:** Premium Custom Vanilla CSS (Glassmorphism, animations, responsive design)
- **API Layer:** Browser `fetch` API with JWT state synchronization

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **Runner:** Uvicorn
- **ODM / Database Client:** Motor (Async MongoDB Driver)
- **Validation:** Pydantic v2
- **Agent Integration:** Gemini API (using `httpx` to access `gemini-2.5-flash`)

### Database
- **Engine:** MongoDB (Local or Atlas)
- **Collections:**
  - `users`: User profile documents, login stamps, and medical attributes.
  - `scans`: Saved history entries linking user email, uploaded image data URI, product model, calculated health score, and Gemini-recommended alternatives.

---

## Project Structure

```text
.
├── Readme.md                 # Project documentation
├── package.json              # Workspace start scripts
├── render.yaml               # Render blueprint for cloud deployment
├── scripts/
│   ├── dev.js                # Cross-platform development server runner
│   └── dev.sh                # Bash development script
└── ski-project/
    ├── backend/
    │   ├── .env.example      # Backend environment template
    │   ├── requirements.txt  # Python requirements
    │   └── app/
    │       ├── main.py       # FastAPI application entry point
    │       ├── core/
    │       │   ├── auth.py   # JWT & security logic
    │       │   ├── config.py # Application configurations loader
    │       │   └── db.py     # MongoDB connection setup
    │       ├── models/
    │       │   └── product.py# Pydantic schemas for data validation
    │       ├── routes/
    │       │   ├── auth.py   # User registration, profiles, deletion & login routes
    │       │   ├── health_score.py # Scaffolded scoring route
    │       │   ├── image_scan.py   # OCR uploading, Gemini integration & history routes
    │       │   ├── products.py     # Demo product endpoint
    │       │   └── scan.py         # Barcode scan mock endpoint
    │       └── services/
    │           └── health_score.py # Core health scoring algorithm
    └── frontend/
        ├── .env.example      # Frontend API URL environment template
        ├── package.json      # React dependencies & scripts
        ├── vite.config.js    # Vite configuration file
        └── src/
            ├── App.jsx       # Global application container & page routers
            ├── main.jsx      # React entry point
            ├── styles.css    # Premium CSS design system & styles
            └── components/
                ├── About.jsx       # About page, BIS standards info, & Team Kranti list
                ├── ChatWidget.jsx  # Floating AI Health Bot widget
                ├── Dashboard.jsx   # Logged-in workspace, history gallery, & drawer modal
                ├── Footer.jsx      # Application page footer
                ├── Home.jsx        # Landing page, simulator, & product rating carousel
                ├── Navbar.jsx      # Top navigation header
                └── ImageUpload/
                    └── ImageUpload.jsx # Drag-and-drop file uploader & scanner visualizer
```

---

## Prerequisites

- **Node.js:** v18 or higher & npm
- **Python:** v3.10 or higher
- **MongoDB:** A local MongoDB server running at `mongodb://localhost:27017`
- **API Key:** A Google Gemini API key

---

## Environment Setup

### 1. Backend Environment Configuration
Navigate to the backend directory and copy the template:
```bash
cd ski-project/backend
cp .env.example .env
```

Open `ski-project/backend/.env` and update the parameters:
```env
MONGODB_URL=mongodb://localhost:27017
DB_NAME=Scan_karega_INDIA
GEMINI_API_KEY=your-google-gemini-api-key-here
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
ALLOWED_ORIGINS=["http://localhost:5173","http://localhost:3000"]

# Google OAuth Credentials (Optional: Use mock login bypass in development)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

### 2. Frontend Environment Configuration
Navigate to the frontend directory and copy the template:
```bash
cd ../frontend
cp .env.example .env
```

Set the API URL inside `ski-project/frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

---

## Installation & Setup

### 1. Set Up Backend Virtual Environment
Ensure your local MongoDB instance is started. Then setup the Python virtual environment and install dependencies:
```bash
cd ski-project/backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate

# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Set Up Frontend Dependencies
```bash
cd ../frontend
npm install
```

---

## Run Locally

You can launch both the frontend and backend concurrently using the workspace script. From the **repository root directory**, run:
```bash
npm run dev
```
*This invokes `scripts/dev.js` which spins up both the FastAPI backend (`http://localhost:8000`) and the Vite development server (`http://localhost:5173`).*

### Alternative: Run Individually
- **Start Backend:**
  ```bash
  cd ski-project/backend
  # Activate venv
  uvicorn app.main:app --reload
  ```
- **Start Frontend:**
  ```bash
  cd ski-project/frontend
  npm run dev
  ```

---

## API Endpoints

### 🔑 Authentication Routes (`/api/auth`)
- **GET** `/google/login` - Redirects users to Google's OAuth consent screen.
- **GET** `/google/callback` - Callback handler that creates/updates the user and issues a JWT token.
- **GET** `/mock/login` - Generates a mock session token bypassing OAuth.
- **GET** `/me` - Returns logged-in user profile attributes.
- **POST** `/me/update` - Modifies demographic and health attributes (Allergies, diabetic status, etc.).
- **DELETE** `/me/delete` - Deletes user account and wipes their scan logs.

### 📸 Scanning & OCR Routes (`/api/image-scan`)
- **POST** `/` - Multi-part file upload of label images. Saves the file locally, base64 encodes it, requests Gemini extraction, calculates health score, logs the entry, and returns the analysis.
- **GET** `/my-scans` - Returns scan history for the current user (newest first).

### 🧪 Standard scoring & product endpoints
- **POST** `/api/health-score` - Scores a custom JSON product payload.
- **GET** `/api/products` - Returns a list of mock products in the catalog.
- **GET** `/api/products/{barcode}` - Looks up a product by barcode, saves the scan entry to MongoDB, and returns the health score results.
- **GET** `/api/scan` - Returns barcode scanner status message.

---

## Health Score Deduction Logic

The score calculation begins at a baseline of **100** and adjusts downwards or upwards depending on the extracted nutritional content per 100g / 100ml:

| Parameter | Condition | Adjustment | Reason Logged |
| :--- | :--- | :--- | :--- |
| **Sugars** | `> 12g` | `-25 points` | High sugar content |
| | `< 5g` | No penalty | Low sugar content |
| **Sodium** | `> 600mg` | `-20 points` | High sodium content |
| | `< 120mg` | No penalty | Low sodium content |
| **Saturated Fat** | `> 5g` | `-15 points` | High saturated fat |
| **NOVA Group** | `Group 4` (Ultra-processed) | `-20 points` | Ultra-processed food |
| **Dietary Fiber** | `>= 3g` | `+5 points` (Max 100) | Good fiber content |

---

## Team Kranti

- **Koushal Kishor Vishwakarma** (Team Leader)
- **Saba Alam** (Operations Lead)
- **Abhinav Kumar** (Technical Lead)
- **Anil Kumar** (Developer)

---

## License

This project is licensed under the [MIT License](LICENSE).
