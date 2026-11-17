#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.BBLUE_URL || "https://bblue.net";
const API_KEY = process.env.BBLUE_API_KEY;

if (!API_KEY) {
  process.stderr.write("BBLUE_API_KEY is required\n");
  process.exit(1);
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok && res.headers.get("content-type")?.includes("json")) {
    return res.json();
  }
  if (!res.ok) {
    return { error: `HTTP ${res.status}: ${res.statusText}` };
  }
  return res.json();
}

async function fetchImageAsBase64(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  const mime = res.headers.get("content-type") || "image/jpeg";
  return { data: Buffer.from(buffer).toString("base64"), mimeType: mime };
}

const server = new McpServer({
  name: "bblue",
  version: "1.0.0",
});

// ── get_credits ──────────────────────────────────────────────────────────────

server.tool(
  "get_credits",
  "Check current credit balance and account info on bblue.net",
  {},
  async () => {
    const data = await api("/api/me");
    if (data.error) {
      return { content: [{ type: "text", text: `Error: ${data.error}` }] };
    }
    const lines = [
      `Credits: ${data.credits}`,
      `Plan: ${data.plan?.id || "FREE"}`,
      `Email: ${data.email}`,
      `Bonus available: ${data.bonus?.available ? "Yes" : "No"}`,
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ── generate_image ───────────────────────────────────────────────────────────

server.tool(
  "generate_image",
  [
    "Generate AI images on bblue.net.",
    "",
    "Models (cheapest first):",
    "  seedream-5      — ByteDance, latest, 2 credits/frame",
    "  wan-2-7         — Alibaba, fast, 2 credits/frame",
    "  seedream-4-5    — ByteDance, photoreal, 3 credits/frame",
    "  wan-2-7-pro     — Alibaba, 4K text-to-image, 4 credits/frame",
    "  nano-banana-pro — Google, sharp edits, 5 credits/frame",
    "",
    "Aspects: 1:1, 3:4, 4:5, 3:2, 16:9, 9:16",
    "Quality: 1k, 2k (default), 4k",
    "Count: 1-8 (default 4)",
    "",
    "Cost = credits_per_frame × count. Example: seedream-5 at 2k, 4 frames = 8 credits.",
    "",
    "Reference images: pass base64-encoded images to edit/combine.",
    "With 1 image the model edits it; with 2+ it combines them.",
    "The first image is the subject, the rest are references.",
  ].join("\n"),
  {
    prompt: z.string().describe("The image generation prompt"),
    model: z
      .enum([
        "nano-banana-pro",
        "seedream-5",
        "seedream-4-5",
        "wan-2-7",
        "wan-2-7-pro",
      ])
      .optional()
      .describe("AI model (default: nano-banana-pro)"),
    aspect: z
      .enum(["1:1", "3:4", "4:5", "3:2", "16:9", "9:16"])
      .optional()
      .describe("Aspect ratio (default: 1:1)"),
    quality: z
      .enum(["1k", "2k", "4k"])
      .optional()
      .describe("Output resolution (default: 2k)"),
    count: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe("Number of images (default: 4)"),
    references: z
      .array(z.string())
      .optional()
      .describe(
        "Reference images as base64 data URIs (data:image/jpeg;base64,...). First is the subject.",
      ),
  },
  async ({ prompt, model, aspect, quality, count, references }) => {
    const body = { prompt };
    if (model) body.model = model;
    if (aspect) body.aspect = aspect;
    if (quality) body.quality = quality;
    if (count) body.count = count;
    if (references?.length) body.references = references;

    const data = await api("/api/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (data.error) {
      return { content: [{ type: "text", text: `Error: ${data.error}` }] };
    }

    const content = [];
    const imageCount = data.images?.length || 0;

    content.push({
      type: "text",
      text: [
        `Generated ${imageCount} image(s)`,
        `Model: ${model || "nano-banana-pro"}`,
        `Credits spent: ${data.cost}`,
        `Credits remaining: ${data.credits}`,
        `Generation ID: ${data.generationId}`,
      ].join("\n"),
    });

    if (data.images) {
      for (const img of data.images) {
        if (img.startsWith("data:")) {
          const match = img.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            content.push({
              type: "image",
              data: match[2],
              mimeType: match[1],
            });
          }
        } else if (img.startsWith("/api/frames/")) {
          const fetched = await fetchImageAsBase64(img);
          if (fetched) {
            content.push({
              type: "image",
              data: fetched.data,
              mimeType: fetched.mimeType,
            });
          } else {
            content.push({
              type: "text",
              text: `Image: ${BASE_URL}${img} (could not fetch)`,
            });
          }
        } else {
          content.push({ type: "text", text: `Image: ${img}` });
        }
      }
    }

    return { content };
  },
);

// ── list_generations ─────────────────────────────────────────────────────────

server.tool(
  "list_generations",
  "List recent image generations from bblue.net history",
  {
    cursor: z
      .string()
      .optional()
      .describe("Pagination cursor from a previous response"),
  },
  async ({ cursor }) => {
    const params = new URLSearchParams({ kind: "image" });
    if (cursor) params.set("cursor", cursor);

    const data = await api(`/api/generations?${params}`);
    if (data.error) {
      return { content: [{ type: "text", text: `Error: ${data.error}` }] };
    }

    if (!data.generations?.length) {
      return {
        content: [{ type: "text", text: "No image generations found." }],
      };
    }

    const lines = data.generations.map((g) => {
      const date = new Date(g.createdAt).toLocaleString();
      const promptSnip =
        g.prompt?.length > 80 ? g.prompt.slice(0, 80) + "..." : g.prompt;
      return `[${date}] ${g.model} ${g.aspect} ${g.quality} — "${promptSnip}" (${g.outputs?.length || 0} images)`;
    });

    if (data.nextCursor) {
      lines.push(`\nMore results available — pass cursor: "${data.nextCursor}"`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ── start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
