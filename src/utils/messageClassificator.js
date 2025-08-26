import OpenAI from "openai";
import axios from "axios";
import * as deepl from "deepl-node";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

const categories = 
{
    confirmation: ["confirm", "yes", "1"],
    address_change: ["change address", "update address", "new address", "2"],
    cancellation: ["cancel", "no", "3", "not interested"]
}

async function translateToEnglish(text) {

    try {
        const result = await translator.translateText(text, null, "en-US");
        return result.text;
    } catch (error) {
        console.error("Erro ao traduzir texto:", error);
        throw error;
    }
}

export async function classifyMessage(message) {
    const translatedMessage = await translateToEnglish(message);
    const category = Object.keys(categories).find((key) =>
        categories[key].includes(translatedMessage.toLowerCase())
    );
    
    if (category) {
        return category;
        
    } else {
        const prompt = 
            `Classify the following message into
            one of the following categories: 
            confirmation, address_change, cancellation. 
            DO NOT write anything other than the category.
            \n\nMessage: ${message}`;
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "user", content: prompt }
            ],
            max_tokens: 50,
        });
        const classification = response.choices[0].message.content.trim().toLowerCase() || "unknown";
        return classification;
    }
}
