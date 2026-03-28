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
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash-lite" });
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

// Extract lead data from message
function extractLeadData(message, currentLeadData) {
  const msg = message.trim();
  const msgLower = msg.toLowerCase().replace(/[^\w\s₹,+.@]/gi, ' ');
  const updated = { ...currentLeadData };
  let matched = false;

  // NAME — only if not set
  if (!updated.name) {
    const greetings = /^(hi|hello|hey|namaste|start|ok|hmm|yes|no|sure|thanks|thank you|good|great|fine)$/i;
    const words = msg.trim().split(/\s+/);
    if (!greetings.test(msg.trim()) && words.length <= 4 && words.length >= 1) {
      // Remove common prefixes
      const cleaned = msg.replace(/^(my name is|i am|this is|myself|call me)\s+/i, '').trim();
      if (cleaned.length > 1 && cleaned.length < 40) {
        updated.name = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
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
  }

  // CITY — only if not set
  if (!updated.city) {
    const cities = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'pune',
      'ahmedabad', 'kolkata', 'jaipur', 'udaipur', 'surat', 'lucknow', 'alwar',
      'gurgaon', 'noida', 'chandigarh', 'indore', 'bhopal', 'nagpur', 'coimbatore',
      'vadodara', 'kochi', 'thiruvananthapuram', 'vizag', 'patna', 'ranchi'];
    for (const c of cities) {
      if (msgLower.includes(c)) {
        updated.city = c.charAt(0).toUpperCase() + c.slice(1);
        matched = true;
        break;
      }
    }
  }

  // BUDGET — only if not set
  if (!updated.budget) {
    if (/no budget|flexible|not fixed|depend|tell me|what.s the|how much/i.test(msgLower)) {
      updated.budget = 'Flexible';
      matched = true;
    } else if (/under.?200|below.?200|less.?200|cheap|economical|affordable/i.test(msgLower)) {
      updated.budget = 'Under ₹200/sqft';
      matched = true;
    } else if (/200.?400|mid|medium|moderate/i.test(msgLower)) {
      updated.budget = '₹200-400/sqft';
      matched = true;
    } else if (/400|premium|high|luxury|\+/i.test(msgLower) && /budget|sqft|price|cost/i.test(msgLower)) {
      updated.budget = '₹400+/sqft';
      matched = true;
    } else {
      // Try to extract number
      const numMatch = msgLower.match(/(\d[\d,]*)\s*(?:k|thousand|lakh|sqft|per|\/)?/);
      if (numMatch && (msgLower.includes('₹') || msgLower.includes('rs') || msgLower.includes('budget') || msgLower.includes('price') || msgLower.includes('cost') || msgLower.includes('/sqft'))) {
        updated.budget = numMatch[0].trim();
        matched = true;
      }
    }
  }

  // AREA — only if not set
  if (!updated.area) {
    const areaMatch = msgLower.match(/(\d+)\s*(?:sqft|sq\.?\s*ft|square\s*feet?|sq|feet?)/i);
    if (areaMatch) {
      updated.area = areaMatch[1] + ' sqft';
      matched = true;
    } else if (/\d+/.test(msgLower) && /area|wall|size|cover|space/i.test(msgLower)) {
      const numMatch = msgLower.match(/(\d+)/);
      if (numMatch) { updated.area = numMatch[1] + ' sqft'; matched = true; }
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
    // Bonus if specific budget provided (not flexible)
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

// Check if manual handover triggered
function checkManualHandover(message) {
  return /\b(call|talk\s*to|speak\s*to|human|person|kabir|expert|sales|number|callback|call\s*back|order|confirm|visit|showroom)\b/i.test(message);
}

// Determine next step in conversation
function getNextStep(leadData) {
  if (!leadData.name) return 'ask_name';
  if (!leadData.productInterest) return 'ask_product';
  if (!leadData.city) return 'ask_city';
  if (!leadData.budget) return 'ask_budget';
  if (!leadData.area) return 'ask_area';
  if (!leadData.roomType) return 'ask_room';
  if (!leadData.stylePreference) return 'ask_style';
  if (!leadData.timeline) return 'ask_timeline';
  return 'recommend';
}

// Main chat function
async function chat(messages, leadData, customerCity) {
  try {
    const lastUserMsg = messages[messages.length - 1].content;

    // Extract data from message
    const { updated: updatedLeadData, matched } = extractLeadData(lastUserMsg, leadData || {});

    // Check manual handover triggers
    const manualHandover = checkManualHandover(lastUserMsg);

    // Calculate score
    const score = calculateScore(updatedLeadData);
    const autoHandover = score >= 70;
    const handover = manualHandover || autoHandover;

    // Determine next step
    const nextStep = getNextStep(updatedLeadData);

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

    // Build instruction for AI based on next step
    const stepInstructions = {
      ask_name: `Greet warmly as Meera from Hey Concrete and ask for the customer's name naturally.`,
      ask_product: `Thank ${updatedLeadData.name || 'them'} and ask what they're interested in. Offer these options naturally: Wall Panels, Breeze Blocks, Brick Cladding, or Wall Murals. Make it sound exciting!`,
      ask_city: `Ask which city they're in so you can suggest the nearest Hey Concrete showroom.`,
      ask_budget: `Ask about their approximate budget. Mention the ranges naturally: under ₹200/sqft (brick cladding), ₹200-400/sqft (popular wall panels), or ₹400+/sqft (premium). Keep it conversational.`,
      ask_area: `Ask how much wall area they want to cover, approximately in square feet. You can mention that even a 50 sqft feature wall can transform a room.`,
      ask_room: `Ask which room or space this is for — living room, bedroom, office, outdoor, etc.`,
      ask_style: `Ask about their style preference — modern, minimalist, rustic, traditional, geometric, or textured. You can briefly mention what's popular.`,
      ask_timeline: `Last question! Ask when they're planning to start — immediately, in a few months, or just exploring ideas right now.`,
      recommend: `You have all the information! Recommend 2-3 specific products based on their preferences. Be enthusiastic and specific. Then mention the nearest showroom if available. Tell them Kabir from the sales team will reach out shortly.`
    };

    const instruction = handover
      ? `Tell the customer warmly that you're connecting them with Kabir from the sales team who will reach out on WhatsApp within 15 minutes with a personalized catalog and pricing. Thank them for their interest.`
      : stepInstructions[nextStep] || stepInstructions.recommend;

    // Build the full prompt
    const prompt = `You are Meera, a warm and friendly sales consultant from Hey Concrete — a premium concrete wall panels brand in India.

CUSTOMER INFO SO FAR:
Name: ${updatedLeadData.name || 'Not provided yet'}
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

WRITING RULES:
- Write in natural Hinglish (friendly Indian English, occasional Hindi words)
- Maximum 3-4 lines per message
- Use 1-2 emojis naturally
- Use the customer's name (${updatedLeadData.name || ''}) when appropriate
- Sound like a real WhatsApp conversation, not a form
- NEVER say you are an AI or bot
- NEVER repeat a question if it was already answered
- Be warm, enthusiastic, and helpful
- If customer gave info, acknowledge it before moving on

Return ONLY the message text, nothing else.`;

    const generatedText = await generateText(prompt);
    const finalMsg = generatedText.trim().replace(/^["']|["']$/g, '').replace(/^\*+|\*+$/g, '');

    return {
      message: finalMsg,
      leadData: updatedLeadData,
      leadScore: score,
      handover,
      handoverReason: manualHandover ? 'Customer requested human' : autoHandover ? 'Lead qualified (score >= 70)' : ''
    };

  } catch (err) {
    console.error('AI Error:', err.message, err.stack);
    return {
      message: "Thoda network issue aa gaya 😅 Aap mujhe batayiye — aap kaunse product mein interested hain?",
      leadData: leadData || {},
      leadScore: 0,
      handover: false,
      handoverReason: ''
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
