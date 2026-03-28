# Meera Chatbot — Test Script & Demo Guide

## Test 1: Normal Customer Flow (Tests conversation quality + lead scoring)

Send these messages one by one and verify responses:

1. "Hi"
   EXPECT: Warm greeting as Meera, asks for name

2. "Rahul"
   EXPECT: Thanks Rahul, asks about product interest, shows options

3. "Wall Panels"
   EXPECT: Acknowledges wall panels, asks about city

4. "Mumbai"
   EXPECT: Mentions nearest Mumbai showroom, asks about budget

5. "200 to 400 per sqft"
   EXPECT: Acknowledges budget range, asks about area

6. "around 150 sqft"
   EXPECT: Acknowledges area, asks about room type

7. "living room"
   EXPECT: Acknowledges living room, asks about style

8. "modern and minimalist"
   EXPECT: Acknowledges style, asks about timeline

9. "immediate, planning this month"
   EXPECT: Recommends 2-3 specific products (Serene, Tetra, Wave), mentions showroom, says Kabir will reach out
   CHECK: Lead score should be at 70+ and handover banner should appear

---

## Test 2: Messy Input (Tests extraction robustness)

1. "hi my name is priya sharma"
   EXPECT: Extracts "Priya Sharma" as name

2. "i want breeze blocks for my garden"
   EXPECT: Extracts "breeze-blocks" AND "Outdoor" room type

3. "bangalore"
   EXPECT: Extracts city as Bangalore

4. "budget is flexible, depends on design"
   EXPECT: Extracts "Flexible" as budget, doesn't loop

5. "i need to cover about 200 sq ft"
   EXPECT: Extracts "200 sqft"

---

## Test 3: Manual Handover Triggers

1. After giving name and city, say: "Can I talk to someone?"
   EXPECT: Immediately says Kabir will reach out, handover banner shows

2. Say: "I want to place an order"
   EXPECT: Handover triggered

3. Say: "What's the export price to UAE?"
   EXPECT: Redirects to Kabir for export queries

---

## Test 4: Self-Learning Demo (Most Important for Submission)

This is what you show in the screen recording.

STEP 1 — Go to Admin Panel → Sandbox tab
STEP 2 — Start a test conversation, send "Hi"
STEP 3 — Bot responds. Note the exact response.
STEP 4 — Click on the bot's response to select it (it highlights yellow)
STEP 5 — In the correction box, type: "Instead of saying Sure, use Kyo nahi for a warmer Indian tone"
STEP 6 — Click "Apply & Train Bot"
STEP 7 — See success message: "Correction applied!"
STEP 8 — Click Reset to start fresh conversation
STEP 9 — Send "Hi" again
STEP 10 — Verify the bot now uses warmer language

ALSO SHOW:
- Learning Prompt tab → shows Version 2 is now active
- Rules list shows your correction as a rule
- Rollback button available to go back to Version 1

---

## Test 5: Knowledge Base Test

1. Ask: "How do I maintain the panels?"
   EXPECT: Answers from knowledge base about cleaning with dry cloth, avoiding chemicals

2. Ask: "What is the minimum order?"
   EXPECT: Answers 50 sqft minimum

3. Ask: "How long does installation take?"
   EXPECT: Answers about certified professional installation

---

## Screen Recording Script (2-3 mins)

MINUTE 1 — Show chatbot conversation:
- Start fresh chat
- Go through full flow: name → product → city → budget → area → room → style → timeline
- Show lead score increasing in the bar
- Show handover trigger at the end

MINUTE 2 — Show self-learning:
- Switch to Admin Panel
- Go to Sandbox
- Chat briefly
- Select a response, apply a correction
- Reset and show the bot changed behavior

MINUTE 3 — Show admin features:
- Knowledge Base tab — show entries
- Locations tab — show showrooms
- Learning Prompt tab — show version history and rollback
- Leads tab — show the conversations you just had with scores

---

## Common Issues to Check Before Submission

[ ] All conversations saving to MongoDB (check Leads tab)
[ ] Lead score updating correctly in chat UI bar
[ ] Handover banner appearing when score hits 70+
[ ] Sandbox correction creating new version in Learning Prompt tab
[ ] Rollback button working in Learning Prompt tab
[ ] Nearest showroom showing in response when city is given
[ ] Product recommendations appearing when all info collected

---

## What to Write in README Submission

Tech Stack: Node.js, Express, MongoDB Atlas, Gemini 1.5 Flash, Vanilla HTML/CSS/JS
Deployed: Render.com (backend) + Vercel (frontend)
Self-Learning: Admin panel Sandbox → select bot response → apply correction → rule saved to DB → next conversation follows new rule immediately, with full version history and rollback
WhatsApp: Gupshup webhook ready at /api/webhook/gupshup
