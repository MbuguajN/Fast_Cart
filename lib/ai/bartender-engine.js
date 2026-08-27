import fs from 'fs';
import path from 'path';

/**
 * Load store catalog and recipes for AI context
 */
function getStoreContext() {
  try {
    const storePath = path.join(process.cwd(), 'data', 'store.json');
    const mixPath = path.join(process.cwd(), 'data', 'mixology.json');

    let products = [];
    let recipes = [];

    if (fs.existsSync(storePath)) {
      const sData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      products = (sData.products || []).map((p) => ({
        id: Number(p.wcId || p.id),
        name: p.name,
        price: parseFloat(p.price) || 0,
        category: p.categoryName || '',
        brand: p.brandName || '',
        inStock: p.stockStatus === 'instock',
        image: p.image || '',
      }));
    }

    if (fs.existsSync(mixPath)) {
      recipes = JSON.parse(fs.readFileSync(mixPath, 'utf8'));
    }

    return { products, recipes };
  } catch (err) {
    console.error('Failed to load store context:', err);
    return { products: [], recipes: [] };
  }
}

/**
 * System Prompt for the AI Bartender
 */
function buildSystemPrompt(products, recipes) {
  const productSummary = products
    .filter((p) => p.inStock)
    .slice(0, 80)
    .map((p) => `- ${p.name} (Category: ${p.category}, Price: KSh ${p.price.toLocaleString()}, ID: ${p.id})`)
    .join('\n');

  const recipeSummary = recipes
    .map((r) => `- ${r.title} (Brand: ${r.brand}, Base: ${r.spiritType}, Style: ${r.drinkStyle}, Slug: ${r.slug}, Difficulty: ${r.difficulty})`)
    .join('\n');

  return `You are "Tipsy", the world-class Master Mixologist, Sommelier & Party Connoisseur for Happy Hour Kenya (Nairobi's 20-minute premium drinks delivery service).

YOUR PERSONALITY:
- Charismatic, witty, enthusiastic, and knowledgeable about all things drinks, cocktail history, mixology techniques, tasting notes, fun trivia, food pairings, party planning, and responsible drinking.
- You speak with an upbeat, welcoming vibe (occasional friendly Kenyan/Nairobi warmth like "Karibu", "Cheers", "Sherehe ready!").
- You are strictly an expert on beverages (spirits, cocktails, wines, beers, mixers, artisan juices like Jaba, party packs, glassware, ice, garnishes, and hangover remedies).

LIVE INVENTORY & PRICING CONTEXT:
Here is our live store inventory with current prices in Kenyan Shillings (KES / KSh):
${productSummary}

CURATED MIXOLOGY RECIPES (43 Master Cocktails):
${recipeSummary}

SPECIAL INSTRUCTIONS:
1. When recommending drinks, mention specific prices in "KSh" from our inventory and recommend matching products.
2. If the user asks about making cocktails, reference our recipes with exact measurements and ingredients.
3. Whenever relevant, output recommended products and recipes in a structured JSON block at the end of your response so the UI can render interactive "Add to Cart" and "View Recipe" cards!
Format:
\`\`\`json
{
  "productIds": [2805, 4360],
  "recipeSlugs": ["classic-jameson-whiskey-sour"],
  "followUps": ["What glassware should I use?", "Show me cocktails under 5 mins", "What's the best tequila for margaritas?"]
}
\`\`\`
4. Always advocate for responsible drinking (18+ only). Keep answers engaging, structured with emojis and bullet points.`;
}

/**
 * Call External LLM API if Key is Configured (Gemini / OpenAI)
 */
