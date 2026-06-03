import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_CONFIG } from "@/lib/config";
import { readEnv } from "@/lib/env";

let _client: Anthropic | null = null;
let _clientKey: string | null = null;

type AnthropicJsonOptions = {
  maxTokens?: number;
  timeoutMs?: number;
};

function getClient(): Anthropic | null {
  const env = readEnv();
  if (!env.anthropicApiKey) return null;
  if (!_client || _clientKey !== env.anthropicApiKey) {
    _client = new Anthropic({ apiKey: env.anthropicApiKey });
    _clientKey = env.anthropicApiKey;
  }
  return _client;
}

function normalizeOptions(
  options?: number | AnthropicJsonOptions,
): Required<AnthropicJsonOptions> {
  if (typeof options === "number") {
    return {
      maxTokens: options,
      timeoutMs: ANTHROPIC_CONFIG.requestTimeoutMs,
    };
  }

  return {
    maxTokens: options?.maxTokens ?? ANTHROPIC_CONFIG.maxTokens,
    timeoutMs: options?.timeoutMs ?? ANTHROPIC_CONFIG.requestTimeoutMs,
  };
}

async function _askJson<T>(
  model: string,
  prompt: string,
  options?: number | AnthropicJsonOptions,
): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  const requestOptions = normalizeOptions(options);

  try {
    const message = await client.messages.create(
      {
        model,
        max_tokens: requestOptions.maxTokens,
        temperature: ANTHROPIC_CONFIG.temperature,
        system: ANTHROPIC_CONFIG.systemPrompt,
        messages: [{ role: "user", content: prompt }],
      },
      {
        timeout: requestOptions.timeoutMs,
        maxRetries: ANTHROPIC_CONFIG.maxRetries,
      },
    );

    const raw = message.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("\n")
      .trim();

    if (!raw) return null;
    const text = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    return JSON.parse(text) as unknown as T;
  } catch {
    return null;
  }
}

export async function askAnthropicJson<T>(
  prompt: string,
  options?: number | AnthropicJsonOptions,
): Promise<T | null> {
  return _askJson<T>(readEnv().anthropicModel, prompt, options);
}

export async function askAnthropicJsonFast<T>(
  prompt: string,
  options?: number | AnthropicJsonOptions,
): Promise<T | null> {
  return _askJson<T>(ANTHROPIC_CONFIG.fastModel, prompt, options);
}
