import { GoogleGenerativeAI } from '@google/generative-ai';
import { LearningPrompt, Product, Location } from './models.js';

let genAI;
function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not defined");
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

async function generateText(prompt) {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const model = getGenAI().getGenerativeModel({ model: modelName });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });
  return result.response.text();
}

// Get active learning rules from DB
async function getLearningRules() {
  try {
    const lp = await LearningPrompt.findOne({ isActive: true });
    if (!lp || !lp.rules || lp.rules.length === 0) return '';
    return lp.rules.map((r, i) => `${i + 1}. ${r.rule}`).join('\n');
  } catch (err) {
    return '';
  }
}

// Get products matching interest and style
async function getMatchingProducts(productInterest, stylePreference) {
  try {
    const query = { isActive: true };
    if (productInterest) query.category = productInterest;
    const products = await Product.find(query).limit(3);
    return products;
  } catch (err) {
    return [];
  }
}

// Get nearest showroom for city
async function getNearestShowroom(city) {
  if (!city) return null;
  try {
    return await Location.findOne({ city: { $regex: new RegExp(city, 'i') }, isActive: true });
  } catch (err) {
    return null;
  }
}

// FIX: Improved area extraction — handles "around 150", "150 sqft", "150 sq ft", etc.
function extractArea(msgLower) {
  // Direct sqft mention
  const sqftMatch = msgLower.match(/(\d[\d,]*)\s*(?:sqft|sq\.?\s*ft\.?|square\s*feet?|sq\b)/i);
  if (sqftMatch) return sqftMatch[1].replace(/,/g, '') + ' sqft';

  // "around / approximately / about X" — treat as area if in area context
  const aroundMatch = msgLower.match(/(?:around|approximately|about|roughly|~)\s*(\d[\d,]+)/i);
  if (aroundMatch && /area|wall|sqft|sq|feet|cover|space|size/i.test(msgLower)) {
    return aroundMatch[1].replace(/,/g, '') + ' sqft';
  }

  // standalone number with area context keyword
  if (/area|wall|size|cover|space/i.test(msgLower)) {
    const numMatch = msgLower.match(/(\d[\d,]+)/);
    if (numMatch) return numMatch[1].replace(/,/g, '') + ' sqft';
  }

  return null;
}

// FIX: Fuzzy city matching — handles typos like "banglore", "mumbay", etc.
const CITY_ALIASES = {
  'mumbai': ['mumbai', 'bombay', 'mumbay', 'mumbei'],
  'delhi': ['delhi', 'new delhi', 'dilli', 'dehli'],
  'bangalore': ['bangalore', 'bengaluru', 'banglore', 'bangaluru', 'bengalore', 'blr'],
  'hyderabad': ['hyderabad', 'hydrabad', 'hyd', 'hydrabad'],
  'chennai': ['chennai', 'madras', 'chenai'],
  'pune': ['pune', 'puna'],
  'ahmedabad': ['ahmedabad', 'amdavad', 'ahmadabad'],
  'kolkata': ['kolkata', 'calcutta', 'kolkatta'],
  'jaipur': ['jaipur', 'jaipure'],
  'udaipur': ['udaipur', 'udaypur'],
  'surat': ['surat'],
  'lucknow': ['lucknow', 'lucknau'],
  'alwar': ['alwar'],
  'gurgaon': ['gurgaon', 'gurugram'],
  'noida': ['noida'],
  'chandigarh': ['chandigarh'],
  'indore': ['indore'],
  'bhopal': ['bhopal'],
  'nagpur': ['nagpur'],
  'coimbatore': ['coimbatore', 'coimbattur'],
  'vadodara': ['vadodara', 'baroda'],
  'kochi': ['kochi', 'cochin'],
  'thiruvananthapuram': ['thiruvananthapuram', 'trivandrum'],
  'vizag': ['vizag', 'visakhapatnam'],
  'patna': ['patna'],
  'ranchi': ['ranchi'],
  'punjab': ['punjab', 'amritsar', 'ludhiana', 'chandigarh'],
};

