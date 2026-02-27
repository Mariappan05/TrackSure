import { supabase } from './supabase';

// Note: EXPO_PUBLIC_ prefix required for Expo JS bundle access
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
// gemini-2.5-flash — best price-performance, high volume, low latency
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ─── Schema description given to Gemini ────────────────────────────────────
const SCHEMA = `
TrackSure Delivery Management System — Database Schema

TABLE: orders
  - id (uuid, primary key)
  - created_at (timestamp)
  - pickup_address (text)
  - drop_address (text)
  - pickup_lat, pickup_lng, drop_lat, drop_lng (float)
  - driver_id (uuid, FK → profiles.id)
  - status: 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled'
  - planned_distance (float, kilometers)
  - vehicle_type: 'bike' | 'car' | 'truck' | 'van'
  - sequence (integer, route order)

TABLE: profiles
  - id (uuid, primary key)
  - full_name (text)
  - email (text)
  - role: 'admin' | 'driver'

RELATIONSHIP: orders.driver_id → profiles.id
`;

// ─── Call Gemini REST API ───────────────────────────────────────────────────
async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured.');

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ─── Execute a Gemini-generated query spec against Supabase ─────────────────
async function executeQuerySpec(spec) {
  if (!spec?.table) return null;

  let query;

  if (spec.table === 'orders_with_driver') {
    query = supabase.from('orders').select(
      'id, created_at, pickup_address, drop_address, status, planned_distance, vehicle_type, sequence, driver:profiles(full_name, email)'
    );
  } else if (spec.table === 'orders') {
    const cols = spec.select || 'id,created_at,pickup_address,drop_address,status,planned_distance,vehicle_type,driver_id';
    query = supabase.from('orders').select(cols);
  } else if (spec.table === 'profiles') {
    query = supabase.from('profiles').select('id,full_name,email,role');
  } else {
    return null;
  }

  // Filters
  if (spec.filter && typeof spec.filter === 'object') {
    for (const [col, val] of Object.entries(spec.filter)) {
      if (val !== null && val !== undefined && val !== '') {
        query = query.eq(col, val);
      }
    }
  }

  // Ordering
  if (spec.orderBy?.column) {
    query = query.order(spec.orderBy.column, { ascending: spec.orderBy.ascending ?? false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Limit (default 20, max 50)
  const limit = Math.min(spec.limit || 20, 50);
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// ─── Main chatbot function ──────────────────────────────────────────────────
/**
 * @param {string} userMessage
 * @param {{ role: 'user'|'bot', text: string }[]} history
 */
export async function askChatbot(userMessage, history = []) {
  // ── Stage 1: Decide what DB query is needed ────────────────────────────
  const stage1Prompt = `
${SCHEMA}

You are TrackSure AI. The user asks: "${userMessage}"

Decide if this question requires querying the database. If yes, generate a query specification.

Return ONLY valid JSON (no markdown, no extra text):
{
  "needsDB": true | false,
  "querySpec": {
    "table": "orders" | "orders_with_driver" | "profiles",
    "select": "col1,col2" or omit for default,
    "filter": { "column": "value" },
    "orderBy": { "column": "planned_distance", "ascending": false },
    "limit": 10
  }
}

If needsDB is false, set querySpec to null.

Examples:
- "highest distance delivery" → orders, orderBy planned_distance desc, limit 1
- "total delivered orders" → orders, filter {status:"delivered"}, limit 50
- "show all drivers" → profiles, filter {role:"driver"}
- "bike deliveries" → orders, filter {vehicle_type:"bike"}
- "pending orders with driver" → orders_with_driver, filter {status:"pending"}
- "what is TrackSure" → needsDB: false
`.trim();

  let queryPlan = { needsDB: false, querySpec: null };
  try {
    const stage1Raw = await callGemini(stage1Prompt);
    const jsonMatch = stage1Raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) queryPlan = JSON.parse(jsonMatch[0]);
  } catch {
    // If stage 1 fails, proceed without DB data
  }

  // ── Execute DB query ───────────────────────────────────────────────────
  let dbData = null;
  let dbError = null;
  if (queryPlan.needsDB && queryPlan.querySpec) {
    try {
      dbData = await executeQuerySpec(queryPlan.querySpec);
    } catch (err) {
      dbError = err.message;
    }
  }

  // ── Stage 2: Format final answer ───────────────────────────────────────
  const convContext = history.length > 0
    ? `\nConversation history:\n${history.slice(-6).map(m =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`
      ).join('\n')}\n`
    : '';

  const dataSection = dbData !== null
    ? `Database results (${dbData.length} record${dbData.length !== 1 ? 's' : ''}):\n${JSON.stringify(dbData, null, 2)}`
    : dbError
      ? `Database error: ${dbError}. Answer based on general knowledge.`
      : '';

  const stage2Prompt = `
You are TrackSure AI, a friendly professional assistant for a delivery management app.
${convContext}
User question: "${userMessage}"

${dataSection}

Answer the question clearly and concisely. STRICT FORMATTING RULES — follow exactly:
- Use PLAIN TEXT ONLY. NO markdown asterisks (* or **) anywhere.
- For bullet lists use a dash followed by a space: "- item text"
- For numbered lists use: "1. item text", "2. item text"
- For key-value details use "Label: value" format, e.g. "Status: pending", "Distance: 71.7 km"
- For section headings end the line with a colon, e.g. "Order Details:"
- Use blank lines to separate sections
- Format distances as "X.X km", dates as readable text
- If showing orders, include: Status, Distance, Route (pickup → drop), Driver name if available
- If data is empty array, say "No records found matching your query."
- Do NOT mention SQL, database, or technical implementation details
- Keep response under 300 words unless listing many items
- Be warm and professional
`.trim();

  const finalAnswer = await callGemini(stage2Prompt);

  return {
    text: finalAnswer,
    hasData: Array.isArray(dbData) && dbData.length > 0,
    recordCount: dbData?.length ?? 0,
  };
}
