import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY or GEMINI_API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { audio, mimeType } = req.body || {};

    if (!audio || !mimeType) {
      return res.status(400).json({ error: 'Missing audio data or mimeType.' });
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType,
        data: audio,
      },
    };
    const textPart = {
      text: "Transcribe este audio. Responde únicamente con el texto transcrito, sin ningún comentario adicional o frases como 'Aquí está la transcripción'."
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [audioPart, textPart] },
    });

    return res.status(200).json({ text: response.text });
  } catch (error) {
    console.error('Error in transcribe serverless function:', error);
    return res.status(500).json({ error: 'Failed to transcribe audio.' });
  }
}
