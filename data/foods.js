/**
 * Foodsphere Nutritio Intelligence - Budget-Aware AI Meal Planner
 * Sample Food & Nutrition Dataset (Bangladeshi Context)
 * 
 * DISCLAIMER & DATA NOTES:
 * 1. PRICING: Prices in Bangladeshi Taka (BDT / ৳) are illustrative reference estimates
 *    for a typical urban retail market (e.g., Dhaka). They are NOT live market prices and
 *    are not connected to any price data source. Real prices vary by area, season and shop.
 * 2. NUTRITION: Values are approximate reference figures per the stated serving quantity.
 *    The `referenceSource` fields name the kind of table they were drawn from (FCTB / USDA
 *    FoodData Central), but the numbers have NOT been independently re-verified or
 *    laboratory-tested. They vary by variety, cut, cooking method and brand.
 * 3. SCOPE: Recipe costs cover the MAIN ingredients listed only. Cooking oil, onion, salt
 *    and spices are not priced or counted.
 * 4. EDITABILITY: To adjust prices or add foods, simply edit the values below.
 */

const BANGLADESHI_FOOD_DATABASE = [
  {
    id: "rice",
    shortName: "Rice",
    bengaliName: "চাল",
    aliases: ["rice", "chal", "chaal", "bhat", "bhaat", "চাল", "ভাত"], // whole-word names the pantry matcher recognises
    name: "Rice (White / Parboiled চাল)",
    category: "Grain",
    referenceQuantity: 100,
    unit: "g",
    servingDescription: "100g uncooked raw grain (yields ~250g cooked bhaat)",
    estimatedPriceBDT: 7.00, // Illustrative estimate: ~৳70 per kg
    nutrition: {
      calories: 356,  // kcal per 100g raw
      protein: 7.1,   // grams
      carbs: 78.5,    // grams
      fat: 0.6        // grams
    },
    referenceSource: "Food Composition Table for Bangladesh (FCTB)"
  },
  {
    id: "egg",
    shortName: "Eggs",
    bengaliName: "ডিম",
    aliases: ["egg", "eggs", "dim", "anda", "ডিম"], // whole-word names the pantry matcher recognises
    name: "Egg (Chicken ডিম)",
    category: "Protein",
    referenceQuantity: 1,
    unit: "piece",
    servingDescription: "1 standard medium egg (~50g edible portion)",
    estimatedPriceBDT: 13.50, // Illustrative estimate: ~৳54 for a 4-egg hali
    nutrition: {
      calories: 72,   // kcal per egg
      protein: 6.3,   // grams
      carbs: 0.4,     // grams
      fat: 4.8        // grams
    },
    referenceSource: "USDA FoodData Central / FCTB"
  },
  {
    id: "lentils_daal",
    shortName: "Daal",
    bengaliName: "ডাল",
    aliases: ["lentil", "lentils", "daal", "dal", "dhal", "masoor", "ডাল", "মসুর"], // whole-word names the pantry matcher recognises
    name: "Lentils / Daal (Masoor ডাল)",
    category: "Legume",
    referenceQuantity: 100,
    unit: "g",
    servingDescription: "100g dry raw lentils",
    estimatedPriceBDT: 14.00, // Illustrative estimate: ~৳140 per kg
    nutrition: {
      calories: 343,  // kcal per 100g dry
      protein: 24.6,  // grams
      carbs: 59.0,    // grams
      fat: 1.1        // grams
    },
    referenceSource: "Food Composition Table for Bangladesh (FCTB)"
  },
  {
    id: "potato",
    shortName: "Potatoes",
    bengaliName: "আলু",
    aliases: ["potato", "potatoes", "alu", "aloo", "আলু"], // whole-word names the pantry matcher recognises
    name: "Potatoes (আলু)",
    category: "Vegetable / Tuber",
    referenceQuantity: 100,
    unit: "g",
    servingDescription: "100g fresh raw potato (approx. 1 medium potato)",
    estimatedPriceBDT: 4.50, // Illustrative estimate: ~৳45 per kg
    nutrition: {
      calories: 77,   // kcal per 100g
      protein: 2.0,   // grams
      carbs: 17.5,    // grams
      fat: 0.1        // grams
    },
    referenceSource: "USDA FoodData Central / FCTB"
  },
  {
    id: "seasonal_vegetables",
    shortName: "Vegetables",
    bengaliName: "সবজি",
    aliases: ["vegetable", "vegetables", "veggies", "veg", "shobji", "sobji", "sabji", "torkari", "সবজি", "তরকারি"], // whole-word names the pantry matcher recognises
    name: "Seasonal Vegetables (সবজি)",
    category: "Vegetable",
    referenceQuantity: 100,
    unit: "g",
    servingDescription: "100g mixed local vegetables (e.g. gourd, pumpkin, green papaya, leafy greens)",
    estimatedPriceBDT: 5.50, // Illustrative estimate: ~৳55 per kg
    nutrition: {
      calories: 32,   // kcal per 100g average composite
      protein: 1.8,   // grams
      carbs: 6.0,     // grams
      fat: 0.2        // grams
    },
    referenceSource: "FCTB Composite Average for Common BD Vegetables"
  },
  {
    id: "roti",
    shortName: "Roti / Atta",
    bengaliName: "রুটি",
    aliases: ["roti", "ruti", "rooti", "chapati", "chapatti", "atta", "flatbread", "রুটি", "আটা"], // whole-word names the pantry matcher recognises
    name: "Roti / Chapati (আটার রুটি)",
    category: "Grain",
    referenceQuantity: 1,
    unit: "piece",
    servingDescription: "1 handmade whole wheat flatbread (~35g cooked)",
    estimatedPriceBDT: 6.00, // Illustrative estimate: ~৳60/kg atta flour + home preparation
    nutrition: {
      calories: 88,   // kcal per roti
      protein: 3.1,   // grams
      carbs: 18.2,    // grams
      fat: 0.5        // grams
    },
    referenceSource: "FCTB / Whole Wheat Flatbread Standards"
  },
  {
    id: "fish",
    shortName: "Fish",
    bengaliName: "মাছ",
    aliases: ["fish", "mach", "maach", "rui", "rohu", "মাছ", "রুই"], // whole-word names the pantry matcher recognises
    name: "Fish (Rui / Rohu Carpo রুই মাছ)",
    category: "Protein",
    referenceQuantity: 100,
    unit: "g",
    servingDescription: "100g raw dressed edible portion (approx. 1 medium cut piece)",
    estimatedPriceBDT: 38.00, // Illustrative estimate: ~৳380 per kg dressed
    nutrition: {
      calories: 111,  // kcal per 100g edible portion
      protein: 16.6,  // grams
      carbs: 0.0,     // grams
      fat: 4.5        // grams
    },
    referenceSource: "Food Composition Table for Bangladesh (FCTB)"
  },
  {
    id: "chicken",
    shortName: "Chicken",
    bengaliName: "মুরগি",
    aliases: ["chicken", "murgi", "murgir", "broiler", "মুরগি"], // whole-word names the pantry matcher recognises
    name: "Chicken (Broiler dressed ব্রয়লার মুরগি)",
    category: "Protein",
    referenceQuantity: 100,
    unit: "g",
    servingDescription: "100g bone-in raw cuts",
    estimatedPriceBDT: 21.00, // Illustrative estimate: ~৳210 per kg dressed
    nutrition: {
      calories: 165,  // kcal per 100g
      protein: 18.2,  // grams
      carbs: 0.0,     // grams
      fat: 9.8        // grams
    },
    referenceSource: "USDA FoodData Central / FCTB"
  },
  {
    id: "banana",
    shortName: "Banana",
    bengaliName: "কলা",
    aliases: ["banana", "bananas", "kola", "কলা"], // whole-word names the pantry matcher recognises
    name: "Banana (কলা - Sagor / Champa)",
    category: "Fruit",
    referenceQuantity: 1,
    unit: "piece",
    servingDescription: "1 medium fresh banana (~100g edible pulp)",
    estimatedPriceBDT: 10.00, // Illustrative estimate: ~৳10-12 per piece
    nutrition: {
      calories: 89,   // kcal per banana
      protein: 1.1,   // grams
      carbs: 22.8,    // grams
      fat: 0.3        // grams
    },
    referenceSource: "USDA FoodData Central / FCTB"
  },
  {
    id: "milk",
    shortName: "Milk",
    bengaliName: "দুধ",
    aliases: ["milk", "dudh", "doodh", "দুধ"], // whole-word names the pantry matcher recognises
    name: "Milk (Liquid Cow's Milk তরল দুধ)",
    category: "Dairy",
    referenceQuantity: 250,
    unit: "ml",
    servingDescription: "1 glass / cup (250 ml)",
    estimatedPriceBDT: 24.00, // Illustrative estimate: ~৳96 per 1L packet
    nutrition: {
      calories: 152,  // kcal per 250ml
      protein: 8.1,   // grams
      carbs: 12.0,    // grams
      fat: 8.0        // grams
    },
    referenceSource: "Food Composition Table for Bangladesh (FCTB)"
  }
];

// Helper method to look up a food item by ID
function getFoodItemById(id) {
  return BANGLADESHI_FOOD_DATABASE.find(item => item.id === id) || null;
}

// Export for environments that support ES modules or Node, while keeping it accessible globally in standard browser scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BANGLADESHI_FOOD_DATABASE, getFoodItemById };
}
