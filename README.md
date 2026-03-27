# Meera — Hey Concrete AI WhatsApp Chatbot

AI-powered sales chatbot for Hey Concrete built for the Clara.ai hiring task.

**Live Demo:** [YOUR_FRONTEND_URL]  
**Admin Panel:** [YOUR_FRONTEND_URL]/admin.html  
**Backend API:** [YOUR_BACKEND_URL]

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Engine | Google Gemini 1.5 Flash API |
| Backend | Node.js + Express |
| Database | MongoDB Atlas |
| Frontend | Vanilla HTML/CSS/JS (WhatsApp UI) |
| Deployment | Render.com (backend) + Vercel (frontend) |
| WhatsApp | Gupshup API (webhook ready) |

---

## Features Built

### ✅ Meera Persona
Warm, friendly consultant persona. WhatsApp-style UI with green theme. Natural conversation flow collecting lead information in order — name, product interest, city, budget, area, room type, style preference, timeline.

### ✅ Lead Scoring
Automatic scoring out of 100 based on 5 factors:
- Budget Alignment (30 pts)
- Space/Area Known (20 pts)
- Design Interest (15 pts)
- Timeline (10 pts)
- Engagement Quality (25 pts)

Score ≥ 70 triggers automatic handover to Kabir (sales team).

### ✅ Self-Learning System (Key Feature)
Admin panel Sandbox tab allows:
1. Test conversations with Meera
2. Click any bot response to select it
3. Type a correction ("Instead of X, say Y")
4. Click Apply — AI generates a rule, adds to Learning Prompt
5. Next conversation immediately follows the new rule
6. Full version history with one-click rollback

### ✅ Knowledge Base Management
Admin panel allows adding, editing product FAQs, pricing info, installation guides — all without code changes or redeployment.

### ✅ Locations Management
All 25+ showroom locations stored in database. Bot automatically suggests nearest showroom when customer shares city.

### ✅ Product Catalog
All Hey Concrete products pre-loaded: Wall Panels (8+ designs), Breeze Blocks (4 designs), Brick Cladding (3 types), Wall Murals (3 designs). Images mapped from Google Drive.

### ✅ Gupshup WhatsApp Integration
Webhook endpoint ready at `/api/webhook/gupshup`. Architecture:
- Gupshup sends incoming messages to webhook URL
- Backend processes through same chat pipeline
- Response sent back via Gupshup outbound API

---

## How to Run Locally

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/meera-chatbot

# Backend setup
cd backend
npm install
cp .env.example .env
# Add your MONGODB_URI and GEMINI_API_KEY to .env

# Seed database
node src/seed.js

# Start backend
npm run dev

# Frontend — open in browser
open frontend/index.html
# Update API_URL in index.html and admin.html to http://localhost:3000
```

---

## Environment Variables

```
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=AIza...
PORT=3000
FRONTEND_URL=https://your-frontend-url.vercel.app
```

---

## Gupshup WhatsApp Setup

1. Create account at gupshup.io
2. Create a WhatsApp channel
3. Set webhook URL to: `https://YOUR_BACKEND/api/webhook/gupshup`
4. Add Gupshup API key to environment variables
5. Add outbound message sending in `/api/webhook/gupshup` route using Gupshup's send message API

---

## Admin Panel Tabs

| Tab | Purpose |
|-----|---------|
| Dashboard | Conversation stats, recent leads |
| Sandbox | Test bot, apply corrections |
| Learning Prompt | View rules, version history, rollback |
| Knowledge Base | Add/edit product FAQs and info |
| Locations | Manage showroom data |
| System Prompt | Edit Meera's base personality |
| Leads | All conversations with lead scores |

---

*Built by Utkarsh Sharma for Clara.ai hiring task — March 2026*
