import { getRun } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const run = getRun(id);
  if (!run) {
    return new Response(JSON.stringify({ error: "Run not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ run }), {
    headers: { "Content-Type": "application/json" },
  });
}

