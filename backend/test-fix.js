import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { chat } from './aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function testFix() {
  console.log("Model in use:", process.env.GEMINI_MODEL);
  console.log("Testing AI response...");
  const messages = [{ role: "user", content: "Hi" }];
  const leadData = {};
  
  try {
    const response = await chat(messages, leadData);
    console.log("AI Response:", response.message);
    if (response.message && !response.message.includes("network issue")) {
      console.log("✅ FIXED: Bot responded correctly.");
    } else {
      console.log("❌ FAILED: Bot still reporting error.");
    }
  } catch (err) {
    console.error("❌ ERROR during test:", err.message);
  }
}

testFix();