async function callExternalLLM(prompt, messages, products, recipes) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const systemInstruction = buildSystemPrompt(products, recipes);

      const contents = [
        { role: 'user', parts: [{ text: `System instruction: ${systemInstruction}` }] },
        ...messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      ];

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return parseAIResponse(text, products, recipes);
      }
    } catch (err) {
      console.warn('Gemini API call error, using smart fallback engine:', err);
    }
  }

  if (openaiKey) {
    try {
      const systemInstruction = buildSystemPrompt(products, recipes);
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemInstruction },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return parseAIResponse(text, products, recipes);
      }
    } catch (err) {
      console.warn('OpenAI API call error, using smart fallback engine:', err);
    }
  }

  // Fallback to offline intelligent mixology response generator
  return generateIntelligentResponse(messages, products, recipes);
}

/**
 * Parse JSON recommendations from AI text
 */
function parseAIResponse(rawText, products, recipes) {
  let cleanedText = rawText;
  let recommendedProductIds = [];
  let recommendedRecipeSlugs = [];
  let followUps = [];

  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed.productIds)) recommendedProductIds = parsed.productIds;
      if (Array.isArray(parsed.recipeSlugs)) recommendedRecipeSlugs = parsed.recipeSlugs;
      if (Array.isArray(parsed.followUps)) followUps = parsed.followUps;
      cleanedText = rawText.replace(/```json[\s\S]*?```/, '').trim();
    } catch (e) {
      console.error('Failed to parse AI JSON block:', e);
    }
  }

  // Extract products and recipes objects
  const suggestedProducts = products.filter((p) => recommendedProductIds.includes(p.id));
  const suggestedRecipes = recipes.filter((r) => recommendedRecipeSlugs.includes(r.slug));

  return {
    content: cleanedText,
    suggestedProducts,
    suggestedRecipes,
    followUps: followUps.length > 0 ? followUps : [
      'Show me another cocktail recipe',
      'What drinks are on offer right now?',
      'How much alcohol do I need for 10 people?',
    ],
  };
}

/**
 * Smart Sommelier & Mixology Heuristic Engine (Offline / Standalone fallback)
 */
