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
    model: "gemini-3-pro-preview"
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
    const msgLower = lastUserMsg.toLowerCase();

    // 1. UPDATE leadData FROM USER INPUT (Manual Extraction)
    let updatedLeadData = { ...leadData };

    if (!updatedLeadData.name) {
      if (!msgLower.match(/^(hi|hello|hey|namaste|start)$/i) && lastUserMsg.split(' ').length <= 3) {
        let nameMatch = lastUserMsg.replace(/^(my name is|i am|this is)\s+/i, '');
        updatedLeadData.name = nameMatch.trim();
      }
    }

    if (!updatedLeadData.productInterest) {
      if (msgLower.includes('panel')) updatedLeadData.productInterest = 'wall-panels';
      else if (msgLower.includes('breeze') || msgLower.includes('block')) updatedLeadData.productInterest = 'breeze-blocks';
      else if (msgLower.includes('brick') || msgLower.includes('clad')) updatedLeadData.productInterest = 'brick-cladding';
      else if (msgLower.includes('mural') || msgLower.includes('art')) updatedLeadData.productInterest = 'wall-murals';
    }

    if (!updatedLeadData.city) {
      const cities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'pune', 'ahmedabad', 'kolkata', 'jaipur', 'udaipur', 'surat', 'lucknow'];
      for (let c of cities) {
        if (msgLower.includes(c)) updatedLeadData.city = c.charAt(0).toUpperCase() + c.slice(1);
      }
    }

    if (!updatedLeadData.budget) {
      if (msgLower.match(/\d+/)) {
        if (msgLower.includes('budget') || msgLower.includes('₹') || msgLower.includes('rs') || msgLower.includes('rupees')) {
          updatedLeadData.budget = msgLower.match(/\d+(?:,\d+)*(?:k|lakhs?)?/i)?.[0] || msgLower.match(/\d+/)[0];
        }
      }
    }

    if (!updatedLeadData.area) {
      if (msgLower.match(/\d+/)) {
        if (msgLower.includes('sq') || msgLower.includes('ft') || msgLower.includes('area')) {
          updatedLeadData.area = msgLower.match(/\d+/)[0] + ' sqft';
        }
      }
    }

    if (!updatedLeadData.roomType) {
      if (msgLower.includes('living')) updatedLeadData.roomType = 'living room';
      else if (msgLower.includes('bed')) updatedLeadData.roomType = 'bedroom';
      else if (msgLower.includes('office') || msgLower.includes('commercial')) updatedLeadData.roomType = 'office';
      else if (msgLower.includes('outdoor') || msgLower.includes('exterior') || msgLower.includes('garden')) updatedLeadData.roomType = 'outdoor';
    }

    if (!updatedLeadData.stylePreference) {
      if (msgLower.includes('modern')) updatedLeadData.stylePreference = 'modern';
      else if (msgLower.includes('minimal')) updatedLeadData.stylePreference = 'minimalist';
      else if (msgLower.includes('traditional')) updatedLeadData.stylePreference = 'traditional';
      else if (msgLower.includes('rustic')) updatedLeadData.stylePreference = 'rustic';
    }

    if (!updatedLeadData.timeline) {
      if (msgLower.match(/\b(immediate|now|soon|urgent)\b/)) updatedLeadData.timeline = 'Immediate';
      else if (msgLower.match(/\b(month|week|days)\b/)) updatedLeadData.timeline = '1-3 months';
      else if (msgLower.match(/\b(explore|looking|just checking)\b/)) updatedLeadData.timeline = 'Exploring';
    }

    // 2. CONTROL FLOW USING leadData (Determine next question manually)
    let baseMessage = "";
    let handoverTriggered = false;

    if (!updatedLeadData.name) {
      baseMessage = "Warmly say hello. Introduce yourself as Meera from Hey Concrete and ask for their name.";
    } else if (!updatedLeadData.productInterest) {
      baseMessage = `Thank ${updatedLeadData.name}. Ask if they are looking for wall panels, breeze blocks, brick cladding, or wall murals.`;
    } else if (!updatedLeadData.city) {
      baseMessage = "Ask which city they are located in so you can suggest the nearest showroom.";
    } else if (!updatedLeadData.budget) {
      baseMessage = "Ask what their approximate budget is. Mention our product ranges (Under ₹200/sqft, ₹200-400/sqft, or ₹400+).";
    } else if (!updatedLeadData.area) {
      baseMessage = "Ask what the total wall area is that they want to cover (in square feet).";
    } else if (!updatedLeadData.roomType) {
      baseMessage = "Ask what type of room or space this is for (e.g., living room, bedroom, office, outdoor).";
    } else if (!updatedLeadData.stylePreference) {
      baseMessage = "Ask what design style they prefer (like modern, minimalist, traditional, or rustic).";
    } else if (!updatedLeadData.timeline) {
      baseMessage = "Ask when they are planning to start the project (immediate, in a few months, or just exploring).";
    } else {
      updatedLeadData.leadStatus = "qualified";
      handoverTriggered = true;
      baseMessage = `Thank them for providing all the details! Tell them a human sales expert (Kabir) will reach out with specific product recommendations and a quote shortly.`;
    }

    // Check manual handover triggers
    if (msgLower.includes('call') || msgLower.includes('talk to human') || msgLower.includes('person') || msgLower.includes('kabir')) {
      handoverTriggered = true;
      baseMessage = "Acknowledge they want to speak to a person. Let them know Kabir from our sales team will contact them shortly.";
    }

    // 3. USE GEMINI ONLY FOR RESPONSE STYLE, NOT LOGIC
    const prompt = `You are Meera, a sales consultant from Hey Concrete.

Rewrite this message in a friendly, human WhatsApp style:
"${baseMessage}"

Rules:
- 2-3 lines max
- 1 emoji
- Hinglish tone (conversational, natural Indian English mixed with casual Hindi words)
- Sound natural and empathetic
- DO NOT add extra questions not in the prompt
- Return ONLY text. No quotes, no markdown, no JSON.`;

    console.log(`[CHAT LOGIC] Step: ${baseMessage}`);
    let generatedText = await generateText(prompt);
    generatedText = generatedText.trim();
    generatedText = generatedText.replace(/^["']|["']$/g, '').trim();

    // 4. Calculate Lead Score
    let calculatedScore = 0;
    if (updatedLeadData.name) calculatedScore += 5;
    if (updatedLeadData.productInterest) calculatedScore += 10;
    if (updatedLeadData.city) calculatedScore += 10;
    if (updatedLeadData.budget) calculatedScore += 25;
    if (updatedLeadData.area) calculatedScore += 20;
    if (updatedLeadData.stylePreference) calculatedScore += 15;
    if (updatedLeadData.timeline === 'Immediate') calculatedScore += 15;
    if (updatedLeadData.timeline === '1-3 months') calculatedScore += 10;

    if (calculatedScore >= 70) handoverTriggered = true;

    // 5. RETURN STRUCTURED RESPONSE
    return {
      message: generatedText,
      leadData: updatedLeadData,
      leadScore: calculatedScore,
      handover: handoverTriggered,
      handoverReason: handoverTriggered ? "Lead qualified or requested handover" : ""
    };

  } catch (err) {
    console.error('AI Error:', err.message);

    // Safely determine next manual step even if API fails
    const defaultFallback = "Network mein thoda issue hai 😊 Aapka detail mila, thoda aur bataiye na? (Try sending your response again)";

    return {
      message: defaultFallback,
      leadData: leadData || {},
      leadScore: 0,
      handover: false,
      handoverReason: ''
    };
  }
}

async function applyCorrection(originalResponse, correction) {
  try {
    const prompt = `You are helping update a chatbot's learning rules.

Original bot response: "${originalResponse}"
Admin correction: "${correction}"

Generate a clear, specific rule to add to the bot's behavior guidelines.
The rule should be actionable and specific.

CRITICAL: Your entire response MUST be valid JSON. Do NOT include markdown, explanation, or text outside JSON. Return ONLY JSON object.
Respond in JSON only: { "rule": "specific rule text" }`;

    const text = await generateText(prompt);
    let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return parsed.rule || correction;
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        return parsed.rule || correction;
      }
      return correction;
    }
  } catch (err) {
    return correction;
  }
}

export { chat, applyCorrection, generateText };
