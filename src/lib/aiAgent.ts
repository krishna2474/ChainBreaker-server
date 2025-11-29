// src/lib/aiAgent.ts
import axios from "axios";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

// Safe request wrappers
async function safeGet(url: string, options: any = {}) {
  try {
    return (await axios.get(url, { timeout: 10000, ...options })).data;
  } catch {
    return null;
  }
}
async function safePost(url: string, body: any, options: any = {}) {
  try {
    return (await axios.post(url, body, { timeout: 15000, ...options })).data;
  } catch {
    return null;
  }
}

// ------------------ Google Fact Check API ------------------
async function googleFactCheck(query: string) {
  if (!GOOGLE_API_KEY) return null;

  const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(
    query
  )}&key=${GOOGLE_API_KEY}`;

  return safeGet(url);
}

// ------------------ Wikipedia ------------------
async function wikiSearch(query: string) {
  const search = await safeGet(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&srlimit=1`
  );

  if (!search?.query?.search?.length) return null;

  const title = search.query.search[0].title;

  const summary = await safeGet(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );

  return { title, summary };
}

// ------------------ DuckDuckGo Instant Answer ------------------
async function ddgInstant(query: string) {
  return safeGet(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_html=1&skip_disambig=1`
  );
}

// ------------------ NewsAPI ------------------
async function newsSearch(query: string) {
  if (!NEWSAPI_KEY) return null;

  return safeGet(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(
      query
    )}&pageSize=3&apiKey=${NEWSAPI_KEY}`
  );
}

// ------------------ HuggingFace Zero-Shot ------------------
async function hfClassify(premise: string, claim: string) {
  if (!HUGGINGFACE_API_KEY) return null;

  const text = `Premise: ${premise}\n\nHypothesis: ${claim}`;

  const body = {
    inputs: text,
    parameters: {
      candidate_labels: ["true", "false", "neutral"],
      hypothesis_template: "This claim is {}.",
    },
  };

  return safePost(
    `https://api-inference.huggingface.co/models/facebook/bart-large-mnli`,
    body,
    {
      headers: { Authorization: `Bearer ${HUGGINGFACE_API_KEY}` },
    }
  );
}

function extractScores(resp: any) {
  if (!resp?.labels || !resp?.scores) return null;

  const out: Record<string, number> = {};
  resp.labels.forEach((label: string, i: number) => {
    out[label] = resp.scores[i];
  });
  return out;
}

function aggregateVotes(votes: Array<{ scores: any }>) {
  const totals: Record<string, number> = { true: 0, false: 0, neutral: 0 };
  if (!votes.length) return { conclusion: "uncertain", confidence: 0 };

  votes.forEach((v) => {
    if (!v.scores) return;
    totals.true += v.scores.true || 0;
    totals.false += v.scores.false || 0;
    totals.neutral += v.scores.neutral || 0;
  });

  totals.true /= votes.length;
  totals.false /= votes.length;
  totals.neutral /= votes.length;

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const [label, score] = sorted[0];

  let conclusion = "uncertain";
  if (label === "true" && score >= 0.55) conclusion = "likely_true";
  if (label === "false" && score >= 0.55) conclusion = "likely_false";

  return { conclusion, confidence: score };
}

// ------------------ MAIN AGENT ------------------
export async function factCheckAgent(claim: string) {
  const result: any = {
    conclusion: "uncertain",
    confidence: 0,
    sources: [],
    reasons: [],
    raw: {},
  };

  // 1) Google Fact Check (authoritative)
  const google = await googleFactCheck(claim);
  result.raw.google = google;

  if (google?.claims?.length) {
    const top = google.claims[0];
    const review = top.claimReview?.[0];

    result.conclusion = "official_factcheck";
    result.confidence = 1;
    result.reasons.push(
      `Official fact-check found: ${review?.textualRating || ""}`
    );
    result.sources.push({
      name: review?.publisher?.name || "Fact Check",
      url: review?.url,
      snippet: top.text,
    });
    return result;
  }

  const votes: any[] = [];

  // 2) Wikipedia
  const wiki = await wikiSearch(claim);
  result.raw.wiki = wiki;

  if (wiki?.summary?.extract) {
    result.sources.push({
      name: `Wikipedia: ${wiki.title}`,
      url: wiki.summary?.content_urls?.desktop?.page,
      snippet: wiki.summary.extract,
    });

    const hf = await hfClassify(wiki.summary.extract, claim);
    const scores = extractScores(hf);
    if (scores) votes.push({ scores });
  }

  // 3) DuckDuckGo
  const ddg = await ddgInstant(claim);
  result.raw.ddg = ddg;

  const snippet =
    ddg?.AbstractText ||
    ddg?.RelatedTopics?.[0]?.Text ||
    null;

  if (snippet) {
    result.sources.push({
      name: "DuckDuckGo",
      url: ddg.AbstractURL,
      snippet,
    });

    const hf = await hfClassify(snippet, claim);
    const scores = extractScores(hf);
    if (scores) votes.push({ scores });
  }

  // 4) NewsAPI (optional)
  const news = await newsSearch(claim);
  result.raw.news = news;

  if (news?.articles?.length) {
    const combined = news.articles
      .slice(0, 2)
      .map((a: any) => `${a.title}. ${a.description}`)
      .join("\n");

    result.sources.push(
      ...news.articles.slice(0, 2).map((a: any) => ({
        name: a.source?.name,
        url: a.url,
        snippet: a.title,
      }))
    );

    const hf = await hfClassify(combined, claim);
    const scores = extractScores(hf);
    if (scores) votes.push({ scores });
  }

  // Aggregate
  const agg = aggregateVotes(votes);
  result.conclusion = agg.conclusion;
  result.confidence = agg.confidence;

  result.reasons.push(
    `Model vote result: ${agg.conclusion} (${Math.round(
      agg.confidence * 100
    )}%)`
  );

  return result;
}

// ------------------ FORMATTED MSG FOR BOT ------------------
export function formatVerdict(result: any) {
  let emoji = "❓";
  if (result.conclusion === "likely_true") emoji = "✅";
  if (result.conclusion === "likely_false") emoji = "⚠️";
  if (result.conclusion === "official_factcheck") emoji = "🔍";

  let msg = `${emoji} *Conclusion:* ${result.conclusion.replace("_", " ").toUpperCase()}\n`;
  msg += `📊 *Confidence:* ${(result.confidence * 100).toFixed(1)}%\n`;

  if (result.sources?.length) {
    msg += `\n🔗 *Sources:*\n`;
    result.sources.slice(0, 3).forEach((s: any) => {
      msg += `- *${s.name}* ${s.url ? `→ ${s.url}` : ""}\n`;
    });
  }

  return msg;
}

export default { factCheckAgent, formatVerdict };
