import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY or GEMINI_API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow OPTIONS method for CORS preflight (if needed)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { history, systemInstruction } = req.body || {};

    if (!history) {
      if (!req.body || Object.keys(req.body).length === 0) {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [],
          config: {
            systemInstruction: systemInstruction,
          },
        });
        return res.status(200).json({ text: response.text });
      }
      return res.status(400).json({ error: 'Missing history in request body.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    return res.status(200).json({ text: response.text });
  } catch (error) {
    console.error('Error in Gemini serverless function:', error);
    const message = error instanceof Error ? error.message : 'Failed to process chat message.';
    return res.status(500).json({ error: message });
  }
}
