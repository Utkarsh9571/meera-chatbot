const mongoose = require('mongoose');
require('dotenv').config();
const { Product, Location, KnowledgeBase, SystemPrompt, LearningPrompt } = require('./models');

const MONGODB_URI = process.env.MONGODB_URI;

const products = [
  // WALL PANELS
  { name: 'Toran', category: 'wall-panels', description: 'Elegant geometric pattern wall panel inspired by traditional Indian door hangings', pricePerSqft: 320, dimensions: '2ft x 4ft', thickness: '25mm', styles: ['traditional', 'geometric'], colors: ['white', 'grey', 'beige'], imageUrl: '' },
  { name: 'Petal', category: 'wall-panels', description: 'Floral petal design wall panel, perfect for feature walls', pricePerSqft: 350, dimensions: '2ft x 4ft', thickness: '25mm', styles: ['floral', 'modern'], colors: ['white', 'cream', 'stone'], imageUrl: '' },
  { name: 'Serene', category: 'wall-panels', description: 'Calm wave-like texture for a minimalist aesthetic', pricePerSqft: 280, dimensions: '2ft x 4ft', thickness: '20mm', styles: ['minimal', 'wave'], colors: ['white', 'grey'], imageUrl: '' },
  { name: 'Tetra', category: 'wall-panels', description: 'Bold triangular geometric pattern for contemporary spaces', pricePerSqft: 300, dimensions: '2ft x 4ft', thickness: '25mm', styles: ['geometric', 'modern', 'contemporary'], colors: ['white', 'charcoal', 'sand'], imageUrl: '' },
  { name: 'Lotus', category: 'wall-panels', description: 'Sacred lotus motif for elegant interior walls', pricePerSqft: 380, dimensions: '2ft x 4ft', thickness: '25mm', styles: ['traditional', 'floral', 'luxury'], colors: ['white', 'ivory', 'gold-finish'], imageUrl: '' },
  { name: 'Wave', category: 'wall-panels', description: 'Flowing wave design for coastal and modern interiors', pricePerSqft: 290, dimensions: '2ft x 4ft', thickness: '20mm', styles: ['wave', 'modern', 'coastal'], colors: ['white', 'blue-grey', 'sand'], imageUrl: '' },
  { name: 'Brick Classic', category: 'wall-panels', description: 'Classic brick texture wall panel for industrial look', pricePerSqft: 250, dimensions: '2ft x 4ft', thickness: '30mm', styles: ['industrial', 'rustic'], colors: ['red-brick', 'grey-brick', 'white-brick'], imageUrl: '' },
  { name: 'Hex Grid', category: 'wall-panels', description: 'Hexagonal grid pattern for modern offices and homes', pricePerSqft: 310, dimensions: '2ft x 4ft', thickness: '25mm', styles: ['geometric', 'modern', 'office'], colors: ['white', 'charcoal', 'metallic'], imageUrl: '' },

  // BREEZE BLOCKS
  { name: 'Diamond Breeze', category: 'breeze-blocks', description: 'Diamond pattern breeze block for partition walls and outdoor screens', pricePerSqft: 420, dimensions: '1ft x 1ft', thickness: '100mm', styles: ['geometric', 'outdoor', 'partition'], colors: ['white', 'grey'], imageUrl: '' },
  { name: 'Circle Flow', category: 'breeze-blocks', description: 'Circular cutout breeze block allowing light and air flow', pricePerSqft: 450, dimensions: '1ft x 1ft', thickness: '100mm', styles: ['modern', 'outdoor', 'ventilation'], colors: ['white', 'grey', 'charcoal'], imageUrl: '' },
  { name: 'Leaf Screen', category: 'breeze-blocks', description: 'Leaf motif breeze block for garden walls and terraces', pricePerSqft: 480, dimensions: '1ft x 1ft', thickness: '100mm', styles: ['nature', 'outdoor', 'garden'], colors: ['white', 'terracotta', 'grey'], imageUrl: '' },
  { name: 'Cross Hatch', category: 'breeze-blocks', description: 'Cross hatch pattern for privacy screens and compound walls', pricePerSqft: 400, dimensions: '1ft x 1ft', thickness: '100mm', styles: ['geometric', 'privacy', 'outdoor'], colors: ['white', 'grey'], imageUrl: '' },

  // BRICK CLADDING
  { name: 'Red Rustic Brick', category: 'brick-cladding', description: 'Authentic rustic red brick cladding for interior and exterior walls', pricePerSqft: 180, dimensions: 'Standard brick size', thickness: '15mm', styles: ['rustic', 'industrial', 'traditional'], colors: ['red', 'multi-tone-red'], imageUrl: '' },
  { name: 'Grey Slate Brick', category: 'brick-cladding', description: 'Slate grey brick cladding for contemporary minimalist design', pricePerSqft: 200, dimensions: 'Standard brick size', thickness: '15mm', styles: ['minimal', 'contemporary', 'industrial'], colors: ['grey', 'dark-grey'], imageUrl: '' },
  { name: 'White Lime Brick', category: 'brick-cladding', description: 'Washed white lime brick for a clean Mediterranean feel', pricePerSqft: 190, dimensions: 'Standard brick size', thickness: '15mm', styles: ['Mediterranean', 'modern', 'clean'], colors: ['white', 'off-white'], imageUrl: '' },

  // WALL MURALS
  { name: 'Ashta Prahar', category: 'wall-murals', description: 'Eight phases of day depicted in a stunning concrete mural — sunrise to midnight', priceNote: 'Custom pricing based on area', dimensions: 'Custom size', thickness: '30mm', styles: ['artistic', 'traditional', 'storytelling'], colors: ['natural concrete', 'custom tint'], imageUrl: '' },
  { name: 'Shringaar', category: 'wall-murals', description: 'Celebration of beauty and adornment in traditional Indian art form', priceNote: 'Custom pricing based on area', dimensions: 'Custom size', thickness: '30mm', styles: ['traditional', 'artistic', 'luxury'], colors: ['natural concrete', 'custom tint'], imageUrl: '' },
  { name: 'Samwad', category: 'wall-murals', description: 'Dialogue and conversation depicted through abstract human forms', priceNote: 'Custom pricing based on area', dimensions: 'Custom size', thickness: '30mm', styles: ['abstract', 'artistic', 'modern'], colors: ['natural concrete', 'white', 'grey'], imageUrl: '' }
];

