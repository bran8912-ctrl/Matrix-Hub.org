// Server-only handler: not routed in the static build. Mount under src/pages/api/ with `export const prerender = false;` and a Node adapter to enable.
import type { APIRoute } from 'astro';

const webhookUrl = process.env.N8N_WEBHOOK_URL || import.meta.env.PUBLIC_N8N_WEBHOOK_URL || '';

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const POST: APIRoute = async ({ request }) => {
  if (!webhookUrl) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Missing webhook configuration',
        message: 'Set N8N_WEBHOOK_URL in the server environment before enabling n8n webhook delivery.'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    const body = await request.json();
    const automationNeeds = Array.isArray(body?.automationNeeds)
      ? body.automationNeeds.filter((item: unknown) => typeof item === 'string').map((item) => item.trim())
      : [];

    const payload = {
      event: normalizeText(body?.event) || 'matrix-hub-automation-lead',
      source: 'matrix-hub-astro',
      leadSource: normalizeText(body?.leadSource) || 'website-automation-page',
      submittedAt: new Date().toISOString(),
      site: 'matrix-hub.org',
      businessName: normalizeText(body?.businessName),
      contactName: normalizeText(body?.contactName),
      name: normalizeText(body?.name),
      email: normalizeText(body?.email),
      phone: normalizeText(body?.phone),
      timeline: normalizeText(body?.timeline),
      budget: normalizeText(body?.budget),
      automationNeeds,
      workflowGoal: normalizeText(body?.workflowGoal),
      notes: normalizeText(body?.notes),
    };

    const upstreamResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstreamResponse.text();

    return new Response(
      JSON.stringify({
        ok: upstreamResponse.ok,
        status: upstreamResponse.status,
        message: text || 'n8n webhook delivery completed',
      }),
      {
        status: upstreamResponse.ok ? 200 : upstreamResponse.status,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Request forwarding failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
