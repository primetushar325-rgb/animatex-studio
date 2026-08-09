export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Simple health check - verify the server is running
    // Firebase connectivity is checked client-side
    return Response.json({ 
      ok: true, 
      timestamp: new Date().toISOString(),
      service: 'animation-studio'
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