function extractCity(msgLower) {
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    for (const alias of aliases) {
      if (msgLower.includes(alias)) {
        return canonical.charAt(0).toUpperCase() + canonical.slice(1);
      }
    }
  }
  return null;
}

// Extract lead data from message
function extractLeadData(message, currentLeadData) {
  const msg = message.trim();
  const msgLower = msg.toLowerCase().replace(/[^\w\s₹,+.@]/gi, ' ');
  const updated = { ...currentLeadData };
  let matched = false;

  // LANGUAGE — only if not set
  // FIX: extract language FIRST so these words never get picked up as a name
  const LANGUAGE_WORDS = /^(hindi|hinglish|english|eng|हिंदी|hindi english|mix)$/i;
  if (!updated.language) {
    if (/\b(hindi|हिंदी)\b/i.test(msg) && !/hinglish/i.test(msg)) { updated.language = 'hindi'; matched = true; }
    else if (/\b(hinglish|hindi english|mix)\b/i.test(msg)) { updated.language = 'hinglish'; matched = true; }
    else if (/\b(english|eng)\b/i.test(msg)) { updated.language = 'english'; matched = true; }
  }

  // NAME — only if not set
  if (!updated.name) {
    const greetings = /^(hi|hello|hey|namaste|start|ok|hmm|yes|no|sure|thanks|thank you|good|great|fine)$/i;
    // FIX: never treat language/product/city choices as a name
    const systemChoiceWords = /^(hindi|hinglish|english|wall panels|breeze blocks|brick cladding|wall murals|mumbai|delhi|bangalore|pune|chennai|hyderabad|kolkata|jaipur|modern|minimalist|rustic|traditional|geometric|textured|immediately|exploring|living room|bedroom|office|outdoor)$/i;
    const words = msg.trim().split(/\s+/);
    if (!greetings.test(msg.trim()) && !systemChoiceWords.test(msg.trim()) && !LANGUAGE_WORDS.test(msg.trim()) && words.length <= 6 && words.length >= 1) {
      // Extract from "my name is X", "I am X", "this is X", "hi my name is X"
      const namePatterns = [
        /(?:my name is|i am|this is|myself|call me|i'm|im)\s+([A-Za-z][A-Za-z\s]{1,30})/i,
        /^(?:hi|hello|hey)[\s,!]+(?:my name is|i am|i'm|im)\s+([A-Za-z][A-Za-z\s]{1,30})/i,
      ];
      let extractedName = null;
      for (const pattern of namePatterns) {
        const m = msg.match(pattern);
        if (m) { extractedName = m[1].trim(); break; }
      }
      if (!extractedName) {
        const cleaned = msg.replace(/^(my name is|i am|this is|myself|call me)\s+/i, '').trim();
        // FIX: also exclude cleaned value if it's a system choice word
        if (cleaned.length > 1 && cleaned.length < 40 && !greetings.test(cleaned) && !systemChoiceWords.test(cleaned) && !/\d/.test(cleaned)) {
          extractedName = cleaned;
        }
      }
      if (extractedName) {
        updated.name = extractedName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        matched = true;
      }
    }
  }

  // PRODUCT INTEREST — only if not set
  if (!updated.productInterest) {
    if (/panel|wall panel/i.test(msgLower)) { updated.productInterest = 'wall-panels'; matched = true; }
    else if (/breeze|block|ventilation/i.test(msgLower)) { updated.productInterest = 'breeze-blocks'; matched = true; }
    else if (/brick|clad|rustic/i.test(msgLower)) { updated.productInterest = 'brick-cladding'; matched = true; }
    else if (/mural|art|painting/i.test(msgLower)) { updated.productInterest = 'wall-murals'; matched = true; }
    // "wall cladding" → brick-cladding
    else if (/wall\s*clad/i.test(msgLower)) { updated.productInterest = 'brick-cladding'; matched = true; }
  }

  // CITY — FIX: use fuzzy matching
  if (!updated.city) {
    const city = extractCity(msgLower);
    if (city) { updated.city = city; matched = true; }
  }

  // AREA — extract BEFORE budget so "400 sqft" never gets grabbed as a budget figure
  if (!updated.area) {
    const area = extractArea(msgLower);
    if (area) {
      updated.area = area;
      matched = true;
    }
  }

  // BUDGET — only if not already strongly set
  const looksLikeArea = /sqft|sq\.?\s*ft|square\s*feet?/i.test(msgLower);
  if (!updated.budget || updated.budget === 'Flexible') {
    if (/no budget|flexible|not fixed|depend|tell me|what.s the|how much/i.test(msgLower)) {
      updated.budget = 'Flexible';
      matched = true;
    } else if (/under.?200|below.?200|less.?200|cheap|economical|affordable/i.test(msgLower)) {
      updated.budget = 'Under ₹200/sqft';
      matched = true;
    } else if (/200.?400|mid|medium|moderate/i.test(msgLower)) {
      updated.budget = '₹200-400/sqft';
      matched = true;
    } else if (/400\s*\+|400\s*plus|premium|high end|luxury/i.test(msgLower)) {
      updated.budget = '₹400+/sqft';
      matched = true;
    } else {
      const standaloneNum = msgLower.match(/^[₹rs\.\s]*([\d,]+)\s*(?:\/sqft|\/sq|per sqft)?\s*$/);
      if (standaloneNum) {
        const num = parseInt(standaloneNum[1].replace(/,/g, ''));
        if (num <= 200) updated.budget = 'Under ₹200/sqft';
        else if (num <= 400) updated.budget = '₹200-400/sqft';
        else updated.budget = '₹400+/sqft';
        matched = true;
      }
    }
  }

  // ROOM TYPE — only if not set
  if (!updated.roomType) {
    if (/living|hall|drawing|lounge/i.test(msgLower)) { updated.roomType = 'Living Room'; matched = true; }
    else if (/bed\s*room|bedroom|master/i.test(msgLower)) { updated.roomType = 'Bedroom'; matched = true; }
    else if (/office|cabin|work|corporate|commercial/i.test(msgLower)) { updated.roomType = 'Office'; matched = true; }
    else if (/garden|outdoor|terrace|exterior|outside|compound/i.test(msgLower)) { updated.roomType = 'Outdoor'; matched = true; }
    else if (/dining|kitchen|bathroom|restaurant|hotel|cafe/i.test(msgLower)) {
      updated.roomType = msg.charAt(0).toUpperCase() + msg.slice(1).toLowerCase().match(/dining|kitchen|bathroom|restaurant|hotel|cafe/i)?.[0] || 'Other';
      matched = true;
    }
  }

  // STYLE — only if not set
  if (!updated.stylePreference) {
    if (/modern|contemporary|sleek/i.test(msgLower)) { updated.stylePreference = 'Modern'; matched = true; }
    else if (/minim|clean|simple|plain/i.test(msgLower)) { updated.stylePreference = 'Minimalist'; matched = true; }
    else if (/tradit|classic|indian|ethnic/i.test(msgLower)) { updated.stylePreference = 'Traditional'; matched = true; }
    else if (/rustic|raw|industrial|rough/i.test(msgLower)) { updated.stylePreference = 'Rustic'; matched = true; }
    else if (/geometric|pattern|abstract/i.test(msgLower)) { updated.stylePreference = 'Geometric'; matched = true; }
    else if (/texture|textured/i.test(msgLower)) { updated.stylePreference = 'Textured'; matched = true; }
  }

  // TIMELINE — only if not set
  if (!updated.timeline) {
    if (/immediate|now|soon|urgent|asap|this\s*week|this\s*month/i.test(msgLower)) { updated.timeline = 'Immediate'; matched = true; }
    else if (/\d+\s*month|few\s*month|next\s*month|3\s*month|6\s*month/i.test(msgLower)) { updated.timeline = '1-3 months'; matched = true; }
    else if (/explor|look\s*ing|just\s*check|browse|later|future|someday/i.test(msgLower)) { updated.timeline = 'Just Exploring'; matched = true; }
  }

  return { updated, matched };
}

// Calculate lead score
function calculateScore(leadData) {
  let score = 0;
  if (leadData.name) score += 5;
  if (leadData.productInterest) score += 10;
  if (leadData.city) score += 10;
  if (leadData.budget) {
    score += 25;
    if (leadData.budget !== 'Flexible') score += 5;
  }
  if (leadData.area) score += 20;
  if (leadData.roomType) score += 10;
  if (leadData.stylePreference) score += 10;
  if (leadData.timeline) {
    if (leadData.timeline === 'Immediate') score += 10;
    else if (leadData.timeline === '1-3 months') score += 7;
    else score += 3;
  }
  return Math.min(score, 100);
}

// FIX: Improved handover detection — catches more natural phrasing
function checkManualHandover(message) {
  return /\b(call|talk\s*to|speak\s*to|human|person|kabir|expert|sales|number|callback|call\s*back|order|confirm|visit|showroom|connect me|real person|actual person|someone|anybody|can i talk|chat with|get in touch)\b/i.test(message);
}

// Determine next step in conversation
function getNextStep(leadData) {
  const completed = leadData.completedSteps || [];

  if (!completed.includes('ask_language')) return 'ask_language';
  if (!completed.includes('ask_name')) return 'ask_name';
  if (!completed.includes('ask_product')) return 'ask_product';
  if (!completed.includes('ask_city')) return 'ask_city';
  if (!completed.includes('ask_budget')) return 'ask_budget';
  if (!completed.includes('ask_area')) return 'ask_area';
  if (!completed.includes('ask_room')) return 'ask_room';
  if (!completed.includes('ask_style')) return 'ask_style';
  if (!completed.includes('ask_timeline')) return 'ask_timeline';

  return 'recommend';
}

// Build quick reply suggestions for each step (returned to frontend)
function getQuickReplies(nextStep, leadData) {
  const qr = {
    ask_language: ['English', 'Hindi', 'Hinglish'],
    ask_product: ['Wall Panels', 'Breeze Blocks', 'Brick Cladding', 'Wall Murals'],
    ask_budget: ['Under ₹200/sqft', '₹200-400/sqft', '₹400+/sqft', 'Flexible'],
    ask_room: ['Living Room', 'Bedroom', 'Office', 'Outdoor'],
    ask_style: ['Modern', 'Minimalist', 'Rustic', 'Traditional'],
    ask_timeline: ['Immediately', 'In 1-3 months', 'Just Exploring'],
  };
  return qr[nextStep] || [];
}

// Main chat function
async function chat(messages, leadData, customerCity) {
  try {
    const lastUserMsg = messages[messages.length - 1].content;

    // Extract data from message
    const { updated: updatedLeadData } = extractLeadData(lastUserMsg, leadData || {});
    // Initialize completedSteps if not present
if (!updatedLeadData.completedSteps) {
  updatedLeadData.completedSteps = [];
}

// Track completed steps automatically
const stepMap = {
  language: 'ask_language',
  name: 'ask_name',
  productInterest: 'ask_product',
  city: 'ask_city',
  budget: 'ask_budget',
  area: 'ask_area',
  roomType: 'ask_room',
  stylePreference: 'ask_style',
  timeline: 'ask_timeline',
};

Object.keys(stepMap).forEach(key => {
  if (updatedLeadData[key] && !updatedLeadData.completedSteps.includes(stepMap[key])) {
    updatedLeadData.completedSteps.push(stepMap[key]);
  }
});

    // FIX: Check handover BEFORE score check so "can i talk to someone" always works
    const manualHandover = checkManualHandover(lastUserMsg);

    // Calculate score
    const score = calculateScore(updatedLeadData);
    const autoHandover = score >= 70;
    const handover = manualHandover || autoHandover;

    // Determine next step
    const nextStep = getNextStep(updatedLeadData);
    const quickReplies = getQuickReplies(nextStep, updatedLeadData);

    // Get learning rules from DB
    const learningRules = await getLearningRules();

    // Get products for recommendation if needed
    let productsContext = '';
    if (nextStep === 'recommend' || updatedLeadData.productInterest) {
      const products = await getMatchingProducts(updatedLeadData.productInterest, updatedLeadData.stylePreference);
      if (products.length > 0) {
        productsContext = '\n\nAVAILABLE PRODUCTS TO RECOMMEND:\n' + products.map(p => {
          const price = p.pricePerSqft ? `₹${p.pricePerSqft}/sqft` : p.priceNote || 'Custom pricing';
          return `- ${p.name}: ${p.description} | Price: ${price} | Dimensions: ${p.dimensions}`;
        }).join('\n');
      }
    }

    // Get showroom for city
    let showroomContext = '';
    if (updatedLeadData.city) {
      const showroom = await getNearestShowroom(updatedLeadData.city);
      if (showroom) {
        showroomContext = `\n\nNEAREST SHOWROOM: ${showroom.showroomName}, ${showroom.address}, Contact: ${showroom.contact}`;
      }
    }

    const lang = updatedLeadData.language || 'hinglish';

    // Build instruction for AI based on next step
    const stepInstructions = {
      ask_language: `Greet warmly as Meera from Hey Concrete and ask what language they prefer to chat in. Give them 3 options: English, Hindi, or Hinglish (Hindi-English mix). Do this ONLY ONCE.`,
      ask_name: `The customer has chosen ${updatedLeadData.language || 'Hinglish'} as their language. Welcome them warmly and ask for their name. Keep it very short and friendly. Do NOT ask about language again — it is already set.`,
      ask_product: `Ask ${updatedLeadData.name || 'them'} what product they're interested in. Options will be shown as buttons (Wall Panels, Breeze Blocks, Brick Cladding, Wall Murals). Don't re-introduce yourself. Do NOT ask about language again.`,
      ask_city: `Ask which city they're in so you can suggest the nearest Hey Concrete showroom. Don't re-introduce yourself. Do NOT ask about language again.`,
      ask_budget: `Ask about their approximate budget. Mention the ranges (under ₹200/sqft, ₹200-400/sqft, ₹400+/sqft) — buttons will be shown. Keep it conversational. Do NOT ask about language again.`,
      ask_area: `Ask how much wall area they want to cover approximately in square feet. Mention that even 50 sqft can transform a room. Do NOT ask about language again.`,
      ask_room: `Ask which room or space this is for. Options like living room, bedroom, office, outdoor will be shown as buttons. Do NOT ask about language again.`,
      ask_style: `Ask about their style preference. Style options (modern, minimalist, rustic, traditional, geometric, textured) will be shown as buttons. Do NOT ask about language again.`,
      ask_timeline: `Last question! Ask when they're planning to start. Timeline options will be shown as buttons. Do NOT ask about language again.`,
      recommend: `You have all the information! Recommend 2-3 specific products based on their preferences. Be enthusiastic and specific. Mention the nearest showroom if available. Tell them Kabir from the sales team will reach out shortly.`
    };

    const instruction = handover
      ? `Tell the customer warmly that you're connecting them with Kabir from the sales team who will reach out on WhatsApp within 15 minutes with a personalized catalog and pricing. Thank them for their interest. Be warm and reassuring.`
      : stepInstructions[nextStep] || stepInstructions.recommend;

    const langInstruction = lang === 'hindi'
      ? 'Write mostly in Hindi (Devanagari script is fine, or Roman Hindi). Keep it warm and friendly.'
      : lang === 'english'
        ? 'Write in clear, warm English only.'
        : 'Write in natural Hinglish (friendly Indian English with occasional Hindi words like "Namaste", "bilkul", "kya khayal hai", "bahut accha", "shukriya"). Keep it warm and conversational.';

    // Build the full prompt
    const prompt = `You are Meera, a warm and friendly sales consultant from Hey Concrete — a premium concrete wall panels brand in India.

CUSTOMER INFO SO FAR:
Name: ${updatedLeadData.name || 'Not provided yet'}
Language Preference: ${updatedLeadData.language || 'Not set yet'}
Product Interest: ${updatedLeadData.productInterest || 'Not provided yet'}
City: ${updatedLeadData.city || 'Not provided yet'}
Budget: ${updatedLeadData.budget || 'Not provided yet'}
Area: ${updatedLeadData.area || 'Not provided yet'}
Room Type: ${updatedLeadData.roomType || 'Not provided yet'}
Style: ${updatedLeadData.stylePreference || 'Not provided yet'}
Timeline: ${updatedLeadData.timeline || 'Not provided yet'}

CUSTOMER'S LAST MESSAGE: "${lastUserMsg}"

YOUR TASK: ${instruction}
${productsContext}
${showroomContext}

${learningRules ? `IMPORTANT BEHAVIOR RULES (follow strictly):\n${learningRules}\n` : ''}

LANGUAGE: ${langInstruction}

WRITING RULES:
- Maximum 3-4 lines per message
- Use 1-2 emojis naturally
- Use the customer's name (${updatedLeadData.name || ''}) when appropriate — but NOT in every message
- Sound like a real WhatsApp conversation, not a form
- NEVER say you are an AI or bot
- NEVER re-introduce yourself after the first message — the customer already knows you are Meera
- NEVER repeat a question if it was already answered
- Be warm, enthusiastic, and helpful
- If customer gave info, acknowledge it naturally before moving on
- If buttons/options are provided, just mention them naturally — don't list them all out again in your message

Return ONLY the message text, nothing else.`;

    const generatedText = await generateText(prompt);
    const finalMsg = generatedText.trim().replace(/^["']|["']$/g, '').replace(/^\*+|\*+$/g, '');

    return {
      message: finalMsg,
      leadData: updatedLeadData,
      leadScore: score,
      handover,
      handoverReason: manualHandover ? 'Customer requested human' : autoHandover ? 'Lead qualified (score >= 70)' : '',
      quickReplies,
    };

  } catch (err) {
    console.error('AI Error:', err.message, err.stack);
    return {
      message: "Thoda network issue aa gaya 😅 Aap mujhe batayiye — aap kaunse product mein interested hain?",
      leadData: leadData || {},
      leadScore: 0,
      handover: false,
      handoverReason: '',
      quickReplies: ['Wall Panels', 'Breeze Blocks', 'Brick Cladding', 'Wall Murals'],
    };
  }
}

async function applyCorrection(originalResponse, correction) {
  try {
    const prompt = `An admin is correcting a chatbot's behavior.

Original bot response: "${originalResponse}"
Admin correction: "${correction}"

Generate a clear, specific, actionable rule that the bot should follow from now on.
The rule should be concrete and specific, not vague.

Examples of good rules:
- "Use 'Kyo nahi!' instead of 'Sure!' as an affirmation"
- "Always mention the customer's name when thanking them"
- "When recommending products, always include the price"

Respond in JSON only: { "rule": "the specific rule" }`;

    const text = await generateText(prompt);
    const cleaned = text.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      return parsed.rule || correction;
    }
    return correction;
  } catch (err) {
    return correction;
  }
}


export { chat, applyCorrection, generateText };
