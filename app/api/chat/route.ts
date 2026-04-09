import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory cache: keyed by pageFilter, expires after 1 hour
const clarityCache = new Map<string, { data: unknown; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchClarityData(token: string, pageFilter: string): Promise<{ data: unknown; error: string | null }> {
  const cacheKey = pageFilter || '__all__';
  const cached = clarityCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { data: cached.data, error: null };
  }

  try {
    const url = new URL('https://www.clarity.ms/export-data/api/v1/project-live-insights');
    if (pageFilter) url.searchParams.set('pageFilter', pageFilter);
    url.searchParams.set('numOfDays', '3');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      clarityCache.set(cacheKey, { data, fetchedAt: Date.now() });
      return { data, error: null };
    } else if (res.status === 429) {
      return { data: null, error: 'Clarity API daily limit exceeded — live data will be available again tomorrow.' };
    } else {
      return { data: null, error: `Clarity API error: ${res.status} ${res.statusText}` };
    }
  } catch (err) {
    return { data: null, error: `Could not reach Clarity API: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function buildSystemPrompt(clarityData: unknown, pageFilter: string, projectId?: string, clarityError?: string | null): string {
  const dataStr = clarityData
    ? JSON.stringify(clarityData, null, 2)
    : clarityError ?? 'No Clarity data available.';

  return `You are a website analytics assistant for Hire Overseas (hireoverseas.com), a platform that helps businesses hire global talent, especially virtual assistants.

${projectId ? `Your Microsoft Clarity project ID is: ${projectId}
Clarity dashboard links:
- Dashboard: https://clarity.microsoft.com/projects/view/${projectId}/dashboard
- Recordings: https://clarity.microsoft.com/projects/view/${projectId}/recordings
- Heatmaps: https://clarity.microsoft.com/projects/view/${projectId}/heatmaps
- Dead Clicks: https://clarity.microsoft.com/projects/view/${projectId}/recordings?clickType=dead
When asked for links, provide these exact URLs.` : ''}

You have access to live Microsoft Clarity analytics data provided below. Use this data to answer questions accurately and specifically.

LIVE CLARITY DATA:
\`\`\`json
${dataStr}
\`\`\`

${pageFilter ? `The user is focused on the page: ${pageFilter}` : 'The user wants insights across their whole site.'}

Your job:
1. Interpret their analytics question using the Clarity data above
2. Give clear, plain-English insights they can actually act on
3. Be specific — use numbers, percentages, and comparisons from the data
4. Always end with 1-3 concrete, actionable recommendations
5. Format your response with proper HTML — use <p>, <strong>, <ul>, <li> tags
6. For key metrics, wrap them in this exact format:
   <div class="metric-row"><div class="metric"><span class="metric-val">VALUE</span><span class="metric-label">LABEL</span></div></div>
7. Use <span class="tag warning">⚠️ Warning</span> for problem areas, <span class="tag success">✅ Good</span> for positives
8. Keep responses concise and scannable — no walls of text
9. Always be encouraging and solution-focused

If Clarity data is unavailable, provide general best-practice advice and explain that live data requires CLARITY_API_TOKEN and CLARITY_PROJECT_ID to be configured.
If asked about something Clarity can't measure (like revenue), explain what Clarity CAN tell you instead.

Important context about Hire Overseas:
- They help companies hire overseas talent, virtual assistants, etc.
- Their key conversion page is /hire/virtual-assistant`;
}

interface HistoryMessage {
  role: string;
  raw: string;
}

export async function POST(request: Request) {
  const { message, pageFilter = '', history = [] } = await request.json();

  const token = process.env.CLARITY_API_TOKEN;
  const projectId = process.env.CLARITY_PROJECT_ID;

  let clarityData: unknown = null;
  let clarityError: string | null = null;

  if (token) {
    const result = await fetchClarityData(token, pageFilter);
    clarityData = result.data;
    clarityError = result.error;
  } else {
    clarityError = 'CLARITY_API_TOKEN not configured.';
  }

  const systemPrompt = buildSystemPrompt(clarityData, pageFilter, projectId, clarityError);

  // Map our message history to Anthropic's format
  const anthropicHistory = (history as HistoryMessage[])
    .slice(-20)
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.raw,
    }));

  const messageStream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [...anthropicHistory, { role: 'user', content: message }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of messageStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err: unknown) {
        // Surface the error as a chat message rather than a 502
        try {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          controller.enqueue(encoder.encode(`<p>⚠️ ${msg}</p>`));
          controller.close();
        } catch {
          controller.error(err as Error);
        }
      }
    },
    cancel() {
      messageStream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
