
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";
import { decode, decodeAudioData } from "../utils/audioUtils";

const MODEL_NAME = 'gemini-2.5-flash-preview-tts';

export async function generateTTS(
  text: string, 
  voice: VoiceName = VoiceName.KORE
): Promise<{ audioBuffer: AudioBuffer; sampleRate: number }> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Gemini 2.5 Flash Preview TTS is optimized for single-speaker or multi-speaker.
  // We'll use single speaker for this simple tool.
  // Instructions: We want it to speak clearly in Vietnamese if the text is Vietnamese.
  const prompt = `Please speak this text clearly and naturally: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("No audio data received from Gemini API.");
    }

    const sampleRate = 24000; // Gemini TTS default sample rate
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
    
    const audioBytes = decode(base64Audio);
    const audioBuffer = await decodeAudioData(audioBytes, audioContext, sampleRate, 1);

    return { audioBuffer, sampleRate };
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
}