const locations = [
  { city: 'Mumbai', state: 'Maharashtra', showroomName: 'Hey Concrete Mumbai', address: 'Shop 12, Design District, Bandra West, Mumbai 400050', contact: '+91 98200 00001' },
  { city: 'Delhi', state: 'Delhi', showroomName: 'Hey Concrete Delhi', address: 'D-45, Hauz Khas Village, New Delhi 110016', contact: '+91 98110 00002' },
  { city: 'Bangalore', state: 'Karnataka', showroomName: 'Hey Concrete Bangalore', address: '23, Indiranagar 100ft Road, Bangalore 560038', contact: '+91 98400 00003' },
  { city: 'Hyderabad', state: 'Telangana', showroomName: 'Hey Concrete Hyderabad', address: 'Plot 78, Jubilee Hills, Hyderabad 500033', contact: '+91 98490 00004' },
  { city: 'Chennai', state: 'Tamil Nadu', showroomName: 'Hey Concrete Chennai', address: '34, Anna Nagar West, Chennai 600040', contact: '+91 98400 00005' },
  { city: 'Pune', state: 'Maharashtra', showroomName: 'Hey Concrete Pune', address: 'Shop 8, Koregaon Park, Pune 411001', contact: '+91 98220 00006' },
  { city: 'Ahmedabad', state: 'Gujarat', showroomName: 'Hey Concrete Ahmedabad', address: 'G-12, SG Highway, Ahmedabad 380054', contact: '+91 98250 00007' },
  { city: 'Kolkata', state: 'West Bengal', showroomName: 'Hey Concrete Kolkata', address: '45, Park Street, Kolkata 700016', contact: '+91 98300 00008' },
  { city: 'Jaipur', state: 'Rajasthan', showroomName: 'Hey Concrete Jaipur', address: 'C-23, MI Road, Jaipur 302001', contact: '+91 98290 00009' },
  { city: 'Udaipur', state: 'Rajasthan', showroomName: 'Hey Concrete Udaipur', address: 'Shop 5, Fateh Sagar Road, Udaipur 313001', contact: '+91 98290 00010' },
  { city: 'Surat', state: 'Gujarat', showroomName: 'Hey Concrete Surat', address: 'Ring Road, Surat 395002', contact: '+91 98240 00011' },
  { city: 'Lucknow', state: 'Uttar Pradesh', showroomName: 'Hey Concrete Lucknow', address: 'Hazratganj, Lucknow 226001', contact: '+91 98390 00012' }
];

