// ─── Tavily Service — Real-Time Company Research ─────────────────────
// Enhanced with GLiNER entity extraction and Tavily Extract API.
// The pipeline: Yutori finds jobs → GLiNER extracts skills from JD →
// Tavily searches using those skills → GLiNER structures the search
// results → rich CompanyIntel is produced.

import { config } from "../config";
import {
  TavilySearchResponse,
  TavilyExtractResponse,
  CompanyIntel,
  NewsItem,
  ExtractedEntity,
} from "../types";
import * as glinerService from "./gliner-service";

const TAVILY_BASE = config.tavily.baseUrl;

// ─── Result Cache (TTL: 24 hours) ───────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const companyCache = new Map<string, CacheEntry<CompanyIntel>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Core Tavily Request ─────────────────────────────────────────────

async function tavilyRequest(
  endpoint: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${TAVILY_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.tavily.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Search ──────────────────────────────────────────────────────────

export async function search(
  query: string,
  options: {
    searchDepth?: "basic" | "advanced" | "fast";
    topic?: "general" | "news" | "finance";
    maxResults?: number;
    includeAnswer?: boolean;
    includeRawContent?: boolean;
    timeRange?: "day" | "week" | "month" | "year";
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<TavilySearchResponse> {
  const response = await tavilyRequest("/search", {
    query,
    search_depth: options.searchDepth || "advanced",
    topic: options.topic || "general",
    max_results: options.maxResults || 10,
    include_answer: options.includeAnswer ?? true,
    include_raw_content: options.includeRawContent ?? false,
    time_range: options.timeRange,
    include_domains: options.includeDomains,
    exclude_domains: options.excludeDomains,
  });

  return response as TavilySearchResponse;
}

// ─── Extract API — Pull clean content from URLs ──────────────────────

export async function extract(urls: string[]): Promise<TavilyExtractResponse> {
  console.log(`[Tavily] Extracting content from ${urls.length} URLs`);

  const response = await tavilyRequest("/extract", {
    urls,
  });

  return response as TavilyExtractResponse;
}

// ─── GLiNER-Powered Entity Extraction ────────────────────────────────
// Replaces the old hardcoded keyword matching with real NER

async function extractTechEntities(text: string): Promise<ExtractedEntity[]> {
  return glinerService.extractEntities(text, [
    "programming_language",
    "framework",
    "technology",
    "database",
    "cloud_service",
    "tool",
    "methodology",
  ], 0.35);
}

async function extractProductEntities(text: string): Promise<string[]> {
  const entities = await glinerService.extractEntities(text, [
    "product",
    "platform",
    "service",
    "tool",
  ], 0.4);
  // Deduplicate
  const seen = new Set<string>();
  return entities
    .filter((e) => {
      const key = e.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((e) => e.text);
}

async function extractFundingEntities(text: string): Promise<string | undefined> {
  const entities = await glinerService.extractEntities(text, [
    "funding_round",
    "investment",
    "valuation",
  ], 0.3);

  if (entities.length > 0) {
    return entities[0].text;
  }

  // Regex fallback for dollar amounts + series letters
  const fundingPatterns = [
    /series\s+[a-f]/i,
    /seed\s+(?:round|funding)/i,
    /raised\s+\$[\d.]+\s*[mkb]/i,
    /pre-seed/i,
    /ipo/i,
  ];
  for (const pattern of fundingPatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

// ─── Smart Company Research (Tavily + GLiNER) ────────────────────────
// 1) Fires parallel Tavily searches with domain filtering
// 2) Runs GLiNER NER on search results instead of keyword matching
// 3) Uses Tavily Extract for deep content from key URLs
// 4) Caches results for 24h per company

export async function researchCompany(
  companyName: string,
  jobContext?: { techStack?: string[]; requiredSkills?: string[] }
): Promise<CompanyIntel> {
  // Check cache first
  const cacheKey = companyName.toLowerCase();
  const cached = getCached(companyCache, cacheKey);
  if (cached) {
    console.log(`[Tavily] Cache hit for ${companyName}`);
    return cached;
  }

  console.log(`[Tavily] Researching company: ${companyName} (with GLiNER enhancement)`);

  // Build context-aware search queries using job data
  const techQuery = jobContext?.techStack?.length
    ? `${companyName} engineering ${jobContext.techStack.slice(0, 5).join(" ")} tech stack`
    : `${companyName} engineering tech stack technology infrastructure`;

  // Step 1: Parallel Tavily searches with domain filtering
  const [newsResults, techResults, cultureResults] = await Promise.all([
    search(`${companyName} recent news funding product launches 2025 2026`, {
      topic: "news",
      searchDepth: "advanced",
      maxResults: 8,
      includeAnswer: true,
      includeRawContent: true,
      timeRange: "month",
      excludeDomains: ["pinterest.com", "facebook.com", "twitter.com"],
    }),
    search(techQuery, {
      topic: "general",
      searchDepth: "advanced",
      maxResults: 5,
      includeAnswer: true,
      includeRawContent: true,
      includeDomains: [
        "stackshare.io", "github.com", "linkedin.com",
        "builtwith.com", "blog.*",
      ],
    }),
    search(`${companyName} company culture work environment employee reviews engineering team`, {
      topic: "general",
      searchDepth: "basic",
      maxResults: 5,
      includeAnswer: true,
      includeDomains: [
        "glassdoor.com", "linkedin.com", "levels.fyi",
        "teamblind.com", "comparably.com",
      ],
    }),
  ]);

  // Step 2: Deep extract from the most relevant blog/press URLs
  const extractUrls = [
    ...techResults.results.slice(0, 2).map((r) => r.url),
    ...newsResults.results.slice(0, 2).map((r) => r.url),
  ].filter((url) =>
    !url.includes("linkedin.com") && // LinkedIn blocks extraction
    !url.includes("glassdoor.com")
  );

  let extractedContent = "";
  if (extractUrls.length > 0) {
    try {
      const extracted = await extract(extractUrls);
      extractedContent = extracted.results
        .map((r) => r.raw_content)
        .filter(Boolean)
        .join(" ");
    } catch (err) {
      console.warn(`[Tavily] Extract failed for ${companyName}:`, err);
    }
  }

  // Step 3: Combine all text for GLiNER analysis
  const allSearchText = [
    ...techResults.results.map((r) => r.raw_content || r.content),
    ...newsResults.results.map((r) => r.raw_content || r.content),
    extractedContent,
  ].join(" ");

  const allNewsText = newsResults.results
    .map((r) => r.raw_content || r.content)
    .join(" ");

  // Step 4: Run GLiNER NER on all collected text (parallel)
  const [techEntities, products, fundingStage] = await Promise.all([
    extractTechEntities(allSearchText),
    extractProductEntities(allNewsText),
    extractFundingEntities(allNewsText),
  ]);

  // Deduplicate tech entities
  const techStackSet = new Set<string>();
  for (const ent of techEntities) {
    techStackSet.add(ent.text);
  }
  const techStack = Array.from(techStackSet);

  // Build news items with published dates
  const recentNews: NewsItem[] = newsResults.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    publishedDate: r.published_date,
  }));

  const intel: CompanyIntel = {
    name: companyName,
    recentNews,
    techStack,
    culture: cultureResults.answer || cultureResults.results[0]?.content || "",
    products,
    summary: newsResults.answer || "",
    fundingStage,
    employeeCount: undefined,
  };

  // Cache the result
  setCache(companyCache, cacheKey, intel);

  console.log(
    `[Tavily+GLiNER] Research complete for ${companyName}: ` +
    `${recentNews.length} news, ${techStack.length} technologies (NER), ` +
    `${products.length} products, funding: ${fundingStage || "unknown"}`
  );

  return intel;
}

// ─── GLiNER-Enhanced Skill Extraction from JD ────────────────────────
// Combines Yutori's JD text + GLiNER NER for structured skill lists

export async function extractSkillsFromJD(
  jdText: string
): Promise<{
  required: ExtractedEntity[];
  preferred: ExtractedEntity[];
  allTech: ExtractedEntity[];
}> {
  console.log(`[Tavily+GLiNER] Extracting skills from JD (${jdText.length} chars)`);

  // Split the JD into sections if possible
  const lowerJD = jdText.toLowerCase();
  const requiredIdx = lowerJD.indexOf("required") !== -1
    ? lowerJD.indexOf("required")
    : lowerJD.indexOf("must have") !== -1
      ? lowerJD.indexOf("must have")
      : lowerJD.indexOf("requirements");
  const preferredIdx = lowerJD.indexOf("preferred") !== -1
    ? lowerJD.indexOf("preferred")
    : lowerJD.indexOf("nice to have") !== -1
      ? lowerJD.indexOf("nice to have")
      : lowerJD.indexOf("bonus");

  const allEntities = await glinerService.extractJDSkills(jdText);

  // If we can identify required vs preferred sections, tag them
  let required: ExtractedEntity[] = [];
  let preferred: ExtractedEntity[] = [];

  if (requiredIdx !== -1 && preferredIdx !== -1 && preferredIdx > requiredIdx) {
    const requiredSection = jdText.slice(requiredIdx, preferredIdx);
    const preferredSection = jdText.slice(preferredIdx);
    required = await glinerService.extractJDSkills(requiredSection);
    preferred = await glinerService.extractJDSkills(preferredSection);
  } else {
    // Can't split — treat high-confidence as required, lower as preferred
    required = allEntities.filter((e) => e.score >= 0.6);
    preferred = allEntities.filter((e) => e.score < 0.6 && e.score >= 0.3);
  }

  return { required, preferred, allTech: allEntities };
}

// ─── Smart Search: Context-Aware Tavily Query ────────────────────────
// Uses GLiNER entities from the JD to build targeted search queries

export async function smartCompanySearch(
  companyName: string,
  jdEntities: ExtractedEntity[]
): Promise<TavilySearchResponse> {
  // Group entities by label for targeted queries
  const techTerms = jdEntities
    .filter((e) => ["technology", "framework", "programming_language", "database", "cloud_service"].includes(e.label))
    .map((e) => e.text)
    .slice(0, 6);

  const query = techTerms.length > 0
    ? `${companyName} engineering blog ${techTerms.join(" ")} experience`
    : `${companyName} engineering blog tech stack`;

  return search(query, {
    searchDepth: "advanced",
    maxResults: 5,
    includeAnswer: true,
    includeRawContent: true,
    excludeDomains: ["pinterest.com", "facebook.com"],
  });
}

// ─── Cache Management ────────────────────────────────────────────────

export function clearCompanyCache(companyName?: string): void {
  if (companyName) {
    companyCache.delete(companyName.toLowerCase());
  } else {
    companyCache.clear();
  }
}

export function getCacheStats(): {
  entries: number;
  companies: string[];
} {
  return {
    entries: companyCache.size,
    companies: Array.from(companyCache.keys()),
  };
}