function generateIntelligentResponse(messages, products, recipes) {
  const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();

  let responseText = '';
  let matchedProductIds = [];
  let matchedRecipeSlugs = [];
  let followUps = [];

  // Helper matching
  const findProd = (pred) => products.find(pred);
  const findRecs = (pred) => recipes.filter(pred);

  // 1. Party Calculator
  if (lastMsg.includes('how many') || lastMsg.includes('party for') || lastMsg.includes('calculator') || lastMsg.includes('guests') || lastMsg.includes('people')) {
    const numMatch = lastMsg.match(/\b(\d+)\b/);
    const count = numMatch ? parseInt(numMatch[1], 10) : 10;
    const drinksPerPerson = 3;
    const totalDrinks = count * drinksPerPerson;
    const bottlesLiquor = Math.ceil((totalDrinks * 0.5) / 16); // 16 drinks per 750ml
    const beerOrMixerPacks = Math.ceil((totalDrinks * 0.5) / 6);

    const pack = findProd((p) => p.name.includes('Party Pack')) || products[0];
    if (pack) matchedProductIds.push(pack.id);

    responseText = `🎉 **Party Drinks Blueprint for ~${count} Guests:**\n\n` +
      `Here is the golden bartender rule (assuming a 3 to 4-hour sherehe):\n` +
      `• **Total estimated drinks:** ~${totalDrinks} servings\n` +
      `• **Spirits Needed:** ~${bottlesLiquor} bottle(s) of 750ml / 1L (provides ~16–22 drinks each)\n` +
      `• **Mixers & Beers:** ~${beerOrMixerPacks} six-packs or 2L sodas (Schweppes Tonic, Coke, Krest)\n` +
      `• **Ice:** Minimum 2 big bags (never let the drinks go warm!)\n\n` +
      `💡 **Pro Tip:** Grab one of our pre-curated **Party Packs** to get spirits, chasers, and mixers bundled at a discount with 20-minute delivery across Nairobi!`;

    followUps = ['Show me the Party Packs', 'What mixers go well with Gin?', 'Budget whiskey recommendations'];
  }
  // 2. Whiskey queries
  else if (lastMsg.includes('whiskey') || lastMsg.includes('whisky') || lastMsg.includes('jameson') || lastMsg.includes('chivas') || lastMsg.includes('glenlivet') || lastMsg.includes('scotch')) {
    const jameson = findProd((p) => p.name.includes('Jameson Black Barrel')) || findProd((p) => p.name.includes('Jameson'));
    const chivas = findProd((p) => p.name.includes('Chivas 12'));
    const glenlivet = findProd((p) => p.name.includes('The Glenlivet'));

    if (jameson) matchedProductIds.push(jameson.id);
    if (chivas) matchedProductIds.push(chivas.id);
    if (glenlivet) matchedProductIds.push(glenlivet.id);

    const recs = findRecs((r) => r.spiritType === 'Whiskey').slice(0, 2);
    recs.forEach((r) => matchedRecipeSlugs.push(r.slug));

    responseText = `🥃 **The Whiskey Vault & Master Mixes:**\n\n` +
      `Whether you like it neat on the rocks or shaken into a zesty cocktail, here is what is hot in our stock:\n\n` +
      `1. **Jameson Black Barrel (750ml - KSh ${jameson?.price.toLocaleString() || '4,591'}):** Double-charred in bourbon barrels for rich vanilla and toasted wood notes. Ideal for a **Classic Whiskey Sour**!\n` +
      `2. **Chivas Regal 12 YO (750ml - KSh ${chivas?.price.toLocaleString() || '3,419'}):** Ultra-smooth blended Speyside scotch with wild herbs, honey, and orchard fruits.\n` +
      `3. **The Glenlivet Founders Reserve (KSh ${glenlivet?.price.toLocaleString() || '5,371'}):** Classic single malt smoothness with creamy sweetness and apple zest.\n\n` +
      `✨ **Cocktail to try:** Check out our **Classic Jameson Whiskey Sour** below!`;

    followUps = ['How to make a Whiskey Sour', 'Whiskey under 3,000 KSh', 'What is the difference between single malt and blended?'];
  }
  // 3. Gin & Spritz queries
  else if (lastMsg.includes('gin') || lastMsg.includes('beefeater') || lastMsg.includes('malfy') || lastMsg.includes('spritz') || lastMsg.includes('tonic') || lastMsg.includes('negroni')) {
    const malfy = findProd((p) => p.name.includes('Malfy Gin Con Rosa')) || findProd((p) => p.name.includes('Malfy'));
    const beefeater = findProd((p) => p.name.includes('Beefeater Gin 750ml')) || findProd((p) => p.name.includes('Beefeater'));
    const tonic = findProd((p) => p.name.includes('Tonic Water'));

    if (malfy) matchedProductIds.push(malfy.id);
    if (beefeater) matchedProductIds.push(beefeater.id);
    if (tonic) matchedProductIds.push(tonic.id);

    const recs = findRecs((r) => r.spiritType === 'Gin').slice(0, 2);
    recs.forEach((r) => matchedRecipeSlugs.push(r.slug));

    responseText = `🍸 **The Botanical Gin Sanctuary:**\n\n` +
      `Gin is all about the botanicals, zest, and effervescence! Here are top picks in stock:\n\n` +
      `• **Malfy Gin Con Rosa (750ml - KSh ${malfy?.price.toLocaleString() || '3,999'}):** Sun-ripened Sicilian pink grapefruit and Italian juniper. Makes the most refreshing **Amalfi Sunset Spritz**!\n` +
      `• **Beefeater London Dry (750ml - KSh ${beefeater?.price.toLocaleString() || '2,000'}):** 9 natural botanicals distilled to perfection. The undefeated king of classic Gin & Tonic.\n\n` +
      `🍋 **Bartender's Secret:** Always slap your rosemary or mint sprig before dropping it in your glass to release the aromatic essential oils!`;

    followUps = ['How to make an Amalfi Sunset Spritz', 'Best gin for a Negroni', 'Show me low-calorie mixers'];
  }
  // 4. Tequila & Margarita queries
  else if (lastMsg.includes('tequila') || lastMsg.includes('margarita') || lastMsg.includes('olmeca') || lastMsg.includes('shot')) {
    const olmeca = findProd((p) => p.name.includes('Olmeca Silver 700ml')) || findProd((p) => p.name.includes('Olmeca'));
    const olmecaGold = findProd((p) => p.name.includes('Olmeca Gold')) || findProd((p) => p.name.includes('Olmeca'));

    if (olmeca) matchedProductIds.push(olmeca.id);
    if (olmecaGold) matchedProductIds.push(olmecaGold.id);

    const recs = findRecs((r) => r.spiritType === 'Tequila').slice(0, 2);
    recs.forEach((r) => matchedRecipeSlugs.push(r.slug));

    responseText = `🌵 **Tequila & Agave Magic:**\n\n` +
      `Handcrafted blue agave straight from Los Altos, Mexico!\n\n` +
      `• **Olmeca Silver (700ml - KSh ${olmeca?.price.toLocaleString() || '2,653'}):** Fresh herbal and green pepper notes with crisp citrus finish. Clean, vibrant, and unmatched for **Olmeca Skinny Margaritas** or chilled shots with lime & sea salt.\n` +
      `• **Olmeca Gold (1L - KSh ${olmecaGold?.price.toLocaleString() || '4,599'}):** Aged in oak barrels with touches of sweet honey and smoky wood.\n\n` +
      `🧂 **Pro Tip:** Rim only *half* your glass with salt so guests can alternate between salted and unsalted sips!`;

    followUps = ['Show me the Skinny Margarita recipe', 'Tequila shots vs sipping tequilas', 'What is a Batanga?'];
  }
  // 5. Cognac / Martell queries
  else if (lastMsg.includes('cognac') || lastMsg.includes('martell') || lastMsg.includes('brandy') || lastMsg.includes('vsop') || lastMsg.includes('blue swift')) {
    const martell = findProd((p) => p.name.includes('Martell VSOP')) || findProd((p) => p.name.includes('Martell VS'));
    const swift = findProd((p) => p.name.includes('Blue Swift'));

    if (martell) matchedProductIds.push(martell.id);
    if (swift) matchedProductIds.push(swift.id);

    const recs = findRecs((r) => r.spiritType === 'Cognac').slice(0, 2);
    recs.forEach((r) => matchedRecipeSlugs.push(r.slug));

    responseText = `🍷 **Cognac Elegance & Royal Heritage:**\n\n` +
      `Cognac from the oldest of the great cognac houses (founded 1715):\n\n` +
      `• **Martell VSOP (700ml - KSh ${martell?.price.toLocaleString() || '8,042'}):** Luscious fruit notes of mirabelle plum, apricot, and luscious candied fruit with subtle oak oakiness.\n` +
      `• **Martell Blue Swift (700ml - KSh ${swift?.price.toLocaleString() || '10,562'}):** Martell VSOP finished in Kentucky bourbon casks—gives seductive ginger, candied fruit, and toasted oak notes.\n\n` +
      `🧊 **Mix Idea:** Try a **Martelito** (Martell + fresh lime juice + ginger ale over ice).`;

    followUps = ['How to make a Martelito', 'Food pairings for Cognac', 'What makes Martell Blue Swift unique?'];
  }
  // 6. Food Pairings
  else if (lastMsg.includes('pairing') || lastMsg.includes('food') || lastMsg.includes('eat') || lastMsg.includes('meat') || lastMsg.includes('dinner')) {
    const wine = findProd((p) => p.name.toLowerCase().includes('shiraz') || p.name.toLowerCase().includes('tempranillo')) || products[0];
    const whiskey = findProd((p) => p.name.includes('Jameson'));

    if (wine) matchedProductIds.push(wine.id);
    if (whiskey) matchedProductIds.push(whiskey.id);

    responseText = `🍽️ **The Sommelier Food & Drink Pairing Matrix:**\n\n` +
      `• **Nyama Choma / Grilled Steak:** Pair with **Jacobs Creek Shiraz** or a smoky **Jameson Black Barrel on the rocks**. The tannins cut right through rich meats.\n` +
      `• **Swahili Seafood / Grilled Fish:** Pair with **Malfy Gin Con Limone Spritz** or chilled **Luc Belaire Brut**.\n` +
      `• **Spicy Wings & Pepper Beef:** An ice-cold **Olmeca Margarita** or chilled **Jaba Juice Hibiscus/Tamarind** balances the fiery heat.\n` +
      `• **Dark Chocolate Desserts:** **Martell VSOP Cognac** or **Kahlúa Espresso Martini**.`;

    followUps = ['Recommend red wine under 2,500 KSh', 'Best drink for spicy food', 'Dessert cocktails'];
  }
  // 7. Fun Facts & Trivia
  else if (lastMsg.includes('fact') || lastMsg.includes('trivia') || lastMsg.includes('history') || lastMsg.includes('origin') || lastMsg.includes('why')) {
    responseText = `🧠 **Fun Drink Trivia from the Bar:**\n\n` +
      `1. **Why does Whiskey Sour use Egg White?** 🥚 In traditional mixology, egg white contains albumin, which creates that silky, creamy velvet foam head on top and softens the sharp acidity of lemon without adding sweetness!\n` +
      `2. **The Negroni's Accidental Birth (1919):** Count Camillo Negroni in Florence asked his bartender to strengthen his Americano by replacing the soda water with Gin. A legend was born!\n` +
      `3. **Agave takes 7–10 years to grow:** Tequila can only be crafted from Blue Weber Agave, which matures under the volcanic soil of Jalisco for up to a decade before harvest!\n\n` +
      `Want to learn how to make one of these iconic mixes? Ask me anytime!`;

    followUps = ['Tell me another fun fact', 'Show me how to make a Negroni', 'Best cocktails for beginners'];
  }
  // 8. General / Budget / Greeting
  else {
    const popular1 = findProd((p) => p.name.includes('Jameson Black Barrel')) || products[0];
    const popular2 = findProd((p) => p.name.includes('Malfy Gin')) || products[1];
    const popular3 = findProd((p) => p.name.includes('Malibu')) || products[2];

    if (popular1) matchedProductIds.push(popular1.id);
    if (popular2) matchedProductIds.push(popular2.id);
    if (popular3) matchedProductIds.push(popular3.id);

    const recs = recipes.slice(0, 2);
    recs.forEach((r) => matchedRecipeSlugs.push(r.slug));

    responseText = `🍸 **Welcome to the Bar! I'm Tipsy, your AI Sommelier & Mixologist.**\n\n` +
      `I know all our live stock, prices in KSh, bottle pairings, and step-by-step recipes for 43 signature cocktails!\n\n` +
      `What can I craft or help you with today?\n` +
      `• **Drink Finder:** Tell me your budget or favourite spirit (Whiskey, Gin, Tequila, Rum, Vodka, Cognac).\n` +
      `• **Cocktail Recipes:** Tell me what ingredients you have in your bar, and I'll find the perfect recipe.\n` +
      `• **Party Planning:** Tell me how many guests you are hosting, and I'll calculate your exact bottle count!`;

    followUps = [
      'What cocktails can I make with Jameson?',
      'Recommend a refreshing gin spritz',
      'Drinks for a party of 10 guests',
      'Tell me a fun cocktail fact',
    ];
  }

  const suggestedProducts = products.filter((p) => matchedProductIds.includes(p.id));
  const suggestedRecipes = recipes.filter((r) => matchedRecipeSlugs.includes(r.slug));

  return {
    content: responseText,
    suggestedProducts,
    suggestedRecipes,
    followUps,
  };
}

export async function askAIBartender(messages) {
  const { products, recipes } = getStoreContext();
  return await callExternalLLM('', messages, products, recipes);
}

