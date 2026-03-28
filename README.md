# Meera — Hey Concrete AI WhatsApp Chatbot

AI-powered sales chatbot for Hey Concrete built for the Clara.ai hiring task.

**Live Demo:** [https://meera-chatbot-h2x8.vercel.app/]  
**Admin Panel:** [https://meera-chatbot-h2x8.vercel.app/admin.html]  
**Backend API:** [https://meera-chatbot-1.onrender.com]

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Engine | Google Gemini 2.5 Flash Lite (ESM) |
| Backend | Node.js + Express (API-only architecture) |
| Database | MongoDB Atlas |
| Frontend | Vanilla HTML/CSS/JS (WhatsApp UI) |
| Deployment | Render.com (backend) + Vercel (frontend) |
| WhatsApp | Gupshup API (webhook ready) |

---

## Architecture & Logic

### 🧠 Deterministic Lead Flow (New)
Unlike generic chatbots, Meera uses a **State-Machine Logic** in the backend:
1. **Extraction**: Backend uses robust regex and fuzzy matching to save lead data (Name, City, Budget, etc.).
2. **Logic**: Node.js calculates exactly which question is next (Name → Product → City → Budget → Area → Room → Style → Timeline).
3. **Styling**: Google Gemini is used ONLY to rewrite the instruction into a friendly, natural Hinglish WhatsApp message. This prevents the bot from hallucinating or going off-track.

### ✅ Lead Scoring (100 pts)
Points are awarded as data is collected:
- **Name**: 5 pts
- **Product Interest**: 10 pts
- **City**: 10 pts
- **Budget Alignment**: 25 pts
- **Area/Size**: 20 pts
- **Room Type**: 10 pts
- **Style Preference**: 10 pts
- **Timeline**: 10 pts

**Score ≥ 70** triggers automatic handover to **Kabir** (sales team expert).

### ✅ Self-Learning System
Admin panel Sandbox tab allows:
1. Test conversations with Meera.
2. Click any bot response to select it.
3. Type a correction ("Instead of asking X, say Y").
4. **Apply**: AI generates a rule and saves it to the database. Meera immediately adopts the new behavior.

---

## Project Structure

```text
/backend
  ├── server.js      # API routes & initialization
  ├── aiService.js   # Extraction & Gemini integration
  ├── models.js      # Mongoose schemas
  └── .env           # Backend secrets
/frontend
  ├── index.html     # WhatsApp Chat UI
  └── admin.html     # Dashboard & Sandbox
```

---

## How to Run Locally

```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/meera-chatbot

# 2. Backend setup
cd backend
npm install
# Add MONGO_URI and GEMINI_API_KEY to backend/.env

# 3. Start backend
npm start

# 4. Frontend
# Simply open /frontend/index.html in your browser.
# Ensure API_URL in index.html points to http://localhost:5000
```

---

## Environment Variables (backend/.env)

```env
MONGO_URI=mongodb+srv://...
GEMINI_API_KEY=AIza...
PORT=5000
```

---

*Built by Utkarsh Sharma for Clara.ai hiring task — March 2026*
