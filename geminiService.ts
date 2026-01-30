import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "./constants";
import { Message } from "./types";

export class TTMAIService {
  private ai: GoogleGenAI;
  private chat: Chat;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.chat = this.ai.chats.create({
      model: "gemini-3-pro-preview",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });
  }

  async sendMessage(text: string): Promise<string> {
    try {
      const result: GenerateContentResponse = await this.chat.sendMessage({ message: text });
      return result.text || "ขออภัย ระบบไม่สามารถประมวลผลได้ในขณะนี้";
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      
      // Check for Quota Exhausted (429)
      const errorStr = JSON.stringify(error).toLowerCase();
      if (errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("resource_exhausted")) {
        return "ERROR_QUOTA";
      }

      if (errorStr.includes("requested entity was not found")) {
         return "ERROR_API_KEY";
      }
      
      return "ขออภัย เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบปัญญาประดิษฐ์";
    }
  }
}