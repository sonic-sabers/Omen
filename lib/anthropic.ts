import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_CONFIG } from "@/lib/config";
import { readEnv } from "@/lib/env";

export async function askAnthropicJson<T>(prompt: string): Promise<T | null> {
  const env = readEnv();
  if (!env.anthropicApiKey) return null;

  const client = new Anthropic({ apiKey: env.anthropicApiKey });

  try {
    const message = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: ANTHROPIC_CONFIG.maxTokens,
      temperature: ANTHROPIC_CONFIG.temperature,
      system: ANTHROPIC_CONFIG.systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("\n")
      .trim();

    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
