import { ANTHROPIC_CONFIG } from "@/lib/config";

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export interface EnvConfig {
  anthropicModel: string;
  anthropicApiKey?: string;
  tavilyApiKey?: string;
}

export function readEnv(): EnvConfig {
  return {
    anthropicModel: getEnv("ANTHROPIC_MODEL") ?? ANTHROPIC_CONFIG.defaultModel,
    anthropicApiKey: getEnv("ANTHROPIC_API_KEY"),
    tavilyApiKey: getEnv("TAVILY_API_KEY"),
  };
}

export function assertLiveEnv() {
  const env = readEnv();
  const missing: string[] = [];
  if (!env.anthropicApiKey) missing.push("ANTHROPIC_API_KEY");
  if (!env.tavilyApiKey) missing.push("TAVILY_API_KEY");
  if (missing.length > 0) {
    throw new Error(`Missing required live-mode environment variables: ${missing.join(", ")}`);
  }
  return env;
}
