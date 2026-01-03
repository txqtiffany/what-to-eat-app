
import { GoogleGenAI, Type } from "@google/genai";
import { Category, DishType, Ingredient, SuggestedDish, Dish, InstructionStep, UserPreferences, Nutrition } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  private getPreferencesPrompt(prefs?: UserPreferences): string {
    if (!prefs || !prefs.flavors || prefs.flavors.length === 0) return "";
    return `用户口味偏好：${prefs.flavors.join('、')}。请在制定菜谱或推荐时优先考虑这些口味需求。`;
  }

  async proChat(message: string, history: {role: 'user' | 'ai', content: string}[], currentDish?: Dish, prefs?: UserPreferences): Promise<string> {
    const prefsPrompt = this.getPreferencesPrompt(prefs);
    const contextPrompt = currentDish ? 
      `用户当前正在查看菜谱："${currentDish.name}"。该菜谱简介：${currentDish.description}。食材包含：${currentDish.ingredients.map(i => i.name).join(', ')}。` : 
      "用户当前在主页浏览。";

    const response = await this.ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [
        ...history.map(h => ({ 
          role: h.role === 'user' ? 'user' : 'model', 
          parts: [{ text: h.content }] 
        })),
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `你是一个美食专家。${prefsPrompt} ${contextPrompt} 直接回答问题。`,
      }
    });
    return response.text || "抱歉，请再说一遍。";
  }

  async getRecipeDetails(dishName: string, prefs?: UserPreferences): Promise<{
    category: Category;
    dishType: DishType;
    ingredients: Ingredient[];
    instructions: { text: string; timeMinutes: number }[];
    description: string;
    tips: string[];
    nutrition: Nutrition;
  }> {
    const prefsPrompt = this.getPreferencesPrompt(prefs);
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `提供 "${dishName}" 的详细菜谱。同时基于食材和常规分量，估算该菜肴的总营养价值（卡路里、蛋白质、脂肪、碳水）。${prefsPrompt} 返回 JSON。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            dishType: { type: Type.STRING },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, amount: { type: Type.STRING } },
                required: ["name", "amount"],
              },
            },
            instructions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { text: { type: Type.STRING }, timeMinutes: { type: Type.INTEGER } },
                required: ["text", "timeMinutes"],
              },
            },
            description: { type: Type.STRING },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } },
            nutrition: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.INTEGER, description: "单位：kcal" },
                protein: { type: Type.INTEGER, description: "单位：g" },
                fat: { type: Type.INTEGER, description: "单位：g" },
                carbs: { type: Type.INTEGER, description: "单位：g" },
              },
              required: ["calories", "protein", "fat", "carbs"]
            }
          },
          required: ["category", "dishType", "ingredients", "instructions", "description", "tips", "nutrition"],
        },
      },
    });
    return JSON.parse(response.text || "{}");
  }

  async modifyRecipe(dish: Dish, instruction: string): Promise<{
    ingredients: Ingredient[];
    instructions: { text: string; timeMinutes: number }[];
    description: string;
    tips: string[];
    nutrition: Nutrition;
  }> {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `修改菜谱: "${dish.name}"，要求: "${instruction}"。请重新估算修改后的营养价值。返回 JSON。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ingredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, amount: { type: Type.STRING } }, required: ["name", "amount"] } },
            instructions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, timeMinutes: { type: Type.INTEGER } }, required: ["text", "timeMinutes"] } },
            description: { type: Type.STRING },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } },
            nutrition: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.INTEGER },
                protein: { type: Type.INTEGER },
                fat: { type: Type.INTEGER },
                carbs: { type: Type.INTEGER },
              },
              required: ["calories", "protein", "fat", "carbs"]
            }
          },
          required: ["ingredients", "instructions", "description", "tips", "nutrition"],
        },
      },
    });
    return JSON.parse(response.text || "{}");
  }

  async generateDishImage(dishName: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `High quality food photography of ${dishName}, 16:9.` }] },
      config: { imageConfig: { aspectRatio: "16:9" } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Image failed");
  }

  async generateStepImage(stepDescription: string, dishName: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Cooking step: ${stepDescription} for ${dishName}, 16:9.` }] },
      config: { imageConfig: { aspectRatio: "16:9" } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Step image failed");
  }

  async suggestDishes(ingredients: string[], staples: string[], prefs?: UserPreferences): Promise<SuggestedDish[]> {
    const prefsPrompt = this.getPreferencesPrompt(prefs);
    const staplesPrompt = staples.length > 0 
      ? `用户家里已有这些常备调料/基础食材：${staples.join('、')}。
         注意：在返回的 missingIngredients 中，请绝对不要包含这些常备调料，默认用户已经拥有它们。` 
      : "";

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `我有以下主要食材：${ingredients.join('、')}。
      ${staplesPrompt}
      请推荐 3-5 道适合做的菜。
      要求：
      1. 尽量利用已有食材。
      2. missingIngredients 仅包含用户目前完全没有且必须去购买的关键食材。
      3. ${prefsPrompt}
      4. 返回 JSON 格式。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              dishType: { type: Type.STRING },
              reason: { type: Type.STRING },
              missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["name", "category", "dishType", "reason"],
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  }

  async getDiscoveryRecommendations(prefs?: UserPreferences): Promise<SuggestedDish[]> {
    const prefsPrompt = this.getPreferencesPrompt(prefs);
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `推荐 6 道流行美食。${prefsPrompt} 返回 JSON。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              dishType: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ["name", "category", "dishType", "reason"],
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  }
}

export const geminiService = new GeminiService();