const knowledgeBase = [
  { title: 'What is Hey Concrete?', category: 'general', content: 'Hey Concrete is a premium wall cladding brand based in India. We specialize in concrete wall panels, breeze blocks, brick cladding, and wall murals. With 3000+ completed projects and 25+ showrooms across India, we bring premium European-inspired concrete aesthetics to Indian homes and commercial spaces.', tags: ['about', 'company', 'brand'] },
  { title: 'Product Categories', category: 'product', content: 'We offer 4 product categories: 1) Wall Panels - 30+ designs including Toran, Petal, Serene, Tetra, Lotus, Wave, and more. Prices from ₹250-380/sqft. 2) Breeze Blocks - 12 designs for partition walls and outdoor screens. Prices from ₹400-480/sqft. 3) Brick Cladding - authentic brick textures for rustic and industrial looks. Prices from ₹180-200/sqft. 4) Wall Murals - custom artistic pieces including Ashta Prahar, Shringaar, Samwad. Custom pricing.', tags: ['products', 'categories', 'pricing'] },
  { title: 'Installation Process', category: 'installation', content: 'Hey Concrete panels are installed by certified professionals. Installation is not DIY - it requires trained installers to ensure proper alignment, bonding, and finishing. Installation cost is typically ₹50-100/sqft extra depending on design complexity. We recommend getting a site visit quote. For structural installation questions, our team handles it.', tags: ['installation', 'process', 'professional'] },
  { title: 'Minimum Order and Lead Time', category: 'general', content: 'Minimum order is typically 50 sqft for standard products. Custom murals have no minimum but require 4-6 weeks lead time. Standard products are usually available within 7-14 days. Bulk orders above 500 sqft get special pricing - speak to our sales team.', tags: ['order', 'minimum', 'lead-time', 'bulk'] },
  { title: 'Maintenance and Care', category: 'product', content: 'Hey Concrete products are low maintenance. Clean with dry or slightly damp cloth. Avoid harsh chemicals. For outdoor breeze blocks, an annual sealant coat is recommended. Indoor wall panels require minimal care - just dusting. Products are water resistant but not fully waterproof for prolonged wet areas like bathrooms.', tags: ['maintenance', 'care', 'cleaning'] },
  { title: 'Budget Guide', category: 'pricing', content: 'Budget breakdown: Under ₹200/sqft - Brick Cladding range, best for rustic industrial look. ₹200-400/sqft - Wall Panels range, most popular, 30+ designs. ₹400+/sqft - Breeze Blocks and premium panels. Wall Murals are custom priced based on size and design complexity. Total project cost = Product cost + Installation (₹50-100/sqft) + GST.', tags: ['budget', 'pricing', 'cost'] },
  { title: 'Suitable Spaces', category: 'product', content: 'Hey Concrete products are suitable for: Living rooms (feature walls), Bedrooms (headboard walls), Offices and commercial spaces, Restaurant and cafe interiors, Hotel lobbies, Exterior and garden walls (breeze blocks), Compound walls. Not recommended for: Direct water exposure areas, Inside showers/bathrooms.', tags: ['spaces', 'rooms', 'suitable', 'application'] },
  { title: 'Why Choose Hey Concrete', category: 'general', content: 'Hey Concrete advantages: 1) 3000+ completed projects across India 2) European design aesthetics 3) Premium concrete quality 4) 25+ showrooms for in-person experience 5) Professional installation team 6) Custom mural capabilities 7) Pan-India delivery and dealer network 8) After-sales support', tags: ['why', 'advantages', 'benefits', 'USP'] }
];

