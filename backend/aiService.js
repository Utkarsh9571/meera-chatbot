import { GoogleGenerativeAI } from '@google/generative-ai';
import { SystemPrompt, LearningPrompt, KnowledgeBase, Product, Location } from './models.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function buildFullPrompt(customerCity) {
  // Get active system prompt
  const systemPrompt = await SystemPrompt.findOne({ isActive: true });
  const learningPrompt = await LearningPrompt.findOne({ isActive: true });

  // Get relevant knowledge base entries
  const knowledge = await KnowledgeBase.find({ isActive: true }).select('title content');
  const knowledgeText = knowledge.map(k => `${k.title}:\n${k.content}`).join('\n\n---\n\n');

  // Get products
  const products = await Product.find({ isActive: true });
  const productsText = products.map(p => {
    const price = p.pricePerSqft ? `₹${p.pricePerSqft}/sqft` : p.priceNote || 'Custom pricing';
    return `${p.name} (${p.category}): ${p.description} | Price: ${price} | Dimensions: ${p.dimensions} | Styles: ${p.styles?.join(', ')}`;
  }).join('\n');

  // Get nearest showroom if city provided
  let showroomInfo = '';
  if (customerCity) {
    const location = await Location.findOne({
      city: { $regex: new RegExp(customerCity, 'i') },
      isActive: true
    });
    if (location) {
      showroomInfo = `\n\nNEAREST SHOWROOM for ${customerCity}:\n${location.showroomName}\n${location.address}\nContact: ${location.contact}`;
    }
  }

  const fullPrompt = `${systemPrompt?.content || ''}

=== KNOWLEDGE BASE ===
${knowledgeText}

=== PRODUCT CATALOG ===
${productsText}
${showroomInfo}

=== LEARNING CORRECTIONS (FOLLOW THESE STRICTLY) ===
${learningPrompt?.fullContent || 'No corrections yet.'}

=== IMPORTANT RULES ===
- Always respond in JSON format: { "message": "your response", "leadData": {}, "leadScore": 0, "handover": false, "handoverReason": "" }
- leadData should contain any new info collected: { name, city, productInterest, budget, area, roomType, stylePreference, timeline }
- Calculate leadScore based on the scoring model in system prompt
- Set handover: true when score >= 70 or special triggers apply
- Keep message to 3-4 lines max
- Use 1-2 emojis
- Never break character as Meera`;

  return fullPrompt;
}

async function chat(messages, leadData, customerCity) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const fullPrompt = await buildFullPrompt(customerCity || leadData?.city);

    // Format conversation history for Gemini
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chat = model.startChat({
      history: history.length > 0 ? history : undefined,
      systemInstruction: fullPrompt
    });

    const lastMessage = messages[messages.length - 1];
    const contextMessage = `Current lead data collected so far: ${JSON.stringify(leadData)}

Customer message: ${lastMessage.content}

Respond in valid JSON only: { "message": "...", "leadData": {...only new/updated fields...}, "leadScore": 0, "handover": false, "handoverReason": "" }`;

    const result = await chat.sendMessage(contextMessage);
    const responseText = result.response.text();

    // Clean and parse JSON response
    let cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned);
    return {
      message: parsed.message || "I'm here to help! What would you like to know about our products? 😊",
      leadData: parsed.leadData || {},
      leadScore: parsed.leadScore || 0,
      handover: parsed.handover || false,
      handoverReason: parsed.handoverReason || ''
    };

  } catch (err) {
    console.error('AI Error:', err.message);
    return {
      message: "Sorry, I had a small hiccup! 😅 Could you repeat that?",
      leadData: {},
      leadScore: 0,
      handover: false,
      handoverReason: ''
    };
  }
}

async function applyCorrection(originalResponse, correction) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are helping update a chatbot's learning rules.

Original bot response: "${originalResponse}"
Admin correction: "${correction}"

Generate a clear, specific rule to add to the bot's behavior guidelines.
The rule should be actionable and specific.

Respond in JSON only: { "rule": "specific rule text" }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.rule || correction;
  } catch (err) {
    return correction;
  }
}

export { chat, applyCorrection };
