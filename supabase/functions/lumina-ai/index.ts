// Edge Function "lumina-ai": recursos de IA do Lumina Work (Claude Haiku 5.5).
// Recebe { action, payload } de um usuário logado e devolve { ok: true, data } ou { ok: false, error }.
// A chave da Anthropic vem do secret ANTHROPIC_API_KEY e nunca sai desta função.
import Anthropic from "npm:@anthropic-ai/sdk@0.129.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";

const MODEL = "claude-haiku-5-5";
const MAX_CALLS_PER_HOUR = 30;
const MAX_PAYLOAD_CHARS = 30_000;
const MAX_TASKS = 80;
const MAX_FIELD_CHARS = 800;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class FriendlyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ---------- Validação de entrada ----------

function str(v: unknown, max = MAX_FIELD_CHARS): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().slice(0, max);
}

function taskList(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) throw new FriendlyError("Nenhuma demanda foi enviada.");
  if (v.length > MAX_TASKS) throw new FriendlyError(`São ${v.length} demandas; o limite para a IA é ${MAX_TASKS}. Filtre um período menor.`);
  return v.filter(t => t && typeof t === "object") as Record<string, unknown>[];
}

// ---------- Ações ----------

type Action = {
  maxTokens: number;
  system: string;
  buildPrompt: (payload: Record<string, unknown>) => string;
  // Quando definido, a resposta vem como JSON validado por este schema.
  schema?: Record<string, unknown>;
  // Conferência final da resposta JSON contra o que foi enviado.
  validate?: (data: unknown, payload: Record<string, unknown>) => unknown;
};

// Regras contra invenção, comuns às ações que escrevem a partir das demandas.
const ONLY_GIVEN_DATA = [
  "Use APENAS as informações presentes nos dados recebidos (título, descrição, status, tempo, datas). Nunca invente prazos, entregas, resultados, nomes, números ou compromissos que não estejam nos dados.",
  "Se faltar informação para algo, omita em vez de preencher com suposição.",
  "Não escreva comentários sobre o próprio pedido nem sobre os dados recebidos (por exemplo \"a frase não detalha…\" ou \"não há informação sobre…\").",
];

// Demandas do e-mail de fechamento: só as que têm descrição, com id curto e único.
function closureTasks(p: Record<string, unknown>) {
  const tasks = taskList(p.tasks).map(t => ({
    id: str(t.id, 40),
    titulo: str(t.title, 200),
    status: t.status === "done" ? "finalizada" : "em andamento",
    descricao: str(t.description),
  })).filter(t => t.descricao);
  if (tasks.length === 0) throw new FriendlyError("Nenhuma demanda deste cliente tem descrição para a IA reescrever.");
  const ids = new Set(tasks.map(t => t.id));
  if (ids.has("") || ids.size !== tasks.length) throw new FriendlyError("Pedido inválido.");
  return tasks;
}