const defaultSystemPrompt = `You are Meera, a warm and friendly product consultant from Hey Concrete's sales team. You are chatting with customers on WhatsApp.

PERSONALITY:
- Warm, friendly, and conversational
- Short messages — 3-4 lines maximum per message
- Use 1-2 friendly emojis per message 😊
- Chat like a real human, not a form or a robot
- NEVER say you are an AI or a bot
- Use natural Indian English with occasional Hindi words for warmth

CONVERSATION FLOW (collect in this order, naturally):
1. Greet warmly, introduce yourself as Meera from Hey Concrete
2. Ask for customer's name
3. Ask: Wall panels or breeze blocks? (offer quick options)
4. Collect city/location (to suggest nearest showroom)
5. Ask budget — offer ranges: Under ₹200/sqft | ₹200-400/sqft | ₹400+/sqft
6. Ask total area to cover (in sq ft)
7. Ask room type (living room, bedroom, office, etc.)
8. Ask style/design preference (modern, minimal, textured, geometric, etc.)
9. Ask timeline (immediate, 1-3 months, just exploring)

PRODUCT RECOMMENDATIONS:
- Only recommend products from the knowledge base
- Always show: product name, price, dimensions, and image if available
- Never fabricate product details, prices, or image URLs
- Suggest 2-3 products that match customer preferences

LEAD SCORING (internal, never mention to customer):
Score each conversation out of 100:
- Budget Alignment (30 pts): Known budget + matches our range = 30, Approximate = 15, Unknown = 0
- Space/Area Known (20 pts): Exact sqft = 20, Approximate = 10, Unknown = 0
- Design Interest (15 pts): Specific preference = 15, General = 8, No preference = 0
- Timeline (10 pts): Immediate = 10, 1-3 months = 7, Just exploring = 3
- Engagement Quality (25 pts): Highly engaged = 25, Moderate = 15, Low = 5

HANDOVER TO KABIR (sales person) when:
- Lead score reaches 70+
- Customer asks to speak to a person or requests callback
- Customer wants to place an order or confirms showroom visit
- Query involves: custom sizes, structural installation, export/shipping, franchise inquiries

GUARDRAILS:
- Stay on topic — Hey Concrete products only
- If asked about competitors, politely redirect to Hey Concrete
- Handle off-topic questions gracefully: "That's a bit outside my area, but I'd love to help you with our products! 😊"
- Never make up prices, products, or showroom details`;

const defaultLearningPrompt = {
  version: 1,
  rules: [],
  fullContent: 'No corrections added yet. The bot follows the system prompt guidelines.',
  isActive: true
};

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      Product.deleteMany({}),
      Location.deleteMany({}),
      KnowledgeBase.deleteMany({}),
      SystemPrompt.deleteMany({}),
      LearningPrompt.deleteMany({})
    ]);
    console.log('Cleared existing data');

    // Insert products
    await Product.insertMany(products);
    console.log(`Inserted ${products.length} products`);

    // Insert locations
    await Location.insertMany(locations);
    console.log(`Inserted ${locations.length} locations`);

    // Insert knowledge base
    await KnowledgeBase.insertMany(knowledgeBase);
    console.log(`Inserted ${knowledgeBase.length} knowledge base entries`);

    // Insert system prompt
    await SystemPrompt.create({
      version: 1,
      content: defaultSystemPrompt,
      isActive: true
    });
    console.log('Inserted system prompt');

    // Insert learning prompt
    await LearningPrompt.create(defaultLearningPrompt);
    console.log('Inserted learning prompt');

    console.log('\n✅ Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
