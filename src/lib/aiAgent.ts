// ===========================================
// ChainBreaker AI — LLM-Powered Fact Check Agent
// Fixed for Free Model Reliability
// ===========================================

import axios from "axios";

// =====================================================
// TYPES
// =====================================================

export interface FactCheckVerdict {
  verdict: "true" | "false" | "misleading" | "unverified";
  confidence: number;
  summary: string;
  sources: Array<{ name: string; url: string }>;
  toolCalls?: number;
}

interface ToolAction {
  action: string;
  input: string;
}

// =====================================================
// LLM CLIENT WITH BETTER ERROR HANDLING
// =====================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!;

// If you have ANY paid API key, use these instead:
const LLM_MODELS = [
  "anthropic/claude-3.5-sonnet",  // Best reasoning, costs ~$3 per million tokens
  "openai/gpt-4o-mini",            // Cheap & fast, ~$0.15 per million tokens
  "google/gemini-flash-1.5",       // Very cheap
  // Fallback to free (but heavily rate-limited):
  "qwen/qwen3-4b:free",
  "mistralai/mistral-small-3.1-24b:free"
];

async function callLLM(
  messages: any[],
  modelIndex: number = 0
): Promise<string> {
  if (modelIndex >= LLM_MODELS.length) {
    throw new Error("ALL_LLM_MODELS_FAILED");
  }

  const model = LLM_MODELS[modelIndex];
  console.log(`🤖 Trying Model: ${model}`);

  try {
    // Add delay to avoid rate limits
    if (modelIndex > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const resp = await axios.post(
      OPENROUTER_URL,
      {
        model,
        messages,
        max_tokens: 800,
        temperature: 0.2,
        top_p: 0.9
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": "http://localhost",
          "X-Title": "ChainBreaker-AI",
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const content = resp.data?.choices?.[0]?.message?.content || "";
    
    if (!content || content.trim().length < 10) {
      console.log(`⚠️ Model returned empty/short response, trying next...`);
      return callLLM(messages, modelIndex + 1);
    }
    
    return content;
  } catch (err: any) {
    console.log(`❌ Model ${model} failed:`, err.message);
    return callLLM(messages, modelIndex + 1);
  }
}

// =====================================================
// AGGRESSIVE JSON EXTRACTION
// =====================================================

function extractJSON(text: string): any | null {
  console.log("🔍 Extracting JSON from:", text.substring(0, 200));

  // Strategy 1: Remove all common junk
  let cleaned = text
    .replace(/<\/?s>/g, "")
    .replace(/<\|.*?\|>/g, "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .replace(/^[^{]*/, "")
    .replace(/[^}]*$/, "")
    .trim();

  console.log("🧹 Cleaned:", cleaned.substring(0, 200));

  // Strategy 2: Find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log("⚠️ JSON parse failed on match");
    }
  }

  // Strategy 3: Try to find key-value pairs and reconstruct
  const actionMatch = text.match(/"action"\s*:\s*"([^"]+)"/);
  const inputMatch = text.match(/"input"\s*:\s*"([^"]+)"/);
  
  if (actionMatch) {
    return {
      action: actionMatch[1],
      input: inputMatch ? inputMatch[1] : ""
    };
  }

  return null;
}

// =====================================================
// TOOL FUNCTIONS
// =====================================================

async function googleFactCheck(query: string) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return { ok: true, claims: [], message: "API key not configured" };
    }

    const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(
      query
    )}&key=${process.env.GOOGLE_API_KEY}`;

    const resp = await axios.get(url, { timeout: 8000 });
    return { ok: true, claims: resp.data?.claims || [] };
  } catch {
    return { ok: false, claims: [] };
  }
}

async function wikiSearch(query: string) {
  try {
    const searchResp = await axios.get(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&format=json&srlimit=1`,
      {
        timeout: 8000,
        headers: { "User-Agent": "ChainBreaker-AI/1.0" }
      }
    );

    if (!searchResp.data?.query?.search?.length)
      return { ok: true, found: false, message: "No Wikipedia article found" };

    const title = searchResp.data.query.search[0].title;
    const summaryResp = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { timeout: 8000, headers: { "User-Agent": "ChainBreaker-AI/1.0" } }
    );

    return {
      ok: true,
      found: true,
      title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      summary: summaryResp.data.extract
    };
  } catch {
    return { ok: false, found: false };
  }
}

