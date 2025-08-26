import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});



function parseGPTResponseToJson(text) {
  try {
    const json = JSON.parse(text.trim());
    return json;
  } catch (err) {
    console.warn("Failed to parse GPT response as JSON:", text);
    return null; // Retorna null se não conseguir parsear
  }
}


export async function extractAndValidateAddress(message) {
    const prompt = `
    You are an assistant that extracts addresses from user messages.
    If the message contains an address, return a JSON with the following fields:
    \n\n

    {
        "address1": "",
        "address2": "",
        "city": "",
        "state": "",
        "postal_code": "",
        "country": ""
    }
    \n\n

    If there is no address, return null. Fill in the fields you can identify.
    Do not return any text outside of the JSON.
    \n

    Message: "${message}"`;

    const response = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0
    });

    const address = response.choices[0].message.content.trim();

    const parsedAddress = parseGPTResponseToJson(address);
    if (!parsedAddress) return null;
    console.log("Parsed address:", parsedAddress);
    return parsedAddress;

}

