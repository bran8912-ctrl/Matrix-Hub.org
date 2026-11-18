/**
 * Lead intake configuration — the SINGLE config spot for the site's
 * lead/order forms (the Video Studio order form and the n8n automation
 * intake form).
 *
 * The URL is the Google Apps Script web app deployed from
 * bot-core/automation/intake-apps-script/Code.gs (standalone project
 * "Matrix Hub Lead Intake", deployed 2026-11-18). Submissions land as
 * rows in the "Matrix Hub — Automation CRM" spreadsheet (Leads tab,
 * status "new") and trigger a notification email to the studio inbox.
 * The endpoint URL is itself the capability — it is a public form
 * endpoint by design, exactly like the forms that post to it.
 *
 * Contract: POST a JSON body. Apps Script always answers HTTP 200 —
 * success/failure is carried in the JSON body:
 *   success → { ok: true, submissionId: "web-..." }
 *   failure → { ok: false, error: "..." }
 * Form code MUST check the body's `ok` flag, never the HTTP status.
 * Required fields: businessName, email (valid-looking). The studio's
 * extra fields (source / package / amount / paymentMethod / details)
 * are folded into the CRM row by the script.
 *
 * If the script is ever redeployed under a new URL, update it here —
 * nowhere else.
 */
export const LEAD_INTAKE_URL =
  "https://script.google.com/macros/s/AKfycbytdDHpsFXmztPLYw0YF1ct9-1GPTNEo4VOfSk1YrlLH79WSPFUPt-qGX0OWQ40rGdD0A/exec";