async function ddgSearch(query: string) {
  try {
    const resp = await axios.get(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { timeout: 8000 }
    );

    return {
      ok: true,
      abstract: resp.data.Abstract || "",
      url: resp.data.AbstractURL || "",
      heading: resp.data.Heading || ""
    };
  } catch {
    return { ok: false, abstract: "" };
  }
}

async function newsSearch(query: string) {
  try {
    if (!process.env.NEWSAPI_KEY) {
      return { ok: true, totalResults: 0, articles: [], message: "API key not configured" };
    }

    const resp = await axios.get(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`,
      { timeout: 8000 }
    );

    return {
      ok: true,
      totalResults: resp.data?.totalResults || 0,
      articles: (resp.data?.articles || []).map((a: any) => ({
        title: a.title,
        url: a.url,
        source: a.source?.name
      }))
    };
  } catch {
    return { ok: false, totalResults: 0, articles: [] };
  }
}

async function runTool(action: string, input: string) {
  console.log(`\n🔧 Running: ${action}("${input.substring(0, 50)}...")`);

  let result;
  switch (action) {
    case "google_fact_check":
      result = await googleFactCheck(input);
      break;
    case "wikipedia":
      result = await wikiSearch(input);
      break;
    case "duckduckgo":
      result = await ddgSearch(input);
      break;
    case "news_search":
      result = await newsSearch(input);
      break;
    default:
      result = { error: "Unknown tool" };
  }

  console.log(`✅ Result:`, JSON.stringify(result).substring(0, 150));
  return result;
}

// =====================================================
// IMPROVED PROMPTS
// =====================================================

const TOOL_PROMPT = `You are selecting a fact-checking tool. Be concise.

Available tools:
- news_search: Recent news
- wikipedia: Background info
- duckduckgo: General search
- google_fact_check: Fact-check database

Already used: {USED_TOOLS}

Respond with ONLY this format (no extra text):
{"action":"tool_name","input":"search query"}

Pick the most relevant unused tool for: {CLAIM}`;

const VERDICT_PROMPT = `Analyze evidence and give verdict.

CLAIM: {CLAIM}

EVIDENCE:
{EVIDENCE}

Instructions:
- If claim is extraordinary (disaster/celebrity death/major event) AND no evidence found → verdict="false"
- If claim has strong contradicting evidence → verdict="false"
- If claim has supporting evidence → verdict="true"
- If claim partially true but misleading → verdict="misleading"
- If claim is mundane/uncertain AND no evidence → verdict="unverified"

Examples:
- "NASA confirmed asteroid will hit Earth" + no news = FALSE (extraordinary claim needs proof)
- "Company went bankrupt" + no evidence = FALSE (major event would have news)
- "New coffee shop opened nearby" + no evidence = UNVERIFIED (small claim, okay to not find)

Respond ONLY with this format:
{"verdict":"false","confidence":85,"summary":"explanation","sources":[{"name":"Source","url":"http://..."}]}

Verdicts: true/false/misleading/unverified
Extract URLs from evidence for sources array.`;

// =====================================================
// LLM DECISION FUNCTIONS
// =====================================================

async function askForTool(
  claim: string,
  usedTools: string[]
): Promise<ToolAction | null> {
  const availableTools = ["news_search", "wikipedia", "duckduckgo", "google_fact_check"]
    .filter(t => !usedTools.includes(t));

  if (availableTools.length === 0) {
    return null;
  }

  const prompt = TOOL_PROMPT
    .replace("{USED_TOOLS}", usedTools.join(", ") || "none")
    .replace("{CLAIM}", claim);

  try {
    const response = await callLLM([{ role: "user", content: prompt }]);
    console.log("📝 Tool selection response:", response);

    const parsed = extractJSON(response);
    
    if (!parsed || !parsed.action) {
      console.log("⚠️ Failed to parse, using fallback");
      // Fallback: return first available tool
      return {
        action: availableTools[0],
        input: claim
      };
    }

    // Validate tool
    if (!availableTools.includes(parsed.action)) {
      console.log(`⚠️ Invalid tool "${parsed.action}", using fallback`);
      return {
        action: availableTools[0],
        input: parsed.input || claim
      };
    }

    return {
      action: parsed.action,
      input: parsed.input || claim
    };

  } catch (err) {
    console.error("❌ Tool selection error:", err);
    // Return first available tool as fallback
    return {
      action: availableTools[0],
      input: claim
    };
  }
}

async function askForVerdict(
  claim: string,
  history: any[]
): Promise<FactCheckVerdict> {
  // Pre-analyze evidence
  let hasNewsEvidence = false;
  let hasWikiEvidence = false;
  let hasFactCheckEvidence = false;
  
  for (const h of history) {
    if (h.action === "news_search" && h.output.totalResults > 0) hasNewsEvidence = true;
    if (h.action === "wikipedia" && h.output.found) hasWikiEvidence = true;
    if (h.action === "google_fact_check" && h.output.claims?.length > 0) hasFactCheckEvidence = true;
  }

  const evidenceText = history
    .map((h, i) => {
      let summary = `${i + 1}. ${h.action}: `;
      if (h.action === "news_search") {
        summary += h.output.totalResults > 0 
          ? `Found ${h.output.totalResults} articles` 
          : "No articles found";
      } else if (h.action === "wikipedia") {
        summary += h.output.found ? `Found: ${h.output.title}` : "Not found";
      } else if (h.action === "google_fact_check") {
        summary += h.output.claims?.length > 0 
          ? `${h.output.claims.length} fact-checks found` 
          : "No fact-checks found";
      } else {
        summary += h.output.abstract ? "Results found" : "No results";
      }
      return summary;
    })
    .join("\n");

  // Add context hint
  const isExtraordinary = 
    /asteroid|disaster|attack|death|bankrupt|confirmed|NASA|government/i.test(claim);
  
  const contextHint = isExtraordinary && !hasNewsEvidence
    ? "\n\nNOTE: This is an extraordinary claim that would be widely reported if true. No news coverage suggests it's likely FALSE."
    : "";

  const prompt = VERDICT_PROMPT
    .replace("{CLAIM}", claim)
    .replace("{EVIDENCE}", evidenceText + contextHint);

  try {
    const response = await callLLM([{ role: "user", content: prompt }]);
    console.log("📝 Verdict response:", response);

    const parsed = extractJSON(response);

    if (!parsed || !parsed.verdict) {
      console.log("⚠️ Failed to parse verdict, using smart fallback");
      return smartFallback(claim, history);
    }

    // Validate and normalize
    const verdict = ["true", "false", "misleading", "unverified"].includes(parsed.verdict)
      ? parsed.verdict
      : "unverified";

    const confidence = typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(100, parsed.confidence))
      : 50;

    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.filter((s: any) => s.name && s.url).slice(0, 3)
      : extractSourcesAuto(history);

    return {
      verdict,
      confidence,
      summary: parsed.summary || "Analysis completed based on available evidence.",
      sources
    };

  } catch (err) {
    console.error("❌ Verdict analysis error:", err);
    return smartFallback(claim, history);
  }
}

// =====================================================
// CLAIM ANALYSIS HELPERS
// =====================================================

function analyzeClaimType(claim: string): {
  isExtraordinary: boolean;
  category: string;
  keywords: string[];
} {
  const lowerClaim = claim.toLowerCase();
  
  // Catastrophic events
  if (/asteroid|meteor|comet|earth|planet|hit|impact|destroy/i.test(claim)) {
    return {
      isExtraordinary: true,
      category: "catastrophic_event",
      keywords: ["asteroid", "meteor", "disaster"]
    };
  }
  
  // Official announcements
  if (/(nasa|government|president|ceo|official|confirmed|announced|declared)/i.test(claim)) {
    return {
      isExtraordinary: true,
      category: "official_announcement",
      keywords: ["NASA", "official", "confirmed"]
    };
  }
  
  // Deaths/casualties
  if (/(died|death|killed|passed away|deceased)/i.test(claim)) {
    return {
      isExtraordinary: true,
      category: "death_claim",
      keywords: ["death", "died"]
    };
  }
  
  // Business/organizational
  if (/(bankrupt|shutdown|closed|cancelled|acquired|merged)/i.test(claim)) {
    return {
      isExtraordinary: true,
      category: "business_event",
      keywords: ["bankrupt", "shutdown", "cancelled"]
    };
  }
  
  // Disasters
  if (/(earthquake|tsunami|hurricane|flood|fire|explosion|attack)/i.test(claim)) {
    return {
      isExtraordinary: true,
      category: "disaster",
      keywords: ["disaster", "emergency"]
    };
  }
  
  // Default: mundane claim
  return {
    isExtraordinary: false,
    category: "general",
    keywords: []
  };
}

// =====================================================
// AUTO SOURCE EXTRACTION & SMART FALLBACK
// =====================================================

function extractSourcesAuto(history: any[]): Array<{ name: string; url: string }> {
  const sources: Array<{ name: string; url: string }> = [];

  for (const h of history) {
    try {
      if (h.action === "news_search" && h.output.articles?.[0]?.url) {
        sources.push({
          name: h.output.articles[0].source || "News",
          url: h.output.articles[0].url
        });
      }

      if (h.action === "wikipedia" && h.output.found && h.output.url) {
        sources.push({
          name: `Wikipedia: ${h.output.title}`,
          url: h.output.url
        });
      }

      if (h.action === "duckduckgo" && h.output.url && h.output.abstract) {
        sources.push({
          name: h.output.heading || "DuckDuckGo",
          url: h.output.url
        });
      }

      if (h.action === "google_fact_check" && h.output.claims?.[0]) {
        const claim = h.output.claims[0];
        if (claim.claimReview?.[0]?.url) {
          sources.push({
            name: claim.claimReview[0].publisher?.name || "Fact Check",
            url: claim.claimReview[0].url
          });
        }
      }
    } catch (e) {
      // Skip invalid sources
    }
  }

  return sources.slice(0, 3);
}

function smartFallback(claim: string, history: any[]): FactCheckVerdict {
  console.log("🤖 Using smart fallback analysis");

  const sources = extractSourcesAuto(history);
  const claimAnalysis = analyzeClaimType(claim);
  let evidenceScore = 0;
  let hasStrongSource = false;

  for (const h of history) {
    if (h.action === "google_fact_check" && h.output.claims?.length > 0) {
      evidenceScore += 3;
      hasStrongSource = true;
    }
    if (h.action === "news_search" && h.output.totalResults > 0) {
      evidenceScore += 2;
    }
    if (h.action === "wikipedia" && h.output.found) {
      evidenceScore += 2; // Increased from 1 - Wikipedia is reliable
      hasStrongSource = true;
    }
    if (h.action === "duckduckgo" && h.output.abstract) {
      evidenceScore += 1;
    }
  }

  console.log(`📊 Claim type: ${claimAnalysis.category}, Evidence score: ${evidenceScore}, Strong source: ${hasStrongSource}`);

  // CASE 1: Extraordinary claim with NO evidence = likely FALSE
  if (claimAnalysis.isExtraordinary && evidenceScore === 0) {
    return {
      verdict: "false",
      confidence: 85,
      summary: `This ${claimAnalysis.category.replace('_', ' ')} would be widely reported if true. No evidence found in news, Wikipedia, or fact-check databases suggests this claim is false.`,
      sources: []
    };
  }

  // CASE 2: Has Wikipedia + other sources = likely TRUE (for factual claims)
  if (hasStrongSource && evidenceScore >= 4) {
    return {
      verdict: "true",
      confidence: 85,
      summary: `Multiple reliable sources confirm this claim, including Wikipedia and ${sources.length - 1} other source(s).`,
      sources
    };
  }

  // CASE 3: Wikipedia alone for non-extraordinary claims = TRUE
  if (!claimAnalysis.isExtraordinary && evidenceScore >= 2 && hasStrongSource) {
    return {
      verdict: "true",
      confidence: 75,
      summary: `Found reliable sources confirming this claim. Wikipedia and other sources provide verification.`,
      sources
    };
  }

  // CASE 4: Extraordinary claim with weak evidence = unverified but suspicious
  if (claimAnalysis.isExtraordinary && evidenceScore < 3) {
    return {
      verdict: "unverified",
      confidence: 60,
      summary: `This is a major claim that needs strong evidence. Only found limited sources. Treat with skepticism until verified by reliable news outlets.`,
      sources
    };
  }

  // CASE 5: Moderate evidence for general claims
  if (evidenceScore >= 2) {
    return {
      verdict: "unverified",
      confidence: 50,
      summary: `Some evidence found but not enough to fully confirm. Review the ${sources.length} source(s) for more context.`,
      sources
    };
  }

  // CASE 6: No evidence, mundane claim
  return {
    verdict: "unverified",
    confidence: 35,
    summary: "No reliable sources found to verify this claim. May be too recent or localized.",
    sources: []
  };
}

// =====================================================
// MAIN AGENT - LLM-POWERED WITH ROBUST FALLBACKS
// =====================================================

export async function factCheckAgent(claim: string): Promise<FactCheckVerdict> {
  const history: any[] = [];
  const MAX_TOOLS = 3;

  try {
    console.log("\n🚀 Starting LLM-powered fact-check agent");
    console.log(`📋 Claim: "${claim}"\n`);

    // Phase 1: Gather evidence with LLM tool selection
    for (let i = 0; i < MAX_TOOLS; i++) {
      console.log(`\n📊 Tool Call ${i + 1}/${MAX_TOOLS}`);

      const usedTools = history.map(h => h.action);
      const toolDecision = await askForTool(claim, usedTools);

      if (!toolDecision) {
        console.log("✅ All relevant tools used");
        break;
      }

      const output = await runTool(toolDecision.action, toolDecision.input);

      history.push({
        action: toolDecision.action,
        input: toolDecision.input,
        output
      });
    }

    if (history.length === 0) {
      return {
        verdict: "unverified",
        confidence: 20,
        summary: "Unable to gather any evidence.",
        sources: [],
        toolCalls: 0
      };
    }

    console.log(`\n✅ Gathered ${history.length} pieces of evidence`);

    // Phase 2: LLM analyzes evidence
    console.log("\n🎯 Analyzing evidence with LLM...");
    const verdict = await askForVerdict(claim, history);

    return {
      ...verdict,
      toolCalls: history.length
    };

  } catch (err) {
    console.error("❌ Agent error:", err);
    return {
      verdict: "unverified",
      confidence: 20,
      summary: "Error during fact-checking process.",
      sources: [],
      toolCalls: history.length
    };
  }
}

// =====================================================
// FORMAT FOR TELEGRAM
// =====================================================
export function formatVerdict(v: FactCheckVerdict): string {
  const emoji = {
    true: "🟢",
    false: "🔴",
    misleading: "🟠",
    unverified: "⚪"
  }[v.verdict];

  const titleEmoji = {
    true: "✅",
    false: "❌",
    misleading: "⚠️",
    unverified: "❓"
  }[v.verdict];

  return `
${titleEmoji} *FACT-CHECK RESULT*

${emoji} *Verdict:* _${v.verdict.toUpperCase()}_
📊 *Confidence:* ${v.confidence}%

📝 *Summary:*
${v.summary}

🔗 *Sources:*
${v.sources.length 
    ? v.sources.map(s => `• [${s.name}](${s.url})`).join("\n") 
    : "• No sources available"}
  `.trim();
}
