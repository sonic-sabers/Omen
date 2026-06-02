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

async function _askJson<T>(model: string, prompt: string, maxTokens: number): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const message = await client.messages.create({
      model,
      max_tokens: maxTokens,
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

export async function askAnthropicJson<T>(prompt: string, maxTokens?: number): Promise<T | null> {
  return _askJson<T>(readEnv().anthropicModel, prompt, maxTokens ?? ANTHROPIC_CONFIG.maxTokens);
}

export async function askAnthropicJsonFast<T>(prompt: string, maxTokens?: number): Promise<T | null> {
  return _askJson<T>(ANTHROPIC_CONFIG.fastModel, prompt, maxTokens ?? ANTHROPIC_CONFIG.maxTokens);
}
