import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateText } from "./aiService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import express, { json as _json } from 'express';
import { connect } from 'mongoose';
import cors from 'cors';
import { randomUUID as uuidv4 } from 'crypto';
import { Conversation, LearningPrompt, SystemPrompt, KnowledgeBase, Product, Location, CorrectionLog } from './models.js';
import { chat, applyCorrection } from './aiService.js';

const app = express();
app.use(cors({ origin: '*' }));
app.use(_json());

// Connect MongoDB
connect(process.env.MONGO_URI || process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('🔥 FULL ERROR:', err));

// Helper to generate session ID
function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================
// HEALTH & TEST ROUTES
// ============================================================

app.get('/', (req, res) => {
  res.send('Backend running');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// CHAT ROUTES
// ============================================================

// Start or continue a conversation
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message, channel = 'web' } = req.body;
    
    console.log(`\n[CHAT INCOMING] Session: ${sessionId || 'NEW'}, Channel: ${channel}`);
    console.log(`[CHAT MESSAGE] ${message}`);

    if (!message) return res.status(400).json({ error: 'Message required' });

    // Get or create conversation
    let conversation;
    const sid = sessionId || generateSessionId();

    if (sessionId) {
      console.log(`[CHAT FETCH] Fetching conversation: ${sessionId}`);
      conversation = await Conversation.findOne({ sessionId });
    }

    if (!conversation) {
      console.log(`[CHAT CREATE] Creating new conversation: ${sid}`);
      conversation = new Conversation({
        sessionId: sid,
        channel,
        messages: [],
        leadData: {},
        leadScore: 0
      });
    }

    // Add user message
    conversation.messages.push({ role: 'user', content: message });
    conversation.lastMessageAt = new Date();

    console.log("BEFORE leadData:", conversation.leadData);

    // Get AI response
    console.log(`[CHAT AI] Starting AI call...`);
    const aiResponse = await chat(
      conversation.messages,
      conversation.leadData,
      conversation.leadData?.city
    );

    console.log(`[CHAT AI RESPONSE]`, JSON.stringify(aiResponse));

    if (!aiResponse || !aiResponse.message) {
      throw new Error("Invalid AI response");
    }

    // Update lead data
    console.log("AFTER leadData:", aiResponse.leadData);
    conversation.leadData = aiResponse.leadData;
    conversation.markModified('leadData'); // Required to persist Mongoose object changes

    // Update lead score
    if (aiResponse.leadScore > conversation.leadScore) {
      conversation.leadScore = aiResponse.leadScore;
    }

    // Check handover
    if (aiResponse.handover && !conversation.handoverTriggered) {
      conversation.handoverTriggered = true;
      conversation.handoverReason = aiResponse.handoverReason;
      conversation.leadStatus = 'handed-over';
    }

    // Add assistant message
    conversation.messages.push({ role: 'assistant', content: aiResponse.message });

    console.log(`[CHAT DB] Saving conversation updates...`);
    await conversation.save();
    console.log(`[CHAT SAVED] Checkpoint complete.`);

    res.json({
      sessionId: sid,
      message: aiResponse.message,
      leadScore: conversation.leadScore,
      handover: conversation.handoverTriggered,
      handoverReason: conversation.handoverReason
    });

  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Get conversation history
app.get('/api/chat/:sessionId', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ sessionId: req.params.sessionId });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================================================
// ADMIN — SELF-LEARNING SYSTEM
// ============================================================

