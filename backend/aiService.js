import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI;
function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not defined in environment variables");
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

async function generateText(prompt) {
  const model = getGenAI().getGenerativeModel({
    model: "gemini-2.5-flash-lite"
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  });

  return result.response.text();
}

async function chat(messages, leadData, customerCity) {
  try {
    const lastUserMsg = messages[messages.length - 1].content;
    const msgClean = lastUserMsg.trim().toLowerCase().replace(/[^\w\s₹,+.@]/gi, '');
    
    let updatedLeadData = { ...leadData };
    let inputMatched = false;

    // 1. IMPROVED EXTRACTION LOGIC
    
    // NAME (If not set and likely a name)
    if (!updatedLeadData.name) {
      const greeings = /^(hi|hello|hey|namaste|start|ok|hmm|yes|no)$/i;
      if (!msgClean.match(greeings) && lastUserMsg.split(' ').length <= 4) {
        updatedLeadData.name = lastUserMsg.replace(/^(my name is|i am|this is|myself)\s+/i, '').trim();
        inputMatched = true;
      }
    }

    // PRODUCT
    if (!updatedLeadData.productInterest) {
      if (msgClean.includes('panel')) { updatedLeadData.productInterest = 'wall-panels'; inputMatched = true; }
      else if (msgClean.includes('breeze') || msgClean.includes('block')) { updatedLeadData.productInterest = 'breeze-blocks'; inputMatched = true; }
      else if (msgClean.includes('brick') || msgClean.includes('clad')) { updatedLeadData.productInterest = 'brick-cladding'; inputMatched = true; }
      else if (msgClean.includes('mural') || msgClean.includes('art')) { updatedLeadData.productInterest = 'wall-murals'; inputMatched = true; }
    }

    // CITY (Expanded + Fuzzy)
    if (!updatedLeadData.city) {
      const cities = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'pune', 'ahmedabad', 'kolkata', 'jaipur', 'udaipur', 'surat', 'lucknow', 'alwar', 'gurgaon', 'noida', 'chandigarh'];
      for (let c of cities) {
        if (msgClean.includes(c)) {
          updatedLeadData.city = c.charAt(0).toUpperCase() + c.slice(1);
          inputMatched = true;
          break;
        }
      }
    }

    // BUDGET (Handles 400+, 200/sqft, 100000, no budget)
    if (!updatedLeadData.budget) {
      if (msgClean.includes('no budget') || msgClean.includes('flexible') || msgClean.includes('not fixed')) {
        updatedLeadData.budget = 'Flexible';
        inputMatched = true;
      } else {
        const budgetMatch = msgClean.match(/(\d+(?:,\d+)*(?:\s*(?:k|lakhs?|sqft|plus|+))?)/i);
        if (budgetMatch && (msgClean.includes('₹') || msgClean.includes('rs') || msgClean.includes('budget') || msgClean.includes('/') || msgClean.includes('+'))) {
          updatedLeadData.budget = budgetMatch[0].trim();
          inputMatched = true;
        }
      }
    }

    // AREA
    if (!updatedLeadData.area) {
      const areaMatch = msgClean.match(/(\d+)\s*(?:sqft|sq|ft|feet|area)?/i);
      if (areaMatch && (msgClean.includes('sq') || msgClean.includes('ft') || msgClean.includes('area') || msgClean.includes('size'))) {
        updatedLeadData.area = areaMatch[1] + ' sqft';
        inputMatched = true;
      }
    }

    // ROOM TYPE (Typo handling)
    if (!updatedLeadData.roomType) {
      if (msgClean.includes('living') || msgClean.includes('vroom') || msgClean.includes('hall')) { updatedLeadData.roomType = 'living room'; inputMatched = true; }
      else if (msgClean.includes('bed') || msgClean.includes('room')) { updatedLeadData.roomType = 'bedroom'; inputMatched = true; }
      else if (msgClean.includes('office') || msgClean.includes('cabin') || msgClean.includes('work')) { updatedLeadData.roomType = 'office'; inputMatched = true; }
      else if (msgClean.includes('out') || msgClean.includes('ext') || msgClean.includes('gar') || msgClean.includes('terrace')) { updatedLeadData.roomType = 'outdoor'; inputMatched = true; }
    }

    // STYLE
    if (!updatedLeadData.stylePreference) {
      if (msgClean.includes('modern')) { updatedLeadData.stylePreference = 'modern'; inputMatched = true; }
      else if (msgClean.includes('minim')) { updatedLeadData.stylePreference = 'minimalist'; inputMatched = true; }
      else if (msgClean.includes('tradit')) { updatedLeadData.stylePreference = 'traditional'; inputMatched = true; }
      else if (msgClean.includes('rustic') || msgClean.includes('raw')) { updatedLeadData.stylePreference = 'rustic'; inputMatched = true; }
    }

    // TIMELINE
    if (!updatedLeadData.timeline) {
      if (msgClean.match(/\b(immediate|now|soon|urgent|asap)\b/)) { updatedLeadData.timeline = 'Immediate'; inputMatched = true; }
      else if (msgClean.match(/\b(month|week|days|soon)\b/)) { updatedLeadData.timeline = '1-3 months'; inputMatched = true; }
      else if (msgClean.match(/\b(explore|look|check|just)\b/)) { updatedLeadData.timeline = 'Exploring'; inputMatched = true; }
    }

    // 2. DETERMINISTIC FLOW CONTROL
    let baseMessage = "";
    let handoverTriggered = false;
    let nextStepMessage = "";

    if (!updatedLeadData.name) {
      nextStepMessage = "Warmly say hello! Introduce yourself as Meera from Hey Concrete and ask for their name.";
    } else if (!updatedLeadData.productInterest) {
      nextStepMessage = `Thank you, ${updatedLeadData.name}! Ask what they are looking for: Wall Panels, Breeze Blocks, Brick Cladding, or Wall Murals.`;
    } else if (!updatedLeadData.city) {
      nextStepMessage = "Ask which city they are located in so we can suggest the nearest showroom or check delivery.";
    } else if (!updatedLeadData.budget) {
      nextStepMessage = "Ask for their approximate budget. Mention we have premium options starting from ₹200/sqft and going up based on design.";
    } else if (!updatedLeadData.area) {
      nextStepMessage = "Ask for the total estimated wall area they want to cover (in square feet).";
    } else if (!updatedLeadData.roomType) {
      nextStepMessage = "Ask which specific room or area this is for (e.g., Living Room, Bedroom, Exterior, etc.).";
    } else if (!updatedLeadData.stylePreference) {
      nextStepMessage = "Ask about their preferred design style (Modern, Minimalist, Rustic, or Traditional).";
    } else if (!updatedLeadData.timeline) {
      nextStepMessage = "Final question! Ask when they plan to start this project (Immediate, in a few months, or just exploring).";
    } else {
      updatedLeadData.leadStatus = "qualified";
      handoverTriggered = true;
      nextStepMessage = "Great! You have all the details. Tell the user that Kabir from our sales team will reach out to them on WhatsApp within 15 minutes with personalized catalog and pricing.";
    }

    // Handling "ok/hmm" junk input - repeat question gently
    if (!inputMatched && updatedLeadData.name && !handoverTriggered) {
      baseMessage = `The user said "${lastUserMsg}". Acknowledge politely and gently repeat the request: ${nextStepMessage}`;
    } else {
      baseMessage = nextStepMessage;
    }

    // Manual Handover Triggers
    if (msgClean.match(/\b(call|talk|human|person|kabir|expert|number)\b/)) {
      handoverTriggered = true;
      baseMessage = "Acknowledge their request to speak with a person. Let them know Kabir will call or message them shortly.";
    }

    // 3. GENERATE HUMAN PHRASING
    const prompt = `You are Meera, a friendly and professional sales consultant from Hey Concrete.

Context for response: "${baseMessage}"
User Name: ${updatedLeadData.name || "User"}

RULES:
- Speak DIRECTLY to the user (use "Aap", "You", "Aapka").
- NEVER use third-person (e.g., dont say "They are looking for").
- Tone: Friendly, natural Hinglish (conversational Indian English).
- Max 2 short lines.
- Use 1 relevant emoji.
- Sound like a real person on WhatsApp, not a bot.
- DO NOT add extra questions not implied by the context.
- Return ONLY the message text.`;

    const generatedText = await generateText(prompt);
    let finalMsg = generatedText.trim().replace(/^["']|["']$/g, '');

    // 4. SCORE CALCULATION
    let score = 0;
    if (updatedLeadData.name) score += 5;
    if (updatedLeadData.productInterest) score += 10;
    if (updatedLeadData.city) score += 10;
    if (updatedLeadData.budget) score += 25;
    if (updatedLeadData.area) score += 20;
    if (updatedLeadData.roomType) score += 10;
    if (updatedLeadData.stylePreference) score += 10;
    if (updatedLeadData.timeline) score += 10;

    if (score >= 70) handoverTriggered = true;

    return {
      message: finalMsg,
      leadData: updatedLeadData,
      leadScore: Math.min(score, 100),
      handover: handoverTriggered,
      handoverReason: handoverTriggered ? "Lead qualified or requested assistance" : ""
    };

  } catch (err) {
    console.error('AI Error:', err.message);
    return {
      message: "Thoda network issue lag raha hai 😊 Aapka load ho raha hai, tab tak batayiye aap kis city se hain?",
      leadData: leadData || {},
      leadScore: 0,
      handover: false,
      handoverReason: ''
    };
  }
}

async function applyCorrection(originalResponse, correction) {
  try {
    const prompt = `Update behavior rule:
Original: ${originalResponse}
Correction: ${correction}
Return JSON: { "rule": "actionable rule" }`;
    const text = await generateText(prompt);
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.rule || correction;
  } catch (err) {
    return correction;
  }
}

export { chat, applyCorrection, generateText };