const ACTIONS: Record<string, Action> = {
  closure_email: {
    maxTokens: 3000,
    system: [
      "Você reescreve as descrições das demandas que entram no e-mail de fechamento semanal que um analista de uma agência envia ao cliente. Escreva em português do Brasil, com tom profissional, cordial e direto.",
      ...ONLY_GIVEN_DATA,
      "Para cada demanda recebida, devolva o mesmo id e UMA frase profissional que reescreve só a descrição recebida: o que foi feito, se a demanda está finalizada, ou o que está em curso, se está em andamento. Use o título apenas como contexto, sem repeti-lo.",
      "A frase não leva saudação, abertura, fechamento, data, link, tempo nem nome do cliente: o restante do e-mail é montado fora daqui.",
      "Sem Markdown e sem quebras de linha. Devolva todas as demandas recebidas, uma vez cada, sem criar outras.",
    ].join("\n"),
    schema: {
      type: "object",
      properties: {
        demandas: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" }, descricao: { type: "string" } },
            required: ["id", "descricao"],
            additionalProperties: false,
          },
        },
      },
      required: ["demandas"],
      additionalProperties: false,
    },
    buildPrompt: (p) => JSON.stringify({ demandas: closureTasks(p) }, null, 1),
    // Cada id enviado volta exatamente uma vez, com uma frase não vazia em uma linha só.
    validate: (data, p) => {
      const sent = closureTasks(p).map(t => t.id);
      const list = (data as { demandas?: unknown })?.demandas;
      const incomplete = () => new FriendlyError("A IA devolveu uma resposta incompleta. Tente de novo.", 502);
      if (!Array.isArray(list) || list.length !== sent.length) throw incomplete();
      const byId = new Map<string, string>();
      for (const item of list as { id?: unknown; descricao?: unknown }[]) {
        const id = typeof item?.id === "string" ? item.id : "";
        const descricao = typeof item?.descricao === "string" ? item.descricao.replace(/\s+/g, " ").trim() : "";
        if (!sent.includes(id) || byId.has(id) || !descricao) throw incomplete();
        byId.set(id, descricao);
      }
      return { demandas: sent.map(id => ({ id, descricao: byId.get(id)! })) };
    },
  },

  draft_task: {
    maxTokens: 800,
    system: [
      "Você transforma uma frase solta em uma demanda de trabalho de uma agência. Escreva em português do Brasil, tom profissional e direto.",
      ...ONLY_GIVEN_DATA,
      "Devolva: um título curto (até 60 caracteres, começando por verbo no infinitivo quando fizer sentido), uma descrição objetiva de uma a três frases e até 5 itens de checklist curtos e acionáveis, em ordem de execução.",
      "Não repita o nome do cliente na descrição nem no título: o cliente já fica registrado na demanda.",
      "O checklist deve conter só passos que decorram do que foi escrito na frase, sem pressupor etapas, aprovações, revisões ou exigências que a frase não mencionou. Se a frase só sustentar poucos passos, devolva só esses. Nunca invente passos para completar a lista.",
      "Não crie passos de confirmar, levantar ou coletar informação, validar o escopo ou alinhar com o cliente, a menos que a própria frase peça isso.",
      "Frase que relata um problema (por exemplo \"X indisponível\", \"erro em Y\", \"Z não funciona\", \"W fora do ar\") é um pedido para resolver esse problema. Nesse caso o checklist tem SEMPRE de 2 a 3 passos, nesta ordem e só destes tipos, cada um citando o assunto da frase: 1) começando por \"Identificar a causa\" (investigar o problema); 2) começando por \"Corrigir\" ou \"Restabelecer\" (aplicar a correção); 3) opcional, começando por \"Validar a correção\". Nenhum outro tipo de passo: nada de confirmar, verificar se está funcionando, levantar informação ou alinhar.",
      "Frase vaga, que não relata um problema concreto nem pede uma ação concreta (por exemplo \"ver aquele problema do cliente\"), fica com a descrição como reescrita fiel da frase, sem acrescentar nada, e o checklist VAZIO (lista sem itens).",
    ].join("\n"),
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        checklist: { type: "array", items: { type: "string" }, minItems: 0 },
      },
      required: ["title", "description", "checklist"],
      additionalProperties: false,
    },
    buildPrompt: (p) => {
      const text = str(p.text, 1000);
      if (!text) throw new FriendlyError("Escreva uma frase para a IA melhorar.");
      return JSON.stringify({ frase: text, cliente: str(p.clientName, 120) || null }, null, 1);
    },
  },

  weekly_summary: {
    maxTokens: 1200,
    system: [
      "Você resume a semana de trabalho de uma pessoa de uma agência, a partir da lista das demandas dela. Escreva em português do Brasil, tom profissional e direto.",
      "Separe em três blocos, cada um com itens de uma frase curta que citem a demanda e o cliente. Ao citar uma demanda, ponha o título e o nome do cliente entre marcadores de negrito, assim: **TÍTULO DA DEMANDA** (**Cliente**). Não use outra formatação.",
      "- moved: o que andou (finalizado ou com avanço na semana);",
      "- blocked: o que travou ou está aguardando alguém;",
      "- attention: o que está atrasado (prazo anterior à data de hoje e não finalizado) ou pede atenção.",
      ...ONLY_GIVEN_DATA,
      "Cada bloco pode ficar vazio. Não repita a mesma demanda em dois blocos sem motivo. Não invente motivos, pessoas nem prazos: cite um motivo de bloqueio só se ele estiver nos dados.",
      "Datas: criada_em é quando a demanda foi cadastrada, prazo é a data-limite e concluida_em é quando foi finalizada. Nunca escreva \"parado desde\", \"parada desde\" nem \"há X dias\". Para citar a data de criação, escreva \"criada em dd/mm\".",
    ].join("\n"),
    schema: {
      type: "object",
      properties: {
        moved: { type: "array", items: { type: "string" } },
        blocked: { type: "array", items: { type: "string" } },
        attention: { type: "array", items: { type: "string" } },
      },
      required: ["moved", "blocked", "attention"],
      additionalProperties: false,
    },
    buildPrompt: (p) => {
      const tasks = taskList(p.tasks).map(t => ({
        titulo: str(t.title, 200),
        cliente: str(t.client, 120),
        status: str(t.status, 60),
        tempo: str(t.time, 40) || null,
        criada_em: str(t.criada_em, 40) || null,
        prazo: str(t.prazo, 40) || null,
        concluida_em: str(t.concluida_em, 40) || null,
      }));
      if (tasks.length === 0) throw new FriendlyError("Você não tem demandas nesta semana para resumir.");
      return JSON.stringify({
        hoje: str(p.today, 40),
        periodo: { inicio: str(p.periodStart, 40), fim: str(p.periodEnd, 40) },
        demandas: tasks,
      }, null, 1);
    },
  },
};

// ---------- Limite de uso ----------

