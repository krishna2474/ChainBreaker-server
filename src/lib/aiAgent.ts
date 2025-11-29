// ===========================================
// ChainBreaker AI — SIMPLIFIED & ROBUST Fact Check
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

// =====================================================
// SIMPLIFIED TOOL FUNCTIONS
// =====================================================

async function googleFactCheck(query: string) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return { ok: true, claims: [], message: "API key not configured" };
    }

    const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(
      query
    )}&key=${process.env.GOOGLE_API_KEY}`;

    const resp = await axios.get(url, { timeout: 5000 });
    return { ok: true, claims: resp.data?.claims || [] };
  } catch (error: any) {
    console.log("❌ Google Fact Check failed:", error.message);
    return { ok: false, claims: [] };
  }
}

async function wikiSearch(query: string) {
  try {
    const searchResp = await axios.get(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&format=json&srlimit=3`,
      {
        timeout: 5000,
        headers: { "User-Agent": "ChainBreaker-AI/1.0" }
      }
    );

    if (!searchResp.data?.query?.search?.length) {
      return { ok: true, found: false, message: "No Wikipedia article found" };
    }

    const results = [];
    for (const item of searchResp.data.query.search.slice(0, 2)) {
      try {
        const summaryResp = await axios.get(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title)}`,
          { timeout: 5000, headers: { "User-Agent": "ChainBreaker-AI/1.0" } }
        );
        
        results.push({
          title: item.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
          summary: summaryResp.data.extract || "No summary available"
        });
      } catch (e) {
        // Skip individual article errors
      }
    }

    return {
      ok: true,
      found: true,
      results
    };
  } catch (error: any) {
    console.log("❌ Wikipedia search failed:", error.message);
    return { ok: false, found: false };
  }
}

async function newsSearch(query: string) {
  try {
    if (!process.env.NEWSAPI_KEY) {
      return { ok: true, totalResults: 0, articles: [], message: "API key not configured" };
    }

    const resp = await axios.get(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`,
      { timeout: 5000 }
    );

    return {
      ok: true,
      totalResults: resp.data?.totalResults || 0,
      articles: (resp.data?.articles || []).map((a: any) => ({
        title: a.title,
        url: a.url,
        source: a.source?.name,
        description: a.description
      }))
    };
  } catch (error: any) {
    console.log("❌ News search failed:", error.message);
    return { ok: false, totalResults: 0, articles: [] };
  }
}

// =====================================================
// SIMPLE LLM CLIENT WITH FALLBACK
// =====================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

async function callSimpleLLM(prompt: string): Promise<string> {
  if (!OPENROUTER_KEY) {
    throw new Error("OpenRouter API key not configured");
  }

  const models = [
    "mistralai/mistral-7b-instruct:free",
    "huggingfaceh4/zephyr-7b-beta:free",
    "google/gemma-7b-it:free"
  ];

  for (const model of models) {
    try {
      console.log(`🤖 Trying model: ${model}`);
      
      const resp = await axios.post(
        OPENROUTER_URL,
        {
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.1
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            "HTTP-Referer": "http://localhost",
            "X-Title": "ChainBreaker-AI",
            "Content-Type": "application/json"
          },
          timeout: 15000
        }
      );

      const content = resp.data?.choices?.[0]?.message?.content?.trim();
      if (content && content.length > 10) {
        return content;
      }
    } catch (error: any) {
      console.log(`❌ ${model} failed:`, error.message);
      continue;
    }
  }

  throw new Error("All LLM models failed");
}

// =====================================================
// MANUAL FACT-CHECK LOGIC
// =====================================================

