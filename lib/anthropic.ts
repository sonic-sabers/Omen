import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_CONFIG } from "@/lib/config";
import { readEnv } from "@/lib/env";

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const env = readEnv();
  if (!env.anthropicApiKey) return null;
  if (!_client) _client = new Anthropic({ apiKey: env.anthropicApiKey });
  return _client;
}

export async function askAnthropicJson<T>(prompt: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const message = await client.messages.create({
      model: readEnv().anthropicModel,
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
