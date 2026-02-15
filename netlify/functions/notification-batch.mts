import type { Config } from "@netlify/functions";

// 12:10 KST = 03:10 UTC, 19:10 KST = 10:10 UTC
export default async function handler() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.URL || "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET || "";

  console.log(`[notification-batch] Triggering batch send at ${new Date().toISOString()}`);

  try {
    const response = await fetch(`${baseUrl}/api/notification/batch-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: cronSecret }),
    });

    const result = await response.json();
    console.log("[notification-batch] Result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: response.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notification-batch] Error:", error);
    return new Response(JSON.stringify({ error: "Failed to trigger batch send" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const config: Config = {
  // 03:10 UTC = 12:10 KST, 10:10 UTC = 19:10 KST
  schedule: "10 3,10 * * *",
};