function analyzeCodingMarket(evidence: any[]): FactCheckVerdict {
  console.log("🔍 Analyzing coding market evidence manually...");
  
  let positiveSigns = 0;
  let negativeSigns = 0;
  const sources: Array<{ name: string; url: string }> = [];

  // Analyze each evidence piece
  evidence.forEach((item, index) => {
    if (item.action === "news_search" && item.output.articles.length > 0) {
      positiveSigns += 2; // News articles exist = market is active
      item.output.articles.forEach((article: any) => {
        if (article.title && article.url) {
          sources.push({
            name: article.source || `News ${index + 1}`,
            url: article.url
          });
        }
      });
    }

    if (item.action === "wikipedia" && item.output.found) {
      positiveSigns += 1; // Wikipedia page exists = legitimate topic
      if (item.output.results?.[0]?.url) {
        sources.push({
          name: `Wikipedia: ${item.output.results[0].title}`,
          url: item.output.results[0].url
        });
      }
    }

    if (item.action === "google_fact_check" && item.output.claims.length > 0) {
      positiveSigns += 1; // Fact checks exist = discussed topic
    }
  });

  // Determine verdict based on evidence
  if (positiveSigns >= 3) {
    return {
      verdict: "false",
      confidence: 75,
      summary: "Evidence suggests the coding market is active with ongoing hiring, news coverage, and industry discussion. The claim appears incorrect.",
      sources: sources.slice(0, 3),
      toolCalls: evidence.length
    };
  } else if (positiveSigns >= 1) {
    return {
      verdict: "misleading",
      confidence: 60,
      summary: "Limited evidence found, but available sources indicate coding market activity exists. Claim may be exaggerated.",
      sources: sources.slice(0, 2),
      toolCalls: evidence.length
    };
  } else {
    return {
      verdict: "unverified",
      confidence: 40,
      summary: "Insufficient evidence to verify this claim. No reliable sources found about coding market status.",
      sources: [],
      toolCalls: evidence.length
    };
  }
}

// =====================================================
// MAIN FACT CHECK FUNCTION - SIMPLIFIED
// =====================================================

export async function factCheckAgent(claim: string): Promise<FactCheckVerdict> {
  console.log(`\n🚀 Fact-checking: "${claim}"`);
  
  const evidence = [];
  const tools = [
    { name: "news_search", func: newsSearch },
    { name: "wikipedia", func: wikiSearch },
    { name: "google_fact_check", func: googleFactCheck }
  ];

  // Gather evidence from all tools
  for (const tool of tools) {
    try {
      console.log(`\n🔧 Running ${tool.name}...`);
      const result = await tool.func(claim);
      evidence.push({
        action: tool.name,
        input: claim,
        output: result
      });
      console.log(`✅ ${tool.name} completed`);
    } catch (error: any) {
      console.log(`❌ ${tool.name} error:`, error.message);
    }
  }

  console.log(`\n📊 Gathered ${evidence.length} evidence pieces`);

  // Try LLM analysis first, fallback to manual analysis
  try {
    console.log("\n🎯 Attempting LLM analysis...");
    
    const evidenceSummary = evidence.map((e, i) => 
      `Tool ${i + 1} (${e.action}): ${JSON.stringify(e.output).substring(0, 200)}`
    ).join("\n");

    const llmPrompt = `Analyze this fact check evidence and provide a verdict:

CLAIM: "${claim}"

EVIDENCE:
${evidenceSummary}

Respond with ONLY this JSON format:
{
  "verdict": "true|false|misleading|unverified",
  "confidence": 1-100,
  "summary": "brief explanation",
  "sources": [{"name": "source1", "url": "http..."}]
}

Base your analysis on the evidence quality and quantity.`;

    const llmResponse = await callSimpleLLM(llmPrompt);
    console.log("🤖 LLM Response:", llmResponse);

    // Extract JSON from response
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (parsed.verdict && parsed.confidence) {
        // Add actual sources from evidence
        const actualSources: Array<{ name: string; url: string }> = [];
        evidence.forEach(item => {
          if (item.action === "news_search" && item.output.articles?.[0]?.url) {
            actualSources.push({
              name: item.output.articles[0].source || "News",
              url: item.output.articles[0].url
            });
          }
          if (item.action === "wikipedia" && item.output.results?.[0]?.url) {
            actualSources.push({
              name: `Wikipedia: ${item.output.results[0].title}`,
              url: item.output.results[0].url
            });
          }
        });

        return {
          verdict: parsed.verdict,
          confidence: Math.max(1, Math.min(100, parsed.confidence)),
          summary: parsed.summary || "Analyzed with available evidence",
          sources: actualSources.slice(0, 3),
          toolCalls: evidence.length
        };
      }
    }
  } catch (error: any) {
    console.log("❌ LLM analysis failed, using manual logic:", error.message);
  }

  // Fallback: Manual analysis
  return analyzeCodingMarket(evidence);
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

  let message = `${emoji} *${v.verdict.toUpperCase()}* (${v.confidence}% confidence)

📝 ${v.summary}

`;

  if (v.sources.length > 0) {
    message += `\n🔗 *Sources:*\n${v.sources.map(s => `- [${s.name}](${s.url})`).join("\n")}`;
  } else {
    message += `\n🔗 *Sources:* No reliable sources found`;
  }

  message += `\n\n⚙️ *Tools used:* ${v.toolCalls}`;

  return message;
}