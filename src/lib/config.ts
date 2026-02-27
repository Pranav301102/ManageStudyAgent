// ─── Environment Configuration ──────────────────────────────────────
// All API keys are read from environment variables (.env.local)

export const config = {
  yutori: {
    apiKey: process.env.YUTORI_API_KEY || "",
    baseUrl: "https://api.yutori.com/v1",
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || "",
    baseUrl: "https://api.tavily.com",
  },
  neo4j: {
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    username: process.env.NEO4J_USER || process.env.NEO4J_USERNAME || "neo4j",
    password: process.env.NEO4J_PASSWORD || "",
    database: process.env.NEO4J_DATABASE || "neo4j",
  },
  modulate: {
    // Modulate Velma-2 STT + Emotion + Accent APIs
    apiKey: process.env.MODULATE_API_KEY || "",
    baseUrl: process.env.MODULATE_BASE_URL || "https://modulate-developer-apis.com",
  },
  gemini: {
    // Gemini 2.5 Flash via Google's OpenAI-compatible endpoint
    apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  },
  fastino: {
    apiKey: process.env.FASTINO_API_KEY || "",
    baseUrl: "https://api.fastino.ai/v1",
  },
  reka: {
    apiKey: process.env.REKA_API_KEY || "",
    baseUrl: "https://api.reka.ai/v1",
  },
  pioneer: {
    // Pioneer by Fastino Labs — GLiNER-2 cloud-first inference + fine-tuning
    // PRIMARY extraction engine; local GLiNER is fallback only
    apiKey: process.env.PIONEER_API_KEY || "",
    baseUrl: process.env.PIONEER_BASE_URL || "https://api.pioneer.ai",
    modelId: process.env.PIONEER_MODEL_ID || "gliner-2",
  },
  gliner: {
    // Local GLiNER microservice — FALLBACK when Pioneer cloud is unavailable
    // Start it with: cd services/gliner && python main.py
    baseUrl: process.env.GLINER_API_URL || "http://localhost:8080",
  },
  app: {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    webhookSecret: process.env.WEBHOOK_SECRET || "dev-secret",
  },
} as const;
