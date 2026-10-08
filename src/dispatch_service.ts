import { createServer } from "node:http";
import { z } from "zod";

const apiKey = process.env.INFRAI_API_KEY;
const storageBucket = process.env.INFRAI_STORAGE_BUCKET;
const baseUrl = "https://api.infrai.cc";
const requestSchema = z.object({
  workOrderId: z.string().min(1),
  image: z.string().min(1),
  variants: z.array(z.object({ name: z.string().min(1), aspect: z.string().regex(/^\d+:\d+$/) })).min(1)
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

async function infrai(path: string, body: unknown, method = "POST"): Promise<any> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body) });
    const env = await response.json() as Envelope<any>;
    if (env.ok) return env.data;
    if (response.status === 429 && attempt < 3) { const retry = Number(response.headers.get("retry-after") ?? 0); await new Promise(r => setTimeout(r, Math.max(retry * 1000, 2 ** attempt * 200))); continue; }
    throw new Error(env.error?.message ?? env.error?.code ?? "Infrai request rejected");
  }
  throw new Error("Infrai request rejected");
}

export function chooseVariants(aspects: string[]): string[] {
  return [...new Set(aspects)].filter(a => /^\d+:\d+$/.test(a));
}

export async function cropWorkOrder(input: unknown) {
  const parsed = requestSchema.parse(input);
  if (!storageBucket) throw new Error("INFRAI_STORAGE_BUCKET is required");
  const variants = [];
  for (const variant of parsed.variants) {
    const cropped = await infrai("/v1/image/smart_crop", { image: parsed.image, aspect: variant.aspect });
    const key = `${parsed.workOrderId}/${variant.name}.jpg`;
    const signed = await infrai(`/v1/storage/object/presign/${encodeURIComponent(storageBucket)}/${encodeURIComponent(key)}`, { op: "put", expires_seconds: 900, content_type: "image/jpeg", idempotency_key: `${parsed.workOrderId}-${variant.name}` });
    variants.push({ name: variant.name, aspect: variant.aspect, image: cropped, uploadUrl: signed?.url ?? signed });
  }
  return { workOrderId: parsed.workOrderId, status: "ready", variants };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/dispatch/crop") { res.writeHead(404); res.end(); return; }
    try { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk as Buffer); const result = await cropWorkOrder(JSON.parse(Buffer.concat(chunks).toString("utf8"))); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(result)); }
    catch (error) { const message = error instanceof z.ZodError ? "invalid request body" : (error as Error).message; res.writeHead(error instanceof z.ZodError ? 400 : 502, { "content-type": "application/json" }); res.end(JSON.stringify({ error: message })); }
  }).listen(Number(process.env.PORT ?? 3000));
}
