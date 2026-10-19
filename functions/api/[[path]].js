// Cloudflare Pages catch-all API route for /api/*.
// Reuse the exact Worker API/authentication implementation from src/index.js.
import worker from "../../src/index.js";

export async function onRequest(context) {
  return worker.fetch(context.request, context.env);
}