// Get current learning prompt
app.get('/api/admin/learning-prompt', async (req, res) => {
  try {
    const prompt = await LearningPrompt.findOne({ isActive: true });
    res.json(prompt);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Get all learning prompt versions (for rollback)
app.get('/api/admin/learning-prompt/versions', async (req, res) => {
  try {
    const versions = await LearningPrompt.find({}).sort({ version: -1 });
    res.json(versions);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Add a correction — SELF LEARNING
app.post('/api/admin/correction', async (req, res) => {
  try {
    const { originalResponse, correction } = req.body;
    if (!correction) return res.status(400).json({ error: 'Correction required' });

    // Generate rule from correction using AI
    const rule = await applyCorrection(originalResponse || '', correction);

    // Get current learning prompt
    const current = await LearningPrompt.findOne({ isActive: true });
    const currentVersion = current?.version || 0;

    // Create new version
    const newRules = [...(current?.rules || []), { rule, addedAt: new Date() }];
    const newContent = newRules.map((r, i) => `${i + 1}. ${r.rule}`).join('\n');

    // Deactivate old version
    if (current) {
      await LearningPrompt.updateMany({}, { isActive: false });
    }

    // Create new active version
    const newPrompt = await LearningPrompt.create({
      version: currentVersion + 1,
      rules: newRules,
      fullContent: newContent,
      isActive: true
    });

    // Log correction
    await CorrectionLog.create({
      originalResponse,
      correction,
      ruleAdded: rule,
      learningPromptVersion: newPrompt.version
    });

    res.json({
      success: true,
      rule,
      version: newPrompt.version,
      totalRules: newRules.length
    });

  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Rollback to a previous learning prompt version
app.post('/api/admin/learning-prompt/rollback/:version', async (req, res) => {
  try {
    const version = parseInt(req.params.version);
    const target = await LearningPrompt.findOne({ version });
    if (!target) return res.status(404).json({ error: 'Version not found' });

    await LearningPrompt.updateMany({}, { isActive: false });
    target.isActive = true;
    await target.save();

    res.json({ success: true, activeVersion: version });
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Update system prompt
app.post('/api/admin/system-prompt', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const current = await SystemPrompt.findOne({ isActive: true });
    const currentVersion = current?.version || 0;

    await SystemPrompt.updateMany({}, { isActive: false });

    const newPrompt = await SystemPrompt.create({
      version: currentVersion + 1,
      content,
      isActive: true
    });

    res.json({ success: true, version: newPrompt.version });
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Get system prompt
app.get('/api/admin/system-prompt', async (req, res) => {
  try {
    const prompt = await SystemPrompt.findOne({ isActive: true });
    res.json(prompt);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================================================
// ADMIN — KNOWLEDGE BASE
// ============================================================

app.get('/api/admin/knowledge', async (req, res) => {
  try {
    const entries = await KnowledgeBase.find({}).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.post('/api/admin/knowledge', async (req, res) => {
  try {
    const entry = await KnowledgeBase.create(req.body);
    res.json(entry);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.put('/api/admin/knowledge/:id', async (req, res) => {
  try {
    const entry = await KnowledgeBase.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    res.json(entry);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.delete('/api/admin/knowledge/:id', async (req, res) => {
  try {
    await KnowledgeBase.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================================================
// ADMIN — LOCATIONS
// ============================================================

app.get('/api/admin/locations', async (req, res) => {
  try {
    const locations = await Location.find({}).sort({ city: 1 });
    res.json(locations);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.post('/api/admin/locations', async (req, res) => {
  try {
    const location = await Location.create(req.body);
    res.json(location);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.put('/api/admin/locations/:id', async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(location);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================================================
// ADMIN — PRODUCTS
// ============================================================

app.get('/api/admin/products', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ category: 1, name: 1 });
    res.json(products);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================================================
// ADMIN — CONVERSATIONS & LEADS
// ============================================================

app.get('/api/admin/conversations', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const query = status ? { leadStatus: status } : {};
    const conversations = await Conversation.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(parseInt(limit))
      .select('-messages');
    res.json(conversations);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.get('/api/admin/conversations/:sessionId', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ sessionId: req.params.sessionId });
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    res.json(conversation);
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ============================================================
// GUPSHUP WEBHOOK (WhatsApp integration)
// ============================================================

app.post('/api/webhook/gupshup', async (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) return res.status(200).json({ success: true });

    const phone = payload.sender?.phone;
    const message = payload.payload?.text || payload.payload?.message;
    const type = payload.payload?.type;

    if (!phone || !message || type !== 'text') {
      return res.status(200).json({ success: true });
    }

    // Find or create conversation for this phone number
    let conversation = await Conversation.findOne({
      customerPhone: phone,
      leadStatus: { $in: ['active', 'qualified'] }
    });

    const sessionId = conversation?.sessionId || generateSessionId();

    console.log(`[GUPSHUP] Received message from ${phone}: ${message}`);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("🔥 FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Meera chatbot API server running on port ${PORT}`);
});

export default app;