async function checkRateLimit(admin: SupabaseClient, userId: string, action: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) {
    console.error("lumina-ai: falha ao ler ai_usage", error.code);
    throw new FriendlyError("Não foi possível verificar seu limite de uso da IA. Tente de novo em instantes.", 503);
  }
  if ((count ?? 0) >= MAX_CALLS_PER_HOUR) {
    throw new FriendlyError(`Você atingiu o limite de ${MAX_CALLS_PER_HOUR} usos da IA por hora. Tente de novo mais tarde.`, 429);
  }
  const { error: insErr } = await admin.from("ai_usage").insert({ user_id: userId, action });
  if (insErr) console.error("lumina-ai: falha ao gravar ai_usage", insErr.code);
}

// ---------- Chamada à Anthropic ----------

function friendlyApiError(err: unknown): FriendlyError {
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new FriendlyError("A IA demorou demais para responder. Tente de novo.", 504);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new FriendlyError("Não foi possível falar com o serviço de IA. Tente de novo em instantes.", 502);
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new FriendlyError("A IA não está configurada corretamente. Avise o administrador do Lumina Work.", 503);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new FriendlyError("O serviço de IA está com muitas chamadas agora. Espere um minuto e tente de novo.", 503);
  }
  if (err instanceof Anthropic.BadRequestError) {
    // A Anthropic responde 400 quando a conta está sem crédito.
    if (/credit/i.test(err.message)) {
      return new FriendlyError("A IA está sem crédito no momento. Avise o administrador do Lumina Work.", 503);
    }
    return new FriendlyError("A IA não aceitou este pedido. Tente reduzir o texto ou as demandas enviadas.", 400);
  }
  if (err instanceof Anthropic.APIError) {
    return new FriendlyError("O serviço de IA está instável agora. Tente de novo em alguns minutos.", 502);
  }
  return new FriendlyError("Erro inesperado ao usar a IA. Tente de novo.", 500);
}

function buildPrompt(action: Action, payload: Record<string, unknown>): string {
  const prompt = action.buildPrompt(payload);
  if (prompt.length > MAX_PAYLOAD_CHARS) {
    throw new FriendlyError("Há informação demais para a IA de uma vez. Filtre menos demandas e tente de novo.");
  }
  return prompt;
}

async function runAction(action: Action, prompt: string, payload: Record<string, unknown>): Promise<unknown> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new FriendlyError("A IA não está configurada corretamente. Avise o administrador do Lumina Work.", 503);
  const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });

  let response: Anthropic.Message;
  try {
    // Haiku 5.5: sem temperature/top_p/top_k e sem prefill (dão 400). Raciocínio desligado
    // e esforço baixo, para tarefas simples de texto com custo previsível.
    response = await client.messages.create({
      model: MODEL,
      max_tokens: action.maxTokens,
      thinking: { type: "disabled" },
      output_config: {
        effort: "low",
        ...(action.schema ? { format: { type: "json_schema", schema: action.schema } } : {}),
      },
      system: action.system,
      messages: [{ role: "user", content: prompt }],
    } as Anthropic.MessageCreateParamsNonStreaming);
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    console.error("lumina-ai: erro da API", status ?? (err as Error)?.name);
    throw friendlyApiError(err);
  }

  if (response.stop_reason === "refusal") {
    throw new FriendlyError("A IA não quis responder a este pedido. Reformule o texto e tente de novo.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new FriendlyError("A resposta da IA ficou longa demais e foi cortada. Tente com menos demandas.", 422);
  }
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("")
    .trim();
  if (!text) throw new FriendlyError("A IA devolveu uma resposta vazia. Tente de novo.", 502);

  if (!action.schema) return { text };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new FriendlyError("A IA devolveu uma resposta em formato inesperado. Tente de novo.", 502);
  }
  return action.validate ? action.validate(data, payload) : data;
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);

  try {
    // O gateway já exige um JWT válido (verify_jwt). Aqui garantimos que é de um usuário
    // logado, e não a chave anônima, que também é um JWT válido.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !auth?.user) return json({ ok: false, error: "Sua sessão expirou. Entre de novo no Lumina Work." }, 401);

    let body: { action?: unknown; payload?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "Pedido inválido." }, 400);
    }
    const action = typeof body.action === "string" ? ACTIONS[body.action] : undefined;
    if (!action) return json({ ok: false, error: "Ação de IA desconhecida." }, 400);
    const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {};

    // Valida a entrada antes de contar o uso, para um pedido inválido não gastar a cota.
    const prompt = buildPrompt(action, payload);
    await checkRateLimit(admin, auth.user.id, body.action as string);
    const data = await runAction(action, prompt, payload);
    return json({ ok: true, data });
  } catch (err) {
    if (err instanceof FriendlyError) return json({ ok: false, error: err.message }, err.status);
    console.error("lumina-ai: erro inesperado", (err as Error)?.name);
    return json({ ok: false, error: "Erro inesperado ao usar a IA. Tente de novo." }, 500);
  }
});
