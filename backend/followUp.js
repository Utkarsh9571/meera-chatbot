/**
 * followUp.js — 5-Layer Follow-Up System for Meera
 *
 * Layer 1: 20 mins  — Soft nudge related to their last topic
 * Layer 2: 4-6 hrs  — Send a visual / product photo reference
 * Layer 3: 18-24 hrs — Context-aware: catalog PDF / design suggestion / sales connect
 * Layer 4: 3 days   — Hey Concrete benefits & value prop
 * Layer 5: 4 days   — Graceful close, mark as DORMANT
 *
 * Rules:
 * - Never follow up more than once per day
 * - Never send just "Hi" — always add value
 * - Dormant leads: one re-engagement per month, after 3 fails → Cold Box
 */

import { Conversation } from './models.js';
import { generateText } from './aiService.js';

// How long each layer waits (in milliseconds)
const LAYER_DELAYS = {
  1: 20 * 60 * 1000,           // 20 minutes
  2: 5 * 60 * 60 * 1000,       // 5 hours
  3: 21 * 60 * 60 * 1000,      // 21 hours
  4: 3 * 24 * 60 * 60 * 1000,  // 3 days
  5: 4 * 24 * 60 * 60 * 1000,  // 4 days
};

/**
 * Generate a follow-up message using AI based on layer and lead data
 */
