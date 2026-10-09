import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";

const ALLOWED_ORIGINS = new Set(["https://astraoilandgas2026.github.io", "http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]);
const NOTIFY_TO = "leo_quintero@astraoilandgas.com";
const SECTORS: Record<string, string> = { feedstock: "Feedstock & Vegetable Oils", energy_commodities: "Energy", mining_commodities: "Metals & Mining", fertilizers_chemicals: "Fertilizers & Chemicals", agricultural_commodities: "Agricultural" };
const REPORT_TYPES: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", one_off: "One-off / puntual" };
const cors = (origin: string) => ({ "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" });
const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
const sha256 = async (value: string) => { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""); };

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, headers);
  try {
    const body = await req.json();
    const sector = clean(body.sector, 50), topic = clean(body.topic, 180), reportType = clean(body.report_type, 20);
    const preferredSource = clean(body.preferred_source, 80) || "No preference", desiredPeriod = clean(body.desired_period, 100);
    const requestedBy = clean(body.requested_by, 100), notes = clean(body.notes, 1200);
    if (!SECTORS[sector]) return json({ error: "Select a valid sector." }, 400, headers);
    if (topic.length < 2) return json({ error: "Tell us which report or commodity is needed." }, 400, headers);
    if (!REPORT_TYPES[reportType]) return json({ error: "Select a report frequency." }, 400, headers);
    if (requestedBy.length < 2) return json({ error: "Enter the requester name." }, 400, headers);

    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
    const ipHash = await sha256(ip + (Deno.env.get("SUPABASE_URL") ?? ""));
    const supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase server credentials are not configured.");
    const db = createClient(supabaseUrl, serviceKey);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: ipCount, error: ipError } = await db.from("intelligence_report_requests").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
    if (ipError) throw ipError;
    const { count: globalCount, error: globalError } = await db.from("intelligence_report_requests").select("id", { count: "exact", head: true }).gte("created_at", since);
    if (globalError) throw globalError;
    if ((ipCount ?? 0) >= 3 || (globalCount ?? 0) >= 20) return json({ error: "Se alcanzó el límite temporal de solicitudes. Inténtalo más tarde." }, 429, headers);

    const { data: requestRow, error: insertError } = await db.from("intelligence_report_requests").insert({ sector, topic, report_type: reportType, preferred_source: preferredSource, desired_period: desiredPeriod, requested_by: requestedBy, notes, ip_hash: ipHash }).select("id, created_at").single();
    if (insertError) throw insertError;
    let notificationSent = false;
    try {
      const token = Deno.env.get("HOSTINGER_API_TOKEN");
      if (!token) throw new Error("HOSTINGER_API_TOKEN is not configured.");
      const accountRes = await fetch("https://api.hostinger.com/api/v1/me", { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      const account = await accountRes.json();
      if (!accountRes.ok) throw new Error("Hostinger account lookup failed.");
      const mailboxes = account?.data?.mailboxes ?? [], configuredMailbox = Deno.env.get("HOSTINGER_MAILBOX");
      const mailbox = configuredMailbox ? mailboxes.find((m: { address?: string; resourceId?: string }) => m.address === configuredMailbox || m.resourceId === configuredMailbox) : mailboxes[0];
      if (!mailbox?.resourceId) throw new Error("No authorized Hostinger mailbox configured.");
      const rows: [string, string][] = [["Solicitante", requestedBy], ["Sector", SECTORS[sector]], ["Informe / commodity", topic], ["Frecuencia", REPORT_TYPES[reportType]], ["Fuente preferida", preferredSource], ["Periodo", desiredPeriod || "No especificado"], ["Notas", notes || "Sin notas"], ["ID de solicitud", requestRow.id]];
      const textBody = ["Nueva solicitud registrada en AOG Procurement OS.", "", ...rows.map(([label, value]) => `${label}: ${value}`)].join("\\n");
      const html = `<div style="font-family:Arial,sans-serif;color:#242424;max-width:640px"><div style="border-top:5px solid #c62032;padding:18px 0"><h2 style="margin:0">AOG · Intelligence Reports</h2><p style="color:#666;margin-top:6px">Nueva solicitud de informe de mercado</p></div><table style="border-collapse:collapse;width:100%">${rows.map(([label, value]) => `<tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;width:180px">${escapeHtml(label)}</td><td style="padding:10px;border-bottom:1px solid #eee;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("")}</table><p style="font-size:12px;color:#777">Registrada en AOG Procurement OS.</p></div>`;
      const sendRes = await fetch(`https://api.hostinger.com/api/v1/mailboxes/${encodeURIComponent(mailbox.resourceId)}/send`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ to: [NOTIFY_TO], subject: `AOG · Nueva solicitud de Intelligence Report · ${SECTORS[sector]}`, text: textBody, html, displayName: "Astra Oil & Gas" }) });
      const sendRaw = await sendRes.text();
      if (!sendRes.ok) throw new Error(`Hostinger send failed: ${sendRes.status} ${sendRaw.slice(0, 180)}`);
      notificationSent = true;
    } catch (mailError) { console.error("intelligence report notification failed", mailError instanceof Error ? mailError.message : mailError); }
    return json({ ok: true, request_id: requestRow.id, notification_sent: notificationSent }, 200, headers);
  } catch (error) { console.error("request-intelligence-report", error); return json({ error: "No se pudo registrar la solicitud. Inténtalo nuevamente." }, 500, headers); }
});
