const mongoose = require('mongoose');

// KNOWLEDGE BASE — product FAQs, material info, pricing
const KnowledgeBaseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, enum: ['product', 'faq', 'installation', 'pricing', 'general'], default: 'general' },
  content: { type: String, required: true },
  tags: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// PRODUCTS — wall panels, breeze blocks, brick cladding, murals
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ['wall-panels', 'breeze-blocks', 'brick-cladding', 'wall-murals'], required: true },
  description: String,
  pricePerSqft: Number,
  priceNote: String,
  dimensions: String,
  thickness: String,
  imageUrl: String,
  imageDriveId: String,
  styles: [String],
  colors: [String],
  isActive: { type: Boolean, default: true }
});

// LOCATIONS — showrooms across India
const LocationSchema = new mongoose.Schema({
  city: { type: String, required: true },
  state: String,
  showroomName: String,
  address: String,
  contact: String,
  email: String,
  isActive: { type: Boolean, default: true }
});

// SYSTEM PROMPT — base AI personality and behavior
const SystemPromptSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  content: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String, default: 'admin' }
});

// LEARNING PROMPT — self-learning corrections from admin
const LearningPromptSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  rules: [{ 
    rule: String, 
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: String, default: 'admin' }
  }],
  fullContent: { type: String, default: '' },
  isActive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// CONVERSATION — chat sessions
const ConversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  channel: { type: String, enum: ['web', 'whatsapp', 'sandbox'], default: 'web' },
  customerPhone: String,
  leadData: {
    name: String,
    city: String,
    productInterest: String,
    budget: String,
    area: String,
    roomType: String,
    stylePreference: String,
    timeline: String
  },
  leadScore: { type: Number, default: 0 },
  leadStatus: { type: String, enum: ['active', 'qualified', 'handed-over', 'dormant', 'cold'], default: 'active' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  handoverTriggered: { type: Boolean, default: false },
  handoverReason: String,
  followUpLayer: { type: Number, default: 0 },
  lastFollowUpAt: Date,
  lastMessageAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// ADMIN CORRECTION LOG
const CorrectionLogSchema = new mongoose.Schema({
  originalResponse: String,
  correction: String,
  ruleAdded: String,
  learningPromptVersion: Number,
  addedAt: { type: Date, default: Date.now }
});

module.exports = {
  KnowledgeBase: mongoose.model('KnowledgeBase', KnowledgeBaseSchema),
  Product: mongoose.model('Product', ProductSchema),
  Location: mongoose.model('Location', LocationSchema),
  SystemPrompt: mongoose.model('SystemPrompt', SystemPromptSchema),
  LearningPrompt: mongoose.model('LearningPrompt', LearningPromptSchema),
  Conversation: mongoose.model('Conversation', ConversationSchema),
  CorrectionLog: mongoose.model('CorrectionLog', CorrectionLogSchema)
};