async function generateFollowUpMessage(conversation, layer) {
  const lead = conversation.leadData || {};
  const name = lead.name || 'there';
  const product = lead.productInterest || 'wall panels';
  const productDisplay = product.replace(/-/g, ' ');

  const layerPrompts = {
    1: `You are Meera from Hey Concrete. Send a warm, short follow-up message to ${name} who was asking about ${productDisplay}. 
They went quiet mid-conversation. Give them a soft nudge — reference something specific from their interest (product: ${productDisplay}, room: ${lead.roomType || 'not specified'}).
Do NOT just say "Hi". Add real value. Max 3 lines. Use 1 emoji. Sound like WhatsApp.`,

    2: `You are Meera from Hey Concrete. Send a follow-up to ${name} who was interested in ${productDisplay}.
This message should mention a visual/product inspiration — describe a beautiful project done with ${productDisplay} (keep it real, no fake URLs).
Make them feel excited about the design possibilities. Max 3 lines. 1-2 emojis. WhatsApp style.`,

    3: `You are Meera from Hey Concrete. Send a helpful follow-up to ${name} who asked about ${productDisplay}.
${lead.budget ? `They had a budget of ${lead.budget}.` : ''} ${lead.roomType ? `They wanted it for their ${lead.roomType}.` : ''}
Either suggest connecting with our design team, or offer to send them a catalog. Make it feel personal, not spammy. Max 3 lines.`,

    4: `You are Meera from Hey Concrete. Send a value-focused follow-up to ${name}.
Remind them why Hey Concrete is special — 3000+ completed projects, pan-India showrooms, premium quality, European-inspired designs.
Connect it to their interest in ${productDisplay}. Warm tone. Max 3 lines. 1 emoji.`,

    5: `You are Meera from Hey Concrete. Send a graceful closing message to ${name} who was interested in ${productDisplay} but hasn't responded.
Let them know the door is always open. Don't be pushy. Make it warm and memorable so they think of Hey Concrete when they're ready.
Max 2 lines. 1 emoji.`,
  };

  try {
    const text = await generateText(layerPrompts[layer] || layerPrompts[1]);
    return text.trim().replace(/^["']|["']$/g, '');
  } catch {
    // Fallback messages per layer
    const fallbacks = {
      1: `Hey ${name}! 👋 Just checking in — were you still thinking about ${productDisplay} for your space? Happy to help!`,
      2: `${name}, our ${productDisplay} projects have been looking stunning lately ✨ Would love to show you some inspo for your space!`,
      3: `Hi ${name}! Want me to send you our latest ${productDisplay} catalog? Or I can connect you with our design team directly 😊`,
      4: `${name}, Hey Concrete has transformed 3000+ homes across India 🏡 Your dream wall is just a step away!`,
      5: `${name}, it was lovely connecting with you 😊 Whenever you're ready to transform your space, we're here for you!`,
    };
    return fallbacks[layer];
  }
}

/**
 * Send a follow-up for a specific conversation
 * In production this would trigger a Gupshup WhatsApp message.
 * For web sessions it saves to the conversation so the frontend can poll/show it.
 */
async function sendFollowUp(conversation, layer) {
  try {
    const message = await generateFollowUpMessage(conversation, layer);

    // Save follow-up message to conversation
    conversation.messages.push({
      role: 'assistant',
      content: `[Follow-up Layer ${layer}] ${message}`,
      timestamp: new Date(),
    });

    conversation.followUpLayer = layer;
    conversation.lastFollowUpAt = new Date();

    // Layer 5 = mark dormant
    if (layer >= 5) {
      conversation.leadStatus = 'dormant';
      console.log(`[FOLLOWUP] Marked ${conversation.sessionId} as DORMANT after layer 5`);
    }

    await conversation.save();

    console.log(`[FOLLOWUP] Layer ${layer} sent to session ${conversation.sessionId}: "${message.slice(0, 60)}..."`);

    // TODO: If this is a WhatsApp conversation (conversation.channel === 'whatsapp'),
    // trigger Gupshup outbound message here:
    // await sendGupshupMessage(conversation.customerPhone, message);

    return message;
  } catch (err) {
    console.error(`[FOLLOWUP] Error sending layer ${layer} to ${conversation.sessionId}:`, err.message);
  }
}

/**
 * Check all active conversations and send follow-ups as needed
 * This runs on a polling interval (every 5 minutes)
 */
async function processFollowUps() {
  const now = new Date();

  try {
    // Only process active conversations that haven't been handed over
    const conversations = await Conversation.find({
      leadStatus: { $in: ['active', 'qualified'] },
      handoverTriggered: false,
      followUpLayer: { $lt: 5 },
    });

    for (const conv of conversations) {
      const lastMsg = conv.lastMessageAt;
      if (!lastMsg) continue;

      const silenceMs = now - new Date(lastMsg);
      const currentLayer = conv.followUpLayer || 0;
      const nextLayer = currentLayer + 1;

      if (nextLayer > 5) continue;

      const requiredDelay = LAYER_DELAYS[nextLayer];
      if (!requiredDelay) continue;

      // Check: has enough time passed for next layer?
      if (silenceMs < requiredDelay) continue;

      // Check: did we already send a follow-up recently (max once per day)?
      if (conv.lastFollowUpAt) {
        const hoursSinceLastFollowUp = (now - new Date(conv.lastFollowUpAt)) / (1000 * 60 * 60);
        if (hoursSinceLastFollowUp < 20) continue; // 20 hour minimum gap
      }

      await sendFollowUp(conv, nextLayer);
    }

    // Re-engagement for dormant leads
    await processDormantReEngagement(now);

  } catch (err) {
    console.error('[FOLLOWUP] Scheduler error:', err.message);
  }
}

/**
 * Re-engage dormant leads: once per month, max 3 attempts, then → cold
 */
async function processDormantReEngagement(now) {
  try {
    const dormantLeads = await Conversation.find({ leadStatus: 'dormant' });

    for (const conv of dormantLeads) {
      const reEngageCount = conv.reEngageCount || 0;

      if (reEngageCount >= 3) {
        // Move to cold box after 3 failed re-engagements
        if (conv.leadStatus !== 'cold') {
          conv.leadStatus = 'cold';
          await conv.save();
          console.log(`[FOLLOWUP] Moved ${conv.sessionId} to COLD BOX`);
        }
        continue;
      }

      // Re-engage once per month
      const lastActivity = conv.lastFollowUpAt || conv.lastMessageAt;
      if (!lastActivity) continue;
      const daysSinceLastActivity = (now - new Date(lastActivity)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastActivity < 30) continue;

      // Send re-engagement
      const lead = conv.leadData || {};
      const name = lead.name || 'there';
      const product = (lead.productInterest || 'wall panels').replace(/-/g, ' ');

      try {
        const message = await generateText(
          `You are Meera from Hey Concrete. Send a warm re-engagement message to ${name} who was once interested in ${product} but went quiet months ago.
Don't be pushy. Share something genuinely useful — a new design, a trend, or a seasonal offer.
Max 2 lines. 1 emoji. WhatsApp tone.`
        );

        conv.messages.push({ role: 'assistant', content: `[Re-engagement] ${message.trim()}`, timestamp: now });
        conv.lastFollowUpAt = now;
        conv.reEngageCount = reEngageCount + 1;
        await conv.save();

        console.log(`[FOLLOWUP] Re-engagement ${reEngageCount + 1}/3 sent to dormant session ${conv.sessionId}`);
      } catch { /* skip this one */ }
    }
  } catch (err) {
    console.error('[FOLLOWUP] Dormant re-engagement error:', err.message);
  }
}

/**
 * Start the follow-up scheduler
 * Call this once from server.js after MongoDB connects
 */
function startFollowUpScheduler() {
  const POLL_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

  console.log('✅ Follow-up scheduler started (polling every 5 mins)');

  // Run immediately on start, then every 5 minutes
  processFollowUps();
  setInterval(processFollowUps, POLL_INTERVAL);
}

export { startFollowUpScheduler, sendFollowUp, generateFollowUpMessage };
