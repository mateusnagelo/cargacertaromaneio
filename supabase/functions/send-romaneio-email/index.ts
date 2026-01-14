import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type NotificationType = 'ROMANEIO_CRIADO' | 'LEMBRETE_PAGAMENTO'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const normalizeSpace = (v: unknown) => String(v ?? '').trim()

const formatDateBr = (iso: string) => {
  const raw = normalizeSpace(iso)
  if (!raw) return ''
  const parts = raw.split('T')[0].split('-')
  if (parts.length !== 3) return raw
  const [y, m, d] = parts
  if (!y || !m || !d) return raw
  return `${d}/${m}/${y}`
}

const formatCurrencyBr = (value: number) => {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`
  }
}

const computeTotal = (payload: any, row: any) => {
  const products = Array.isArray(payload?.products) ? payload.products : Array.isArray(payload?.items) ? payload.items : []
  const expenses = Array.isArray(payload?.expenses)
    ? payload.expenses
    : Array.isArray(payload?.romaneio_expenses)
      ? payload.romaneio_expenses
      : []
  const productsTotal = products.reduce((acc: number, p: any) => acc + (Number(p?.quantity || 0) * Number(p?.unitValue || 0)), 0)
  const expensesTotal = expenses.reduce((acc: number, e: any) => acc + (Number(e?.total || e?.total_value || 0) || 0), 0)
  const itemsTotal = productsTotal + expensesTotal
  const dbTotal =
    Number(row?.montante_total ?? row?.total_value ?? row?.total_value ?? row?.total ?? row?.payload?.montante_total ?? 0) || 0
  return itemsTotal > 0 ? itemsTotal : dbTotal
}

const buildEventKey = (type: NotificationType, romaneioId: string, dueDate: string) => {
  if (type === 'ROMANEIO_CRIADO') return `created:${romaneioId}`
  if (type === 'LEMBRETE_PAGAMENTO') return `payment_reminder:${romaneioId}:${normalizeSpace(dueDate) || 'sem_venc'}`
  return `${type}:${romaneioId}`
}

const sendWithResend = async (params: { to: string; subject: string; html: string }) => {
  const apiKey = normalizeSpace(Deno.env.get('RESEND_API_KEY'))
  const fromEmail = normalizeSpace(Deno.env.get('RESEND_FROM_EMAIL'))
  const fromName = normalizeSpace(Deno.env.get('RESEND_FROM_NAME')) || 'CARGACERTA'
  if (!apiKey) throw new Error('RESEND_API_KEY ausente')
  if (!fromEmail) throw new Error('RESEND_FROM_EMAIL ausente')

  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = normalizeSpace((data as any)?.message) || `Falha ao enviar e-mail: HTTP ${res.status}`
    throw new Error(msg)
  }
  return data as any
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const supabaseUrl = normalizeSpace(Deno.env.get('SUPABASE_URL'))
  const supabaseAnonKey = normalizeSpace(Deno.env.get('SUPABASE_ANON_KEY'))
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: 'Supabase env ausente' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })

  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr) return json({ error: String(userErr.message || userErr) }, 401)
  const userId = userRes?.user?.id
  if (!userId) return json({ error: 'Usuário não autenticado' }, 401)

  const body = (await req.json().catch(() => null)) as any
  const romaneioId = normalizeSpace(body?.romaneioId)
  const type = normalizeSpace(body?.type) as NotificationType
  if (!romaneioId) return json({ error: 'romaneioId é obrigatório' }, 400)
  if (!type) return json({ error: 'type é obrigatório' }, 400)

  const tryFetch = async (select: string) => {
    const { data, error } = await supabase.from('romaneios').select(select).eq('id', romaneioId).single()
    if (!error) return data as any
    const msg = String(error.message || error)
    if (msg.includes('Could not find a relationship') || msg.includes('schema cache')) return null
    throw new Error(msg)
  }

  const row =
    (await tryFetch('*, company:companies(*), customer:customers(*)')) ?? (await tryFetch('*')) ?? null
  if (!row) return json({ skipped: true, reason: 'romaneio_not_found' }, 404)

  const payloadObj = row?.payload && typeof row.payload === 'object' ? row.payload : {}
  const number = normalizeSpace(row?.number ?? row?.guia ?? row?.numero ?? payloadObj?.number ?? payloadObj?.guia ?? payloadObj?.numero)
  const customerEmail =
    normalizeSpace(row?.customer?.email) ||
    normalizeSpace(payloadObj?.customer?.email) ||
    normalizeSpace(payloadObj?.client?.email) ||
    ''
  const customerName =
    normalizeSpace(row?.customer?.name) || normalizeSpace(payloadObj?.customer?.name) || normalizeSpace(payloadObj?.client?.name) || ''
  const companyName = normalizeSpace(row?.company?.name) || normalizeSpace(payloadObj?.company?.name) || ''
  const dueDate = normalizeSpace(payloadObj?.dueDate ?? row?.due_date ?? row?.dueDate)

  if (!customerEmail) return json({ skipped: true, reason: 'missing_customer_email' }, 200)

  const eventKey = normalizeSpace(body?.eventKey) || buildEventKey(type, romaneioId, dueDate)

  try {
    const { data: existing } = await supabase
      .from('email_notifications')
      .select('id')
      .eq('event_key', eventKey)
      .limit(1)
      .maybeSingle()
    if (existing?.id) return json({ skipped: true, reason: 'already_sent', eventKey }, 200)
  } catch {
  }

  const total = computeTotal(payloadObj, row)
  const totalFmt = formatCurrencyBr(total)
  const dueFmt = dueDate ? formatDateBr(dueDate) : ''

  const safeNumber = number ? `#${number}` : ''
  let subject = ''
  let title = ''
  let subtitle = ''

  if (type === 'ROMANEIO_CRIADO') {
    subject = `Romaneio ${safeNumber} criado`
    title = `Seu romaneio ${safeNumber} foi criado`
    subtitle = companyName ? `Emitido por ${companyName}` : ''
  } else if (type === 'LEMBRETE_PAGAMENTO') {
    subject = `Lembrete de pagamento - Romaneio ${safeNumber}${dueFmt ? ` (vence em ${dueFmt})` : ''}`
    title = `Lembrete de pagamento do romaneio ${safeNumber}`
    subtitle = dueFmt ? `Vencimento: ${dueFmt}` : ''
  } else {
    subject = `Atualização do romaneio ${safeNumber}`
    title = `Atualização do romaneio ${safeNumber}`
  }

  const html = `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0;">
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; font-weight: 800;">CARGACERTA</div>
          <div style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 8px;">${title}</div>
          ${subtitle ? `<div style="font-size: 13px; color: #475569; margin-top: 6px; font-weight: 700;">${subtitle}</div>` : ''}
        </div>

        <div style="background: #f1f5f9; padding: 16px; border-radius: 14px; border: 1px solid #e2e8f0;">
          <div style="display: flex; flex-wrap: wrap; gap: 12px;">
            <div style="flex: 1; min-width: 220px;">
              <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;">Cliente</div>
              <div style="font-size: 14px; color: #0f172a; font-weight: 800;">${customerName || '—'}</div>
            </div>
            <div style="flex: 1; min-width: 180px;">
              <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;">Total</div>
              <div style="font-size: 14px; color: #0f172a; font-weight: 900;">${totalFmt}</div>
            </div>
            ${dueFmt ? `
              <div style="flex: 1; min-width: 180px;">
                <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;">Vencimento</div>
                <div style="font-size: 14px; color: #0f172a; font-weight: 900;">${dueFmt}</div>
              </div>
            ` : ''}
          </div>
        </div>

        <div style="margin-top: 16px; font-size: 12px; color: #64748b;">
          Caso já tenha efetuado o pagamento, desconsidere esta mensagem.
        </div>
      </div>
      <div style="max-width: 640px; margin: 12px auto 0; font-size: 11px; color: #94a3b8; text-align: center;">
        Mensagem automática. Não responda este e-mail.
      </div>
    </div>
  `

  const sent = await sendWithResend({ to: customerEmail, subject, html })

  try {
    await supabase.from('email_notifications').insert({
      owner_id: userId,
      romaneio_id: romaneioId,
      type,
      event_key: eventKey,
      to_email: customerEmail,
      subject,
      provider: 'resend',
      provider_message_id: normalizeSpace((sent as any)?.id),
      metadata: {
        customerName,
        companyName,
        number,
        dueDate,
        total,
      },
    })
  } catch {
  }

  return json({ ok: true, eventKey, to: customerEmail, providerId: (sent as any)?.id ?? null }, 200)
})
