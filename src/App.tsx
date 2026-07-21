import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Plus, Pencil, Timer as TimerIcon, Trash2, X, Clock, Sparkles, 
  Users, Building2, BarChart3, LogOut, RotateCcw, 
  Filter, Search, AlertTriangle, GripVertical, Download, 
  Play, Pause, Square, CheckCircle2, User, CheckSquare,
  HelpCircle, ChevronDown, LayoutDashboard, Mail, Check, Copy, ClipboardList, Cloud, Lock,
  Eye, EyeOff, Settings, MonitorPlay, CloudRain, Sun, Moon, CloudLightning, Snowflake, CloudFog, UserCog, Calendar, ChevronUp,
  CalendarDays, ExternalLink, ChevronLeft, ChevronRight
} from "lucide-react";

// ==========================================
// CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE)
// ==========================================
const supabaseUrl = 'https://wztalukwyzqbjcvhrunt.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dGFsdWt3eXpxYmpjdmhydW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODM2NDQsImV4cCI6MjA5ODY1OTY0NH0.pvYYtBfK1HY73UbSadb8UiZARYvDFzxfB7qDwFLNUr8'; 
// ==========================================

// --- Funções Auxiliares ---
const nextId = () => Math.random().toString(36).substr(2, 9);
const upper = (v: any) => (v == null ? '' : String(v)).toUpperCase();

// Registro de eventos do histórico da demanda
function histEntry(type: string, from?: string, to?: string) {
  return { at: new Date().toISOString(), type, from: from || '', to: to || '' };
}

function formatTime(totalSeconds: number) {
  const s = Math.floor(totalSeconds);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function getBrasiliaDate() {
  const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(new Date());
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2025';
  return `${year}-${month}-${day}`;
}

function parseDateLocal(dateStr: string) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).setHours(0,0,0,0);
}

// Verifica se a data do item está dentro do período (início e fim)
function filterByPeriod(itemDateStr: string, startDateStr: string, endDateStr: string) {
  if (!startDateStr && !endDateStr) return true;
  if (!itemDateStr) return false;
  
  const itemDate = new Date(itemDateStr);
  itemDate.setHours(0, 0, 0, 0); 
  
  let isAfterStart = true;
  if (startDateStr) {
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    isAfterStart = itemDate >= startDate;
  }
  
  let isBeforeEnd = true;
  if (endDateStr) {
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999); 
    isBeforeEnd = itemDate <= endDate;
  }
  
  return isAfterStart && isBeforeEnd;
}

function downloadCSV(dataArray: any[], filename: string) {
  const csvContent = "data:text/csv;charset=utf-8," + dataArray.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Serialização estável (chaves ordenadas) para comparar registros com segurança,
// independente da ordem dos campos vinda do banco.
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

// Normalização única de tarefas (usada no carregamento inicial E nos eventos Realtime).
// Inclui a trava de segurança do cronômetro: se um timer ficou "rodando" por mais de
// 8 horas (aba fechada com timer ligado), ele é pausado automaticamente com teto de 8h,
// evitando que o banco de horas do cliente exploda por esquecimento.
const MAX_TIMER_SESSION_MS = 8 * 3600 * 1000;
function normalizeTask(t: any) {
  const norm: any = {
    ...t,
    title: t.title || '',
    description: t.description || '',
    status: t.status || 'backlog',
    priority: t.priority || 'Média',
    clientId: t.clientId || '',
    responsibleId: t.responsibleId || '',
    startDate: t.startDate || '',
    dueDate: t.dueDate || '',
    waitingFor: t.waitingFor || '',
    scheduledStart: t.scheduledStart || '',
    checklist: Array.isArray(t.checklist) ? t.checklist : [],
    history: Array.isArray(t.history) ? t.history : [],
    recurrence: t.recurrence || (t.recurringWeekly ? 'weekly' : 'none'),
    agendaOnly: !!t.agendaOnly,
    generatesCards: !!t.generatesCards,
    templateId: t.templateId || '',
    occurrenceKey: t.occurrenceKey || '',
    isMeeting: !!t.isMeeting,
    scheduledDurationMin: t.scheduledDurationMin || 0,
    timerElapsed: t.timerElapsed || 0,
    durationMin: t.durationMin || 0,
    createdAt: t.createdAt || t.dueDate || getBrasiliaDate(),
    completedAt: t.completedAt || ((t.status === 'done' || t.status === 'formalize') ? (t.dueDate || getBrasiliaDate()) : '')
  };
  if (norm.timerRunning && norm.timerStart && (Date.now() - norm.timerStart) > MAX_TIMER_SESSION_MS) {
    norm.timerRunning = false;
    norm.timerElapsed = (norm.timerElapsed || 0) + MAX_TIMER_SESSION_MS / 1000;
    norm.timerStart = null;
  }
  return norm;
}

// --- Componente Inteligente de Avatar ---
function UserAvatar({ url, name, className }: { url?: string, name?: string, className?: string }) {
  const [error, setError] = useState(false);
  
  useEffect(() => {
    setError(false);
  }, [url]);

  if (url && url.trim() !== '' && !error) {
    return <img src={url} alt={name} onError={() => setError(true)} className={`w-full h-full object-cover ${className || ''}`} />;
  }
  
  return <span className={`uppercase font-bold ${className || ''}`}>{name ? name.charAt(0) : '?'}</span>;
}

// --- Componente de Top Widgets (Data, Hora e Clima Real) ---
function TopWidgets() {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [weather, setWeather] = useState({ temp: '--', desc: 'A carregar...', Icon: Cloud, color: 'text-neutral-500' });

  useEffect(() => {
    const updateTime = () => {
       const now = new Date();
       const formatterDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
       const formatterTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
       setDateStr(formatterDate.format(now));
       setTimeStr(formatterTime.format(now));
    };
    updateTime();
    const id = setInterval(updateTime, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        const cw = data.current_weather;
        
        let desc = "Limpo"; let Icon = cw.is_day ? Sun : Moon; let color = cw.is_day ? "text-amber-400" : "text-indigo-200";
        if (cw.weathercode === 1 || cw.weathercode === 2 || cw.weathercode === 3) { desc = "Nublado"; Icon = Cloud; color = "text-neutral-300"; }
        else if (cw.weathercode === 45 || cw.weathercode === 48) { desc = "Nevoeiro"; Icon = CloudFog; color = "text-neutral-400"; }
        else if (cw.weathercode >= 51 && cw.weathercode <= 67) { desc = "Chuvoso"; Icon = CloudRain; color = "text-blue-400"; }
        else if (cw.weathercode >= 71 && cw.weathercode <= 77) { desc = "Neve"; Icon = Snowflake; color = "text-white"; }
        else if (cw.weathercode >= 80 && cw.weathercode <= 82) { desc = "Pancadas"; Icon = CloudRain; color = "text-blue-400"; }
        else if (cw.weathercode >= 95 && cw.weathercode <= 99) { desc = "Tempestade"; Icon = CloudLightning; color = "text-purple-400"; }

        setWeather({ temp: Math.round(cw.temperature), desc, Icon, color });
      } catch (e) { console.error("Erro no clima", e); }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(-19.9167, -43.9345) // Fallback: Belo Horizonte
      );
    } else {
      fetchWeather(-19.9167, -43.9345);
    }
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-3">
       <div className="flex items-center gap-1.5 sm:gap-2 bg-[#12121a] border border-[#27272a] px-3 sm:px-3.5 py-1.5 rounded-full text-[10px] sm:text-xs font-medium text-neutral-400 shadow-sm transition-all cursor-default">
          <weather.Icon size={14} className={weather.color} />
          <span>{weather.temp}°C <span className="hidden sm:inline">{weather.desc}</span></span>
       </div>
       <div className="flex items-center gap-1.5 sm:gap-2 bg-[#12121a] border border-[#27272a] px-3 sm:px-3.5 py-1.5 rounded-full text-[10px] sm:text-xs font-medium text-neutral-400 shadow-sm cursor-default">
          <Calendar size={14} className="text-indigo-400 hidden sm:block" />
          <span className="capitalize">{dateStr}</span>
          <span className="opacity-30">|</span>
          <span className="text-white font-bold">{timeStr}</span>
       </div>
    </div>
  )
}

// --- Componente de Login (Supabase Auth) ---
// Traduz erros do Supabase Auth para mensagens claras ao usuário final
function friendlyAuthError(msg?: string) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already')) return 'Este e-mail já tem uma conta. Use a aba "Entrar".';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada e o spam).';
  if (m.includes('at least 6') || m.includes('password should be')) return 'A senha deve ter no mínimo 6 caracteres.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('for security purposes')) return 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.';
  if (m.includes('invalid email') || m.includes('unable to validate email') || m.includes('invalid format')) return 'Informe um e-mail válido.';
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('load failed')) return 'Sem conexão. Verifique sua internet e tente novamente.';
  return 'Não foi possível concluir. Tente novamente em instantes.';
}

function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setFeedback(null);
    const supa = (window as any).supabaseClient;

    if (mode === 'signup' && name.trim().length < 3) return setFeedback({ type: 'error', text: 'Informe seu nome (mínimo 3 letras).' });
    if (!email.includes('@')) return setFeedback({ type: 'error', text: 'Informe um e-mail válido.' });
    if (password.length < 6) return setFeedback({ type: 'error', text: 'A senha deve ter no mínimo 6 caracteres.' });

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpErr } = await supa.auth.signUp({ email: email.trim(), password });
        if (signUpErr) throw signUpErr;
        if (!data.user) throw new Error('signup failed');

        // Cria o registro correspondente em 'responsibles', ligado à conta de Auth
        const { error: insertErr } = await supa
          .from('responsibles')
          .insert([{ id: 'r' + Date.now(), name: name.trim(), user_id: data.user.id, avatar: '' }]);
        if (insertErr) throw insertErr;

        // Sem sessão = Supabase exige confirmação por e-mail
        if (!data.session) {
          setMode('login');
          setPassword('');
          setFeedback({ type: 'success', text: 'Conta criada! Confirme o e-mail que enviamos e depois faça login.' });
          setLoading(false);
          return;
        }
        // Com sessão ativa: o app carrega o perfil e entra automaticamente
        setFeedback({ type: 'success', text: 'Conta criada! Entrando...' });
        return; // mantém o carregamento até o redirecionamento
      } else {
        const { error: signInErr } = await supa.auth.signInWithPassword({ email: email.trim(), password });
        if (signInErr) throw signInErr;
        setFeedback({ type: 'success', text: 'Entrando...' });
      }
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', text: friendlyAuthError(e?.message) });
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-[#09090b] flex items-center justify-center p-4 z-50">
      <div className="bg-[#12121a] p-8 rounded-[32px] border border-[#27272a] w-full max-w-sm shadow-[0_0_50px_rgba(79,70,229,0.05)] animate-modal-pop">
        <div className="flex flex-col items-center justify-center gap-4 mb-8">
          <div className="w-24 h-24 rounded-[22px] bg-black flex items-center justify-center border border-white/5 overflow-hidden shadow-2xl">
            <img src="/apple-icon.png" alt="Lumina Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Lumina</h1>
          <p className="text-indigo-400/80 text-xs uppercase tracking-[0.2em] font-medium">Kanban & Analytics</p>
        </div>

        <div className="flex bg-[#09090b] border border-[#27272a] rounded-xl p-1 mb-6">
          <button onClick={() => { setMode('login'); setFeedback(null); }} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-indigo-600 text-white' : 'text-neutral-500'}`}>Entrar</button>
          <button onClick={() => { setMode('signup'); setFeedback(null); }} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${mode === 'signup' ? 'bg-indigo-600 text-white' : 'text-neutral-500'}`}>Criar Conta</button>
        </div>

        {feedback && (
          <div className={`mb-5 px-4 py-3.5 rounded-xl flex items-center gap-3 text-sm font-medium border animate-modal-pop ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-red-500/10 border-red-500/25 text-red-300'}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
            <span className="leading-snug">{feedback.text}</span>
          </div>
        )}

        <div className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block ml-1">Nome</label>
              <input
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                placeholder="Seu nome completo"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block ml-1">E-mail</label>
            <input
              autoFocus
              type="email"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
              placeholder="voce@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block ml-1">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3.5 pr-10 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                placeholder="Mínimo de 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            disabled={loading || !email || !password || (mode === 'signup' && !name.trim())}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-4 font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex justify-center items-center gap-2 mt-4"
            onClick={handleSubmit}
          >
            {loading ? <Cloud size={18} className="animate-pulse" /> : (mode === 'signup' ? 'Criar Conta' : 'Entrar no Sistema')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Componente Principal ---
export default function App() {
  const [supabaseReady, setSupabaseReady] = useState(!!(window as any).supabaseClient);

  useEffect(() => {
    if ((window as any).supabase) {
      if (!(window as any).supabaseClient) {
        (window as any).supabaseClient = (window as any).supabase.createClient(supabaseUrl, supabaseKey);
      }
      setSupabaseReady(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'supabase-script';
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
       (window as any).supabaseClient = (window as any).supabase.createClient(supabaseUrl, supabaseKey);
       setSupabaseReady(true);
    };
    document.body.appendChild(script);
  }, []);

  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!supabaseReady) return;
    const supa = (window as any).supabaseClient;

    async function loadProfile(authUser: any, attempt = 0) {
      if (!authUser) { setUser(null); setAuthChecked(true); return; }
      const { data: profile } = await supa
        .from('responsibles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (profile) {
        setUser({ id: profile.id, name: profile.name, isAdmin: !!profile.is_admin, avatar: profile.avatar || '' });
        setAuthChecked(true);
        return;
      }
      // Perfil ainda não gravado (ex: conta recém-criada) — tenta de novo antes de desistir
      if (attempt < 4) {
        setTimeout(() => loadProfile(authUser, attempt + 1), 600);
        return;
      }
      setUser(null);
      setAuthChecked(true);
    }

    supa.auth.getSession().then(({ data }: any) => loadProfile(data.session?.user || null));

    const { data: sub } = supa.auth.onAuthStateChange((_event: string, session: any) => {
      loadProfile(session?.user || null);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabaseReady]);

  const handleLogout = async () => {
    await (window as any).supabaseClient.auth.signOut();
    setUser(null);
  };

  if (!supabaseReady) {
    return (
      <div className="fixed inset-0 bg-[#09090b] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 rounded-[18px] bg-black border border-white/5 flex items-center justify-center overflow-hidden mb-6 animate-pulse shadow-[0_0_30px_rgba(79,70,229,0.1)]">
          <img src="/apple-icon.png" alt="Lumina" className="w-full h-full object-cover" />
        </div>
        <div className="text-indigo-500 font-bold uppercase tracking-widest animate-pulse text-xs">Conectando...</div>
      </div>
    );
  }

  if (!authChecked) {
    return (
      <div className="fixed inset-0 bg-[#09090b] flex flex-col items-center justify-center p-4 text-center">
        <div className="text-indigo-500 font-bold uppercase tracking-widest animate-pulse text-xs">Verificando sessão...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <KanbanMain user={user} setUser={setUser} onLogout={handleLogout} />;
}

// --- Definição das Colunas e Estilos Aprimorados ---
const COLUMNS = [
    { id: "backlog", name: "Backlog", dot: "bg-indigo-500", accent: "border-indigo-500/50", bg: "bg-indigo-500/10", btn: "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20", help: "Repositório de ideias, solicitações e demandas futuras. Ainda não foram priorizadas nem têm data para começar." },
    { id: "todo", name: "A Fazer", dot: "bg-amber-500", accent: "border-amber-500/50", bg: "bg-amber-500/10", btn: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20", help: "Demandas analisadas, aprovadas e priorizadas. Estão prontas para a equipe puxar e começar a trabalhar." },
    { id: "inprogress", name: "Em Andamento", dot: "bg-blue-500", accent: "border-blue-500/50", bg: "bg-blue-500/10", btn: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20", help: "O que está sendo feito neste exato momento. O responsável já está ativamente a trabalhar na demanda." },
    { id: "paused", name: "Pausado", dot: "bg-orange-500", accent: "border-orange-500/50", bg: "bg-orange-500/10", btn: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20", help: "Demandas interrompidas temporariamente por impedimentos internos, mudança repentina de prioridade ou falta de recursos." },
    { id: "waiting", name: "Aguardando", dot: "bg-pink-500", accent: "border-pink-500/50", bg: "bg-pink-500/10", btn: "bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border-pink-500/20", help: "Dependemos de terceiros. À espera de aprovação do cliente, envio de acessos ou retorno obrigatório de outro setor." },
    { id: "review", name: "Em Revisão", dot: "bg-purple-500", accent: "border-purple-500/50", bg: "bg-purple-500/10", btn: "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20", help: "Trabalho técnico concluído. Passando por teste de qualidade (QA), validação final rigorosa ou aprovação do gestor." },
    { id: "done", name: "Concluído", dot: "bg-emerald-500", accent: "border-emerald-500/50", bg: "bg-emerald-500/10", btn: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20", help: "100% finalizado e validado sem erros. O trabalho prático e as aprovações terminaram com sucesso." },
    { id: "formalize", name: "Formalizar", dot: "bg-teal-500", accent: "border-teal-500/50", bg: "bg-teal-500/10", btn: "bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border-teal-500/20", help: "Demandas prontas, aguardando apenas o envio de um e-mail de fechamento e o envio do relatório final ao cliente." },
    { id: "cancelled", name: "Cancelado", dot: "bg-red-500", accent: "border-red-500/50", bg: "bg-red-500/10", btn: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20", help: "Demandas que foram descartadas, inviáveis de realizar ou que perderam o sentido antes de serem entregues." },
];

const PRIORITY_STYLE: Record<string, any> = {
  Baixa: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-500" },
  Média: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" },
  Alta: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
};

function KanbanMain({ user, setUser, onLogout }: { user: any, setUser: any, onLogout: any }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [responsibles, setResponsibles] = useState<any[]>([]);
  const [globalLookerUrl, setGlobalLookerUrl] = useState<string>('');
  
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // "Fotografia" do último estado sincronizado de cada registro.
  // Permite salvar SÓ o que mudou (em vez de reenviar tudo) e
  // ignorar ecos dos próprios saves vindos do Realtime.
  const lastSyncedTasksRef = useRef<Record<string, string>>({});
  const lastSyncedClientsRef = useRef<Record<string, string>>({});

  // Monitora se está em Mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Alerta "hora de começar": avisa ~10 min antes de uma demanda agendada (enquanto o app está aberto)
  useEffect(() => {
    const occurrenceMs = (t: any) => {
      const s = new Date(t.scheduledStart);
      const now = new Date();
      if (t.recurrence === 'daily') {
        const occ = new Date(now);
        occ.setHours(s.getHours(), s.getMinutes(), 0, 0);
        let ms = occ.getTime();
        if (ms - now.getTime() < -60000) ms += 24 * 3600 * 1000;
        return ms;
      }
      if (t.recurrence === 'weekly') {
        const occ = new Date(now);
        occ.setHours(s.getHours(), s.getMinutes(), 0, 0);
        const dayDiff = (s.getDay() - now.getDay() + 7) % 7;
        occ.setDate(now.getDate() + dayDiff);
        let ms = occ.getTime();
        if (ms - now.getTime() < -60000) ms += 7 * 24 * 3600 * 1000;
        return ms;
      }
      return s.getTime();
    };
    const check = () => {
      const nowMs = Date.now();
      const soon = tasks.find((t: any) => {
        if (t.responsibleId !== user.id) return false;
        if (!t.scheduledStart) return false;
        if (['done', 'cancelled', 'formalize'].includes(t.status)) return false;
        if (t.generatesCards) return false;
        const occMs = occurrenceMs(t);
        if (dueAlertedRef.current.has(t.id + '|' + occMs)) return false;
        const diff = occMs - nowMs;
        return diff >= -60000 && diff <= 10 * 60000;
      });
      if (soon) {
        const occMs = occurrenceMs(soon);
        dueAlertedRef.current.add(soon.id + '|' + occMs);
        setDueAlert(soon);
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const s = new Date(occMs);
            new Notification('Hora de começar — Lumina', { body: `${soon.title} às ${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}` });
          }
        } catch {}
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [tasks, user]);

  // Materialização de recorrências: gera 1 card real por ocorrência (modelos "geram cards")
  // Protegido contra duplicidade: nunca gera se já existir uma instância com o mesmo occurrenceKey.
  useEffect(() => {
    const gen = () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
      const existingKeys = new Set(tasks.map((t: any) => t.occurrenceKey).filter(Boolean));
      const news: any[] = [];
      tasks.forEach((t: any) => {
        if (!t.generatesCards || !t.scheduledStart) return;
        if (t.responsibleId !== user.id) return;
        const s = new Date(t.scheduledStart);
        const occToday = t.recurrence === 'daily' || (t.recurrence === 'weekly' && s.getDay() === today.getDay());
        if (!occToday) return;
        const key = `${t.id}|${todayStr}`;
        if (existingKeys.has(key)) return; // já existe instância de hoje para este modelo: não duplica
        news.push({
          id: `inst_${t.id}_${todayStr}`,
          title: t.title, description: t.description || '', priority: t.priority || 'Média',
          durationMin: t.durationMin || 0, scheduledDurationMin: t.scheduledDurationMin || t.durationMin || 0, clientId: t.clientId || '', responsibleId: t.responsibleId,
          startDate: todayStr, dueDate: '', status: 'todo', waitingFor: '',
          checklist: (t.checklist || []).map((c: any) => ({ id: nextId(), text: c.text, done: false })),
          timerRunning: false, timerStart: null, timerElapsed: 0,
          createdAt: getBrasiliaDate(), completedAt: '',
          scheduledStart: `${todayStr}T${pad2(s.getHours())}:${pad2(s.getMinutes())}`,
          recurrence: 'none', agendaOnly: false, generatesCards: false, isMeeting: false,
          templateId: t.id, occurrenceKey: key,
          history: [histEntry('created')],
        });
      });
      if (news.length) setTasks((prev: any) => {
        const haveKeys = new Set(prev.map((p: any) => p.occurrenceKey).filter(Boolean));
        const haveIds = new Set(prev.map((p: any) => p.id));
        const add = news.filter(n => !haveKeys.has(n.occurrenceKey) && !haveIds.has(n.id));
        return add.length ? [...prev, ...add] : prev;
      });
    };
    gen();
    const gid = setInterval(gen, 60000);
    return () => clearInterval(gid);
  }, [tasks, user]);

  // Busca dados da Nuvem (o RLS já filtra o que cada usuário pode ver)
  useEffect(() => {
    async function fetchCloudData() {
      try {
        const [resTasks, resClients, resResp, resSettings] = await Promise.all([
          (window as any).supabaseClient.from('tasks').select('*'),
          (window as any).supabaseClient.from('clients').select('*'),
          (window as any).supabaseClient.from('responsibles').select('*'),
          (window as any).supabaseClient.from('settings').select('*').eq('id', 'global').maybeSingle()
        ]);

        if (resTasks.data) {
          setTasks(resTasks.data.map(normalizeTask));
        }

        if (resClients.data) {
          setClients(resClients.data.map((c: any) => ({
            ...c,
            name: c.name || '',
            lookerUrl: c.lookerUrl || '',
            ownerId: c.ownerId || '',
            emails: Array.isArray(c.emails) ? c.emails : (typeof c.email === 'string' && c.email ? c.email.split(',').map(e => e.trim()) : []),
            contractedHours: parseFloat(c.contractedHours) || 0
          })));
        }

        if (resResp.data) {
          setResponsibles(resResp.data.map((r: any) => ({
            ...r,
            name: r.name || '',
            avatar: r.avatar || ''
          })));
        }
        
        if (resSettings.data) {
            setGlobalLookerUrl(resSettings.data.looker_global_url || '');
        }

      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setIsLoading(false);
        setIsCloudSynced(true);
      }
    }
    fetchCloudData();
  }, []);

  // Sincroniza Tarefas — versão inteligente: salva APENAS os registros que mudaram.
  // Isso evita reenviar o quadro inteiro a cada clique e reduz drasticamente o risco
  // de um usuário sobrescrever alterações simultâneas de outro.
  useEffect(() => {
    if (!isCloudSynced) return;
    const changed = tasks.filter(t => lastSyncedTasksRef.current[t.id] !== stableStringify(t));
    if (changed.length === 0) return;
    changed.forEach(t => { lastSyncedTasksRef.current[t.id] = stableStringify(t); });
    (window as any).supabaseClient.from('tasks').upsert(changed).then(({ error }: any) => {
      if (error) console.error("Erro ao sincronizar tarefas:", error);
    });
  }, [tasks, isCloudSynced]);

  // Sincroniza Clientes — apenas o admin escreve em 'clients' (o RLS bloqueia os demais).
  // Sem esse filtro, consultores gerariam erros silenciosos a cada mudança de estado.
  useEffect(() => {
    if (!isCloudSynced || !user.isAdmin) return;
    const changed = clients.filter(c => lastSyncedClientsRef.current[c.id] !== stableStringify(c));
    if (changed.length === 0) return;
    changed.forEach(c => { lastSyncedClientsRef.current[c.id] = stableStringify(c); });
    (window as any).supabaseClient.from('clients').upsert(changed).then(({ error }: any) => {
      if (error) console.error("Erro ao sincronizar clientes:", error);
    });
  }, [clients, isCloudSynced, user.isAdmin]);

  // Realtime: quando outro usuário (ex: o admin) altera uma tarefa sua,
  // o seu quadro atualiza sozinho, sem precisar recarregar a página.
  useEffect(() => {
    if (!isCloudSynced) return;
    const supa = (window as any).supabaseClient;
    if (!supa?.channel) return;

    const channel = supa
      .channel('lumina-tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (!oldId) return;
          delete lastSyncedTasksRef.current[oldId];
          setTasks(prev => prev.filter(t => t.id.toString() !== oldId.toString()));
          return;
        }
        const row = payload.new;
        if (!row?.id) return;
        const normalized = normalizeTask(row);
        const snap = stableStringify(normalized);
        if (lastSyncedTasksRef.current[row.id] === snap) return; // eco do nosso próprio save
        lastSyncedTasksRef.current[row.id] = snap;
        setTasks(prev => {
          const idx = prev.findIndex(t => t.id.toString() === row.id.toString());
          if (idx === -1) return [...prev, normalized];
          const copy = [...prev];
          copy[idx] = normalized;
          return copy;
        });
      })
      .subscribe();

    return () => { supa.removeChannel(channel); };
  }, [isCloudSynced]);

  const [activeTab, setActiveTab] = useState('board'); 
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeTooltipCol, setActiveTooltipCol] = useState<string | null>(null);
  
  // Controle de Filtros Principais (persistidos entre sessões)
  const savedFilters = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('lumina_filters') || '{}'); } catch { return {}; }
  }, []);
  const [showFilters, setShowFilters] = useState(false);
  const [filterClient, setFilterClient] = useState(savedFilters.filterClient || "all");
  const [filterResp, setFilterResp] = useState(savedFilters.filterResp || "all");
  const [filterPriority, setFilterPriority] = useState(savedFilters.filterPriority || "all");
  const [filterCreatedStart, setFilterCreatedStart] = useState(savedFilters.filterCreatedStart || "");
  const [filterCreatedEnd, setFilterCreatedEnd] = useState(savedFilters.filterCreatedEnd || "");
  const [filterCompletedStart, setFilterCompletedStart] = useState(savedFilters.filterCompletedStart || "");
  const [filterCompletedEnd, setFilterCompletedEnd] = useState(savedFilters.filterCompletedEnd || "");

  // Salva os filtros sempre que mudam (ficam fixos mesmo recarregando)
  useEffect(() => {
    try {
      localStorage.setItem('lumina_filters', JSON.stringify({ filterClient, filterResp, filterPriority, filterCreatedStart, filterCreatedEnd, filterCompletedStart, filterCompletedEnd }));
    } catch {}
  }, [filterClient, filterResp, filterPriority, filterCreatedStart, filterCreatedEnd, filterCompletedStart, filterCompletedEnd]);

  // Consultor não filtra por responsável (só vê as próprias demandas)
  useEffect(() => {
    if (!user.isAdmin && filterResp !== 'all') setFilterResp('all');
  }, [user.isAdmin]);

  const hasDateFilters = filterCreatedStart || filterCreatedEnd || filterCompletedStart || filterCompletedEnd;
  const hasAnyFilter = filterClient !== 'all' || filterResp !== 'all' || filterPriority !== 'all' || !!hasDateFilters;
  const resetFilters = () => {
    setFilterClient('all'); setFilterResp('all'); setFilterPriority('all');
    setFilterCreatedStart(''); setFilterCreatedEnd(''); setFilterCompletedStart(''); setFilterCompletedEnd('');
  };

  const [modal, setModal] = useState<any>(null); 
  const [profileModal, setProfileModal] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dueAlert, setDueAlert] = useState<any>(null);
  const dueAlertedRef = useRef<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<any>(null);
  
  const [waitingPrompt, setWaitingPrompt] = useState<string | null>(null);
  const [donePrompt, setDonePrompt] = useState<any>(null);
  const [closureModal, setClosureModal] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  const handleCloseTab = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setActiveTab('board');
      setIsClosingModal(false);
    }, 250);
  };

  const getElapsed = (t: any) => {
    if (t.timerRunning && t.timerStart) return t.timerElapsed + (Date.now() - t.timerStart) / 1000;
    return t.timerElapsed || 0;
  };

  // Exclui a demanda de vez (estado local + Supabase), evitando que "volte" no reload
  const deleteTaskById = async (id: string) => {
    delete lastSyncedTasksRef.current[id];
    setTasks((prev: any) => prev.filter((t: any) => t.id !== id));
    if ((window as any).supabaseClient) await (window as any).supabaseClient.from('tasks').delete().eq('id', id.toString());
  };

  const visibleClients = useMemo(() => {
    if (user.isAdmin) return clients;
    return clients.filter(c => c.ownerId === user.id || tasks.some(t => t.clientId === c.id && t.responsibleId === user.id));
  }, [clients, tasks, user]);

  const [dismissedLimits, setDismissedLimits] = useState(new Set());

  const clientsNearLimit = useMemo(() => {
    return visibleClients.filter(c => {
      if (!c.contractedHours) return false;
      const cTasks = tasks.filter(t => t.clientId === c.id);
      const hours = cTasks.reduce((acc, t) => acc + (getElapsed(t) / 3600), 0);
      return (c.contractedHours - hours) <= 5;
    });
  }, [visibleClients, tasks]);

  const pendingLimitAlerts = clientsNearLimit.filter(c => !dismissedLimits.has(c.id));

  const canEditTask = (taskRespId: string) => taskRespId === user.id;

  const visibleTasks = user.isAdmin ? tasks : tasks.filter(t => t.responsibleId === user.id);

  const overdueCount = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    return tasks.filter(t => {
      if (t.responsibleId !== user.id) return false;
      if (['done', 'cancelled', 'formalize'].includes(t.status)) return false;
      if (!t.dueDate) return false;
      const [y, m, d] = t.dueDate.split('-');
      return new Date(+y, +m - 1, +d).setHours(0, 0, 0, 0) < todayMs;
    }).length;
  }, [tasks, user]);

  // Demandas que pedem atenção HOJE: atrasadas + vencem hoje + iniciam hoje
  const todayCount = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const dayMs = (s: string) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-'); return new Date(+y, +m - 1, +d).setHours(0, 0, 0, 0); };
    return tasks.filter(t => {
      if (t.responsibleId !== user.id) return false;
      if (['done', 'cancelled', 'formalize'].includes(t.status) || t.agendaOnly || t.generatesCards) return false;
      const due = dayMs(t.dueDate);
      const start = dayMs(t.startDate);
      const sched = dayMs(t.scheduledStart);
      const startCounts = start === todayMs && ['backlog', 'todo'].includes(t.status);
      return (due !== null && due <= todayMs) || startCounts || sched === todayMs;
    }).length;
  }, [tasks, user]);
  
  const filteredTasks = visibleTasks.filter(
    (t) =>
      !t.agendaOnly && !t.generatesCards &&
      (filterClient === "all" || t.clientId === filterClient) &&
      (filterResp === "all" || t.responsibleId === filterResp) &&
      (filterPriority === "all" || t.priority === filterPriority) &&
      filterByPeriod(t.createdAt, filterCreatedStart, filterCreatedEnd) &&
      filterByPeriod(t.completedAt, filterCompletedStart, filterCompletedEnd)
  );

  const activeTasksCount = visibleTasks.filter((t) => t.status !== "cancelled" && !t.agendaOnly).length;
  const doneCount = visibleTasks.filter((t) => (t.status === "done" || t.status === "formalize") && !t.agendaOnly).length;
  const overallProgress = activeTasksCount ? Math.round((doneCount / activeTasksCount) * 100) : 0;
  
  const tasksForClosure = visibleTasks.filter(t => !t.agendaOnly && ['inprogress', 'paused', 'waiting', 'review', 'done'].includes(t.status));

  const emptyForm = { title: "", description: "", priority: "Média", durationMin: "", clientId: "", responsibleId: user.id, startDate: "", dueDate: "", status: "", waitingFor: "", checklist: [] };

  function openAddModal(status: string) {
    setValidationError(null);
    setModal({ mode: "add", status, form: { ...emptyForm, status } });
  }
  function openEditModal(task: any) {
    setValidationError(null);
    setModal({ mode: "edit", task, form: { ...task, checklist: Array.isArray(task.checklist) ? task.checklist.map((c: any) => ({ ...c })) : [] } });
  }
  function closeModal() {
    setModal(null);
    setValidationError(null);
  }

  function saveModal() {
    const f = modal.form;
    const missing = [];
    if (!f.title.trim()) missing.push("Título");
    if (!f.description.trim()) missing.push("Descrição");
    if (!f.clientId) missing.push("Cliente");
    if (!f.responsibleId) missing.push("Responsável");
    if (!f.status) missing.push("Fase do Fluxo");
    if (!f.priority) missing.push("Prioridade");
    if (f.status === 'waiting' && !f.waitingFor) missing.push("Dependência (Aguardando por)");
    
    if (missing.length > 0) {
      setValidationError(missing);
      return;
    }

    const allDone = f.checklist && f.checklist.length > 0 && f.checklist.every((c: any) => c.done);
    let finalStatus = f.status || modal.status;

    if (allDone && finalStatus !== 'done' && finalStatus !== 'cancelled' && finalStatus !== 'formalize') {
        finalStatus = 'done';
    }

    if (finalStatus === 'done' && (!modal.task || modal.task.status !== 'done')) {
        setDonePrompt({
            isFromModal: true,
            draftData: { ...f, status: 'done' },
            taskId: modal.task ? modal.task.id : nextId(),
            targetId: null,
            date: getBrasiliaDate(),
            durationMin: parseInt(f.durationMin) || ""
        });
        return;
    }

    if (modal.mode === "add") {
      const newTask = {
        id: nextId(),
        title: upper(f.title.trim()),
        description: upper(f.description.trim()),
        priority: f.priority || 'Média',
        durationMin: parseInt(f.durationMin) || 0,
        clientId: f.clientId || '',
        responsibleId: f.responsibleId || '',
        startDate: f.startDate || '',
        dueDate: f.dueDate || '',
        status: finalStatus,
        waitingFor: upper(f.waitingFor || ''),
        checklist: (f.checklist || []).filter((c: any) => c.text.trim()).map((c: any) => ({ ...c, text: upper(c.text) })),
        timerRunning: false,
        timerStart: null,
        timerElapsed: 0,
        createdAt: getBrasiliaDate(),
        completedAt: (finalStatus === 'done' || finalStatus === 'formalize') ? getBrasiliaDate() : '',
        scheduledStart: f.scheduledStart || '',
        recurrence: f.recurrence || 'none',
        agendaOnly: !!f.agendaOnly,
        generatesCards: !!f.generatesCards,
        templateId: f.templateId || '',
        occurrenceKey: f.occurrenceKey || '',
        isMeeting: !!f.isMeeting,
        scheduledDurationMin: f.scheduledDurationMin || 0,
        history: [histEntry('created')]
      };
      setTasks((prev) => [...prev, newTask]);
    } else {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== modal.task.id) return t;
          
          let timerRunning = t.timerRunning;
          let timerElapsed = t.timerElapsed;
          let timerStart = t.timerStart;

          if ((finalStatus === 'done' || finalStatus === 'cancelled' || finalStatus === 'formalize') && timerRunning) {
            timerRunning = false;
            timerElapsed += (Date.now() - timerStart) / 1000;
            timerStart = null;
          }

          if (!timerRunning && (finalStatus === 'done' || finalStatus === 'formalize' || finalStatus === 'cancelled')) {
            timerElapsed = (parseInt(f.durationMin) || 0) * 60;
          }

          return { 
            id: t.id,
            title: upper(f.title.trim()), 
            description: upper(f.description.trim()), 
            priority: f.priority || 'Média',
            durationMin: parseInt(f.durationMin) || 0,
            clientId: f.clientId || '',
            responsibleId: f.responsibleId || '',
            startDate: f.startDate || '',
            dueDate: f.dueDate || '',
            status: finalStatus,
            waitingFor: upper(f.waitingFor || ''),
            checklist: (f.checklist || []).filter((c: any) => c.text.trim()).map((c: any) => ({ ...c, text: upper(c.text) })),
            recurrence: f.recurrence || 'none',
            agendaOnly: !!f.agendaOnly,
            scheduledStart: f.scheduledStart || '',
            generatesCards: !!f.generatesCards,
            templateId: f.templateId || '',
            occurrenceKey: f.occurrenceKey || '',
            isMeeting: !!f.isMeeting,
            scheduledDurationMin: f.scheduledDurationMin || 0,
            timerRunning, timerElapsed, timerStart,
            createdAt: t.createdAt || getBrasiliaDate(),
            completedAt: (finalStatus === 'done' || finalStatus === 'formalize') ? (t.completedAt || getBrasiliaDate()) : t.completedAt,
            history: (finalStatus !== t.status) ? [...(Array.isArray(t.history) ? t.history : []), histEntry('status', t.status, finalStatus)] : (Array.isArray(t.history) ? t.history : [])
          };
        })
      );
    }
    closeModal();
  }

  function toggleTimer(id: string) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.timerRunning) {
          const elapsed = t.timerElapsed + (Date.now() - t.timerStart) / 1000;
          return { ...t, timerRunning: false, timerStart: null, timerElapsed: elapsed };
        }
        return { ...t, timerRunning: true, timerStart: Date.now() };
      })
    );
  }

  const handleRequestMove = (taskId: string, targetId: string | null, newStatus: string) => {
    const task = tasks.find(t => t.id.toString() === taskId.toString());
    if (!task) return;

    if (newStatus === 'done' && task.status !== 'done') {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;

      setDonePrompt({
        isFromModal: false,
        taskId,
        targetId,
        date: localDateStr,
        durationMin: Math.round(task.timerElapsed / 60) || task.durationMin || ""
      });
      return;
    }

    moveTask(taskId, targetId, newStatus);
  };

  const confirmDoneMove = () => {
    if (!donePrompt.date || donePrompt.durationMin === "") {
      setValidationError(["Data de Entrega e Tempo são obrigatórios."]);
      return;
    }
    setValidationError(null);

    if (donePrompt.isFromModal) {
      const isAdd = modal.mode === 'add';
      const prevHist = isAdd ? [histEntry('created')] : (Array.isArray(modal.task?.history) ? modal.task.history : []);
      const finalTask = {
         ...donePrompt.draftData,
         id: donePrompt.taskId,
         dueDate: donePrompt.date,
         timerElapsed: (parseInt(donePrompt.durationMin) || 0) * 60,
         durationMin: parseInt(donePrompt.durationMin) || 0,
         timerRunning: false,
         timerStart: null,
         status: 'done',
         completedAt: donePrompt.date,
         history: [...prevHist, histEntry('status', isAdd ? '' : (modal.task?.status || ''), 'done')]
      };
      
      if (modal.mode === 'add') setTasks(prev => [...prev, finalTask]);
      else setTasks(prev => prev.map(t => t.id === finalTask.id ? finalTask : t));
      
      setDonePrompt(null);
      closeModal();
      return;
    }

    setTasks(prev => {
      const fromIndex = prev.findIndex(t => t.id.toString() === donePrompt.taskId.toString());
      if (fromIndex === -1) return prev;

      const taskToMove = { ...prev[fromIndex] };
      taskToMove.dueDate = donePrompt.date;
      taskToMove.timerElapsed = (parseInt(donePrompt.durationMin) || 0) * 60;
      taskToMove.durationMin = parseInt(donePrompt.durationMin) || 0;
      taskToMove.timerRunning = false;
      taskToMove.timerStart = null;
      taskToMove.status = 'done';
      taskToMove.completedAt = donePrompt.date;
      taskToMove.history = [...(Array.isArray(taskToMove.history) ? taskToMove.history : []), histEntry('status', prev[fromIndex].status, 'done')];

      const originalToIndex = donePrompt.targetId ? prev.findIndex(t => t.id.toString() === donePrompt.targetId.toString()) : -1;

      const newTasks = [...prev];
      newTasks.splice(fromIndex, 1);

      if (donePrompt.targetId) {
        let toIndex = newTasks.findIndex(t => t.id.toString() === donePrompt.targetId.toString());
        if (prev[fromIndex].status === 'done' && fromIndex < originalToIndex) {
           toIndex += 1;
        }

        if (toIndex !== -1) {
          newTasks.splice(toIndex, 0, taskToMove);
        } else {
          newTasks.push(taskToMove);
        }
      } else {
        newTasks.push(taskToMove);
      }
      return newTasks;
    });

    setDonePrompt(null);
  };

  const moveTask = (draggedId: string, targetId: string | null, newStatus: string) => {
    if (!draggedId) return;
    
    setTasks(prev => {
      const fromIndex = prev.findIndex(t => t.id.toString() === draggedId.toString());
      if (fromIndex === -1) return prev;
      
      const taskToMove = { ...prev[fromIndex] };
      const originalStatus = taskToMove.status;
      let timerRunning = taskToMove.timerRunning;
      let timerElapsed = taskToMove.timerElapsed;
      let timerStart = taskToMove.timerStart;
      
      if (originalStatus !== newStatus) {
        if ((newStatus === 'cancelled' || newStatus === 'formalize') && timerRunning) {
          timerRunning = false;
          timerElapsed += (Date.now() - timerStart) / 1000;
          timerStart = null;
        }
        
        if (newStatus === 'waiting') {
          taskToMove.waitingFor = ''; 
          setTimeout(() => setWaitingPrompt(taskToMove.id), 10);
        }
      }
      
      taskToMove.status = newStatus;
      taskToMove.timerRunning = timerRunning;
      taskToMove.timerElapsed = timerElapsed;
      taskToMove.timerStart = timerStart;
      if (originalStatus !== newStatus) {
        taskToMove.history = [...(Array.isArray(taskToMove.history) ? taskToMove.history : []), histEntry('status', originalStatus, newStatus)];
      }
      
      const originalToIndex = targetId ? prev.findIndex(t => t.id.toString() === targetId.toString()) : -1;

      const newTasks = [...prev];
      newTasks.splice(fromIndex, 1); 
      
      if (targetId) {
        let toIndex = newTasks.findIndex(t => t.id.toString() === targetId.toString());
        
        if (originalStatus === newStatus && fromIndex < originalToIndex) {
            toIndex += 1;
        }

        if (toIndex !== -1) {
          newTasks.splice(toIndex, 0, taskToMove); 
        } else {
          newTasks.push(taskToMove);
        }
      } else {
        newTasks.push(taskToMove); 
      }
      return newTasks;
    });
  };

  const moveTaskVertical = (taskId: string, direction: 'up' | 'down') => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id.toString() === taskId.toString());
      if (idx === -1) return prev;
      
      const task = prev[idx];
      const colTasks = prev.filter(t => t.status === task.status);
      const colIdx = colTasks.findIndex(t => t.id === task.id);
      
      if (direction === 'up' && colIdx <= 0) return prev;
      if (direction === 'down' && colIdx >= colTasks.length - 1) return prev;
      
      const targetColTask = direction === 'up' ? colTasks[colIdx - 1] : colTasks[colIdx + 1];
      const targetGlobalIdx = prev.findIndex(t => t.id === targetColTask.id);
      
      const newTasks = [...prev];
      newTasks[idx] = newTasks[targetGlobalIdx];
      newTasks[targetGlobalIdx] = task;
      
      return newTasks;
    });
  };

  const toggleChecklistItem = (taskId: string, itemId: string) => {
    setTasks(prev => {
      const newTasks = prev.map(t => {
        if (t.id !== taskId) return t;
        const newChecklist = (t.checklist || []).map((c: any) => c.id === itemId ? { ...c, done: !c.done } : c);
        return { ...t, checklist: newChecklist };
      });

      const updatedTask = newTasks.find(t => t.id === taskId);
      const allDone = updatedTask.checklist && updatedTask.checklist.length > 0 && updatedTask.checklist.every((c: any) => c.done);

      if (allDone && updatedTask.status !== 'done' && updatedTask.status !== 'cancelled' && updatedTask.status !== 'formalize') {
        setTimeout(() => handleRequestMove(taskId, null, 'done'), 0);
      }

      return newTasks;
    });
  };

  // --- Drag & Drop universal (mouse + touch) via Pointer Events ---
  const [dragState, setDragState] = useState<{ id: string, title: string, x: number, y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number, y: number, id: string, title: string } | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<{ dir: number, running: boolean }>({ dir: 0, running: false });
  const DRAG_THRESHOLD = 8;

  // Auto-rolagem horizontal do quadro ao arrastar um card até a beirada (essencial no mobile)
  function stepAutoScroll() {
    const el = boardScrollRef.current;
    const a = autoScrollRef.current;
    if (!el || a.dir === 0 || !pointerStartRef.current) { a.running = false; return; }
    el.scrollLeft += a.dir * 16;
    requestAnimationFrame(stepAutoScroll);
  }

  function updateAutoScroll(clientX: number) {
    const el = boardScrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const edge = 72;
    let dir = 0;
    if (clientX < rect.left + edge) dir = -1;
    else if (clientX > rect.right - edge) dir = 1;
    autoScrollRef.current.dir = dir;
    if (dir !== 0 && !autoScrollRef.current.running) {
      autoScrollRef.current.running = true;
      requestAnimationFrame(stepAutoScroll);
    }
  }

  function findDropTarget(x: number, y: number) {
    const el = document.elementFromPoint(x, y);
    if (!el) return { taskId: null as string | null, columnId: null as string | null };
    const cardEl = (el as Element).closest('[data-task-id]');
    const colEl = (el as Element).closest('[data-column-id]');
    return {
      taskId: cardEl ? cardEl.getAttribute('data-task-id') : null,
      columnId: colEl ? colEl.getAttribute('data-column-id') : null,
    };
  }

  function handleHandlePointerDown(e: React.PointerEvent, taskId: string, title: string, isEditable: boolean) {
    if (!isEditable) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    pointerStartRef.current = { x: e.clientX, y: e.clientY, id: taskId, title };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  function handleBoardPointerMove(e: React.PointerEvent) {
    const start = pointerStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!dragState) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      setDragState({ id: start.id, title: start.title, x: e.clientX, y: e.clientY });
    } else {
      setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev);
      const target = findDropTarget(e.clientX, e.clientY);
      setDragOverId(target.taskId && target.taskId !== dragState.id ? target.taskId : null);
      updateAutoScroll(e.clientX);
    }
  }

  function handleBoardPointerUp(e: React.PointerEvent) {
    const start = pointerStartRef.current;
    if (start && dragState) {
      const target = findDropTarget(e.clientX, e.clientY);
      if (target.columnId) {
        handleRequestMove(dragState.id, target.taskId && target.taskId !== dragState.id ? target.taskId : null, target.columnId);
      }
    }
    pointerStartRef.current = null;
    autoScrollRef.current.dir = 0;
    autoScrollRef.current.running = false;
    setDragState(null);
    setDragOverId(null);
  }

  // Avatar sempre atualizado buscando do DB com fallback para o nome
  const currentUserDB = responsibles.find(r => r.id === user.id) || responsibles.find(r => r.name.toLowerCase() === user.name.toLowerCase());
  const activeAvatar = currentUserDB?.avatar || user.avatar || '';

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#09090b] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 rounded-[18px] bg-black border border-white/5 flex items-center justify-center overflow-hidden mb-6 shadow-[0_0_30px_rgba(79,70,229,0.1)] animate-modal-pop">
          <img src="/apple-icon.png" alt="Lumina" className="w-full h-full object-cover" />
        </div>
        <div className="text-indigo-400 font-bold uppercase tracking-widest animate-pulse text-xs">Sincronizando Lumina...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full bg-[#09090b] text-neutral-100 flex flex-col md:flex-row overflow-hidden font-sans" onClick={() => { setActiveTooltipCol(null); setShowProfileMenu(false); }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

        :root, body, button, input, select, textarea, [class] {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .font-display { font-family: 'Space Grotesk', 'Inter', sans-serif !important; letter-spacing: -0.01em; }
        .font-mono, .font-mono * { font-family: ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, monospace !important; }

        .kp-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .kp-scroll::-webkit-scrollbar-thumb { background: #27272a; border-radius: 6px; }
        .kp-scroll::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
        .kp-scroll::-webkit-scrollbar-track { background: transparent; }
        
        .kp-scroll { -webkit-overflow-scrolling: touch; }
        
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .fade-in { animation: fadeIn 0.2s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .fade-out { animation: fadeOut 0.2s ease-out forwards; }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

        .animate-modal-pop { animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes modalPop { 0% { opacity: 0; transform: scale(0.95) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        
        .animate-modal-out { animation: modalPopOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes modalPopOut { 0% { opacity: 1; transform: scale(1) translateY(0); } 100% { opacity: 0; transform: scale(0.97) translateY(10px); } }
        
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
        input[type="date"] { -webkit-appearance: none; appearance: none; display: flex; align-items: center; }
        input[type="date"]::-webkit-date-and-time-value { text-align: left; margin: 0; }
        input[type="date"]::-webkit-datetime-edit { padding: 0; line-height: 1; }

        .glass-panel { background: rgba(24, 24, 27, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
      `}</style>

      {/* LEFT SIDEBAR (Desktop) */}
      <div className="hidden md:flex flex-col w-[88px] bg-[#0f0f13] border-r border-[#1f1f26] shrink-0 py-6 items-center z-30 justify-between">
        <div className="flex flex-col items-center gap-8 w-full">
          <div className="w-12 h-12 rounded-[14px] bg-black flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-[0_0_20px_rgba(79,70,229,0.15)] relative group cursor-default">
            <img src="/apple-icon.png" alt="L" className="w-full h-full object-cover" />
          </div>
          
          <div className="flex flex-col items-center gap-3 w-full px-3">
             <SidebarBtn icon={<LayoutDashboard size={20} />} active={activeTab === 'board' && !isClosingModal} onClick={() => {if(activeTab !== 'board') handleCloseTab()}} tooltip="Pipeline" />
             <SidebarBtn icon={<Sun size={20} />} active={activeTab === 'today' && !isClosingModal} onClick={() => setActiveTab('today')} tooltip="Meu Dia" count={todayCount} />
             <SidebarBtn icon={<Clock size={20} />} active={activeTab === 'timer' && !isClosingModal} onClick={() => setActiveTab('timer')} tooltip="Timer" />
             <SidebarBtn icon={<CalendarDays size={20} />} active={activeTab === 'agenda' && !isClosingModal} onClick={() => setActiveTab('agenda')} tooltip="Agenda" />
             <SidebarBtn icon={<Users size={20} />} active={activeTab === 'responsibles' && !isClosingModal} onClick={() => setActiveTab('responsibles')} tooltip="Equipe" />
             <SidebarBtn icon={<Building2 size={20} />} active={activeTab === 'clients' && !isClosingModal} onClick={() => setActiveTab('clients')} tooltip="Clientes" alert={clientsNearLimit.length > 0} />
             <SidebarBtn icon={<BarChart3 size={20} />} active={activeTab === 'reports' && !isClosingModal} onClick={() => setActiveTab('reports')} tooltip="Analytics" />
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-4 relative">
           <button onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }} className="w-10 h-10 rounded-full bg-[#181a24] border border-[#2d3142] flex items-center justify-center text-indigo-400 font-bold uppercase shadow-sm overflow-hidden hover:border-indigo-500 transition-colors" title="Meu Perfil">
             <UserAvatar url={activeAvatar} name={user.name} />
           </button>
           
           {showProfileMenu && (
             <div className="absolute bottom-16 left-0 w-48 bg-[#12121a] border border-[#27272a] rounded-2xl shadow-xl z-50 py-2 flex flex-col animate-modal-pop" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setProfileModal(true); setShowProfileMenu(false); }} className="w-full text-left px-5 py-3 text-sm text-neutral-300 hover:bg-white/5 flex items-center gap-3 font-medium"><UserCog size={16}/> Editar Perfil</button>
                <div className="h-px w-full bg-[#27272a] my-1"></div>
                <button onClick={onLogout} className="w-full text-left px-5 py-3 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 font-medium"><LogOut size={16}/> Sair do Lumina</button>
             </div>
           )}
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className={`flex-1 flex flex-col min-w-0 bg-gradient-to-br from-[#09090b] to-[#0d0e15] relative pb-[72px] md:pb-0`}>
        
        {/* HEADER TOP (Desktop & Mobile) */}
        <div className="shrink-0 flex items-center justify-between p-4 md:px-8 md:py-6 relative z-20 gap-4">
          
          {/* Mobile Title & Profile */}
          <div className="md:hidden flex items-center justify-between w-full">
             <div className="flex items-center gap-3 relative min-w-0">
                <button onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }} className="w-10 h-10 shrink-0 rounded-full bg-[#181a24] border border-[#2d3142] flex items-center justify-center text-indigo-400 font-bold uppercase shadow-sm overflow-hidden hover:border-indigo-500 transition-colors">
                  <UserAvatar url={activeAvatar} name={user.name} />
                </button>
                <h1 className="font-bold text-lg text-white tracking-tight truncate">
                  Olá, {user.name.split(' ')[0]}
                </h1>
                
                {showProfileMenu && (
                   <div className="absolute top-12 left-0 mt-2 w-48 bg-[#12121a] border border-[#27272a] rounded-2xl shadow-xl z-50 py-2 flex flex-col animate-modal-pop" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setProfileModal(true); setShowProfileMenu(false); }} className="w-full text-left px-5 py-3 text-sm text-neutral-300 hover:bg-white/5 flex items-center gap-3 font-medium"><UserCog size={16}/> Editar Perfil</button>
                      <div className="h-px w-full bg-[#27272a] my-1"></div>
                      <button onClick={onLogout} className="w-full text-left px-5 py-3 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 font-medium"><LogOut size={16}/> Sair</button>
                   </div>
                )}
             </div>
             
             <div className="flex shrink-0">
                <TopWidgets />
             </div>
          </div>
          
          {/* Desktop Title */}
          <div className="hidden md:flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="font-display font-bold text-2xl text-white tracking-tight">Kanban & Analytics</h1>
              {isCloudSynced && (
                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md flex items-center gap-1">
                  <Cloud size={10} /> Sincronizado
                </span>
              )}
            </div>
            <span className="text-xs text-neutral-500 mt-1">Bem-vindo(a) de volta, {user.name}</span>
          </div>

          <div className="hidden md:block">
            <TopWidgets />
          </div>
        </div>

        {/* MODAIS Overlay */}
        {activeTab === 'today' && <OverlayModal title="Meu Dia" icon={<Sun size={20} className="text-amber-400"/>} isClosing={isClosingModal} onClose={handleCloseTab}><TodayView tasks={tasks} clients={clients} user={user} getElapsed={getElapsed} onOpen={openEditModal} onToggleTimer={toggleTimer} onComplete={(t) => handleRequestMove(t.id, null, 'done')} onOpenAgenda={() => setActiveTab('agenda')} /></OverlayModal>}
        {activeTab === 'timer' && <OverlayModal title="Cronómetro" icon={<Clock size={20} className="text-amber-500"/>} isClosing={isClosingModal} onClose={handleCloseTab}><TimerPanelContent tasks={filteredTasks} getElapsed={getElapsed} onToggleTimer={toggleTimer} user={user} /></OverlayModal>}
        {activeTab === 'responsibles' && <OverlayModal title="Equipe (Contas)" icon={<Users size={20} className="text-indigo-400"/>} isClosing={isClosingModal} onClose={handleCloseTab}><ResponsiblesPanelContent responsibles={responsibles} tasks={tasks} user={user} /></OverlayModal>}
        {activeTab === 'clients' && <OverlayModal title="Gestão de Clientes" icon={<Building2 size={20} className="text-purple-400"/>} isClosing={isClosingModal} onClose={handleCloseTab}><ClientsPanelContent clients={visibleClients} setClients={setClients} tasks={tasks} setTasks={setTasks} user={user} getElapsed={getElapsed} /></OverlayModal>}
        {activeTab === 'reports' && <AnalyticsModal isClosing={isClosingModal} onClose={handleCloseTab} tasks={filteredTasks} clients={visibleClients} responsibles={responsibles} getElapsed={getElapsed} globalLookerUrl={globalLookerUrl} setGlobalLookerUrl={setGlobalLookerUrl} user={user} />}
        {activeTab === 'agenda' && <OverlayModal title="Agenda" icon={<CalendarDays size={20} className="text-teal-400"/>} isClosing={isClosingModal} onClose={handleCloseTab} fullWidth><CalendarView tasks={visibleTasks} setTasks={setTasks} clients={clients} handleRequestMove={handleRequestMove} user={user} onCreateCard={(prefill: any) => setModal({ mode: 'add', form: { ...emptyForm, ...prefill } })} onDeleteTask={deleteTaskById} /></OverlayModal>}

        {/* BOARD VIEW */}
        <div className={`flex-1 flex flex-col min-h-0 ${activeTab !== 'board' ? 'hidden md:flex opacity-30 pointer-events-none transition-opacity duration-300' : 'fade-in'}`}>
          
          <div className="shrink-0 px-4 md:px-8 pb-3 flex flex-col gap-3">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                
                {/* Linha Principal (Filtro Button, Progresso e Fechar Semana) */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full">
                   <button 
                     onClick={(e) => { e.stopPropagation(); setShowFilters(!showFilters); }} 
                     className={`h-11 w-11 lg:w-auto px-0 lg:px-4 flex items-center justify-center gap-2 rounded-xl transition-all shadow-sm shrink-0 border font-bold uppercase tracking-widest text-[10px] ${showFilters ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'glass-panel text-neutral-400 border-white/5 hover:text-white'}`}
                   >
                     <Filter size={16} /> <span className="hidden lg:inline">Filtros</span>
                   </button>

                   <button
                     onClick={() => setSearchOpen(true)}
                     title="Buscar (Ctrl/Cmd + K)"
                     className="h-11 flex-1 lg:flex-none lg:w-auto px-3 lg:px-4 flex items-center justify-center gap-2 rounded-xl transition-all shadow-sm border font-bold uppercase tracking-widest text-[10px] glass-panel text-neutral-400 border-white/5 hover:text-white"
                   >
                     <Search size={16} /> <span>Buscar</span>
                   </button>

                   <div className="glass-panel h-11 w-full order-last sm:w-auto sm:flex-1 sm:order-none flex items-center px-4 rounded-xl gap-3 shadow-sm min-w-0">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Progresso</span>
                     <div className="flex-1 h-1.5 rounded-full bg-black/50 overflow-hidden border border-white/5">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${overallProgress}%` }} />
                     </div>
                     <span className="text-xs font-bold text-white shrink-0">{overallProgress}%</span>
                   </div>

                   {todayCount > 0 && (
                     <button onClick={() => setActiveTab('today')} className="h-11 px-3 sm:px-4 flex items-center justify-center gap-2 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all shrink-0 bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 shadow-[0_0_15px_rgba(239,68,68,0.15)]" title="Ver no Meu Dia">
                       <AlertTriangle size={15} /> <span className="whitespace-nowrap">{todayCount} a resolver</span>
                     </button>
                   )}

                   {tasksForClosure.length > 0 && (
                      <button onClick={() => setClosureModal(true)} title="Fechar Semana" className="h-11 w-11 sm:w-auto px-0 sm:px-6 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] shrink-0">
                        <Mail size={16}/> <span className="whitespace-nowrap hidden sm:inline">Fechar Semana</span>
                      </button>
                    )}
                </div>
             </div>

             {/* Filtros Container Expansível */}
             {showFilters && (
               <div className="w-full animate-fade-in" onClick={e => e.stopPropagation()}>
                  <div className="glass-panel w-full p-4 sm:p-5 rounded-2xl flex flex-col gap-4 shadow-sm border border-indigo-500/20">

                    {/* Seletores (Cliente / Responsável / Prioridade) */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                       <FilterSelect value={filterClient} onChange={setFilterClient} options={visibleClients} defaultLabel="Todos Clientes" />
                       {user.isAdmin && <>
                         <div className="hidden sm:block w-px h-4 bg-white/10"></div>
                         <FilterSelect value={filterResp} onChange={setFilterResp} options={responsibles} defaultLabel="Todos Responsáveis" />
                       </>}
                       <div className="hidden sm:block w-px h-4 bg-white/10"></div>
                       <FilterSelect value={filterPriority} onChange={setFilterPriority} options={[{id: 'Baixa', name: 'Baixa'}, {id: 'Média', name: 'Média'}, {id: 'Alta', name: 'Alta'}]} defaultLabel="Prioridades" />
                    </div>

                    <div className="h-px w-full bg-white/5"></div>

                    {/* Intervalos de data */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       <div className="rounded-xl border border-white/5 bg-black/20 p-3.5 flex flex-col gap-2.5">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300 flex items-center gap-1.5"><Clock size={12}/> Criado entre</span>
                          <div className="grid grid-cols-2 gap-2">
                             <div className="flex flex-col gap-1">
                                <label className="text-[9px] uppercase font-bold text-neutral-500 ml-0.5">De</label>
                                <input type="date" value={filterCreatedStart} onChange={e => setFilterCreatedStart(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-lg px-3 h-10 text-xs text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
                             </div>
                             <div className="flex flex-col gap-1">
                                <label className="text-[9px] uppercase font-bold text-neutral-500 ml-0.5">Até</label>
                                <input type="date" value={filterCreatedEnd} onChange={e => setFilterCreatedEnd(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-lg px-3 h-10 text-xs text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
                             </div>
                          </div>
                       </div>

                       <div className="rounded-xl border border-white/5 bg-black/20 p-3.5 flex flex-col gap-2.5">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-300 flex items-center gap-1.5"><CheckCircle2 size={12}/> Concluído entre</span>
                          <div className="grid grid-cols-2 gap-2">
                             <div className="flex flex-col gap-1">
                                <label className="text-[9px] uppercase font-bold text-neutral-500 ml-0.5">De</label>
                                <input type="date" value={filterCompletedStart} onChange={e => setFilterCompletedStart(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-lg px-3 h-10 text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]" />
                             </div>
                             <div className="flex flex-col gap-1">
                                <label className="text-[9px] uppercase font-bold text-neutral-500 ml-0.5">Até</label>
                                <input type="date" value={filterCompletedEnd} onChange={e => setFilterCompletedEnd(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-lg px-3 h-10 text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]" />
                             </div>
                          </div>
                       </div>
                    </div>

                    {hasAnyFilter && (
                       <button onClick={resetFilters} className="self-end flex items-center justify-center gap-1.5 px-4 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-bold uppercase tracking-widest transition-colors">
                         <RotateCcw size={12}/> Resetar filtros
                       </button>
                    )}
                  </div>
               </div>
             )}
          </div>

          {/* Quadro Kanban */}
          <div
            className="flex-1 relative min-h-0"
            onPointerMove={handleBoardPointerMove}
            onPointerUp={handleBoardPointerUp}
            onPointerCancel={handleBoardPointerUp}
          >
            <div ref={boardScrollRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden px-4 md:px-8 pb-4 md:pb-8 kp-scroll">
              <div className="flex gap-4 sm:gap-5 h-full min-w-max items-stretch">
                {COLUMNS.map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.status === col.id);
                  return (
                    <div key={col.id} data-column-id={col.id} className="w-[88vw] max-w-[340px] sm:w-[340px] shrink-0 glass-panel rounded-2xl flex flex-col h-full shadow-sm relative">
                      
                      {/* Header da Coluna */}
                      <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/5 shrink-0">
                        <div 
                          className="flex items-center gap-2 relative group cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setActiveTooltipCol(activeTooltipCol === col.id ? null : col.id); }}
                        >
                          <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${col.dot} shadow-[0_0_8px_currentColor]`} />
                          <h2 className="text-xs font-bold uppercase tracking-widest text-white">{col.name}</h2>
                          <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 transition-colors ml-0.5" />
                          
                          <div className={`absolute left-0 top-full mt-2 w-56 sm:w-64 p-4 bg-[#1c1d26] border border-[#27272a] rounded-xl shadow-2xl transition-all z-[60] normal-case tracking-normal cursor-default ${activeTooltipCol === col.id ? 'opacity-100 visible' : 'opacity-0 invisible lg:group-hover:opacity-100 lg:group-hover:visible'}`} onClick={e => e.stopPropagation()}>
                            <div className="text-[11px] text-neutral-300 leading-relaxed font-normal">{col.help}</div>
                          </div>
                        </div>
                        <span className="text-[10px] px-2.5 py-1 rounded-lg bg-black/40 text-neutral-400 font-bold border border-white/5">{colTasks.length}</span>
                      </div>
                      
                      {/* Botão de Adicionar */}
                      <div className="px-3 pt-3 shrink-0">
                        <button onClick={() => openAddModal(col.id)} className={`w-full flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest rounded-xl py-3 transition-all border border-dashed ${col.btn}`}>
                          <Plus size={14} /> Nova Demanda
                        </button>
                      </div>
                      
                      {/* Área de Cartões */}     
                      <div className="px-3 pb-3 flex-1 overflow-y-auto overflow-x-hidden kp-scroll flex flex-col gap-3 mt-3 min-h-0">
                        {colTasks.length === 0 && (
                          <div className="text-center text-[10px] font-medium uppercase tracking-widest text-neutral-600 py-10 border border-dashed border-white/5 rounded-xl mx-2">
                            Solte itens aqui
                          </div>
                        )}
                        {colTasks.map((t) => {
                          const tChecklist = Array.isArray(t.checklist) ? t.checklist : [];
                          const total = tChecklist.length;
                          const done = tChecklist.filter((c: any) => c.done).length;
                          const pct = total ? Math.round((done / total) * 100) : 0;
                          const client = clients.find(c => c.id === t.clientId);
                          const resp = responsibles.find(r => r.id === t.responsibleId);
                          const prStyle = PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.Média;
                          const isDoneOrCancelled = t.status === "done" || t.status === "cancelled" || t.status === "formalize";
                          const isEditable = canEditTask(t.responsibleId);
                          
                          const todayMs = new Date().setHours(0, 0, 0, 0);
                          const startMs = parseDateLocal(t.startDate);
                          const dueMs = parseDateLocal(t.dueDate);
                          
                          let alertBadge = null;
                          let alertAccent: string | null = null;
                          if (!isDoneOrCancelled) {
                            if ((dueMs !== null && dueMs < todayMs) || (startMs !== null && startMs < todayMs && ['backlog', 'todo'].includes(t.status))) {
                              alertBadge = <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-bold"><AlertTriangle size={10}/> Atrasado</span>;
                              alertAccent = 'red';
                            } else if (dueMs === todayMs) {
                              alertBadge = <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold"><Clock size={10}/> Entregar Hoje</span>;
                              alertAccent = 'orange';
                            } else if (startMs === todayMs && ['backlog', 'todo'].includes(t.status)) {
                              alertBadge = <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold"><Play size={10}/> Iniciar Hoje</span>;
                              alertAccent = 'blue';
                            }
                          }
                          const alertRing = alertAccent === 'red' ? 'ring-1 ring-red-500/60 shadow-[0_0_18px_rgba(239,68,68,0.2)]'
                            : alertAccent === 'orange' ? 'ring-1 ring-orange-500/60 shadow-[0_0_18px_rgba(249,115,22,0.2)]'
                            : alertAccent === 'blue' ? 'ring-1 ring-blue-500/60 shadow-[0_0_18px_rgba(59,130,246,0.2)]' : '';
                          const alertBar = alertAccent === 'red' ? 'bg-red-500' : alertAccent === 'orange' ? 'bg-orange-500' : alertAccent === 'blue' ? 'bg-blue-500' : '';

                          return (
                            <div
                              key={t.id}
                              data-task-id={t.id}
                              style={{ touchAction: 'pan-y' }}
                              className={`rounded-2xl bg-[#1c1d26] border p-4 transition-all group relative ${isDoneOrCancelled ? 'opacity-60' : ''} ${!isEditable ? 'opacity-70 cursor-not-allowed' : 'hover:border-[#3f3f46] shadow-md'} ${dragOverId === t.id ? 'border-indigo-500 shadow-[0_-2px_15px_rgba(99,102,241,0.3)]' : 'border-[#2d3142]'} ${dragState?.id === t.id ? 'opacity-40' : ''} ${alertRing}`}
                            >
                              {alertBar && <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${alertBar}`} />}
                              
                              {/* Badges do Cartão */}
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {client && <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-white/5 text-neutral-300 font-bold max-w-[140px] truncate border border-white/5"><Building2 size={10} /> {client.name}</span>}
                                  <span className={`flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md border font-bold ${prStyle.bg} ${prStyle.text} ${prStyle.border}`}>
                                    <span className={`w-1 h-1 rounded-full ${prStyle.dot}`} /> {t.priority}
                                  </span>
                                  {t.isMeeting && t.scheduledStart && parseDateLocal(t.scheduledStart.slice(0, 10)) >= todayMs && <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold" title="Reunião agendada"><CalendarDays size={10} /> Reunião</span>}
                                  {t.templateId && <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold" title="Gerado por uma recorrência da Agenda"><RotateCcw size={10} /> Recorrente</span>}
                                  {alertBadge}
                                </div>
                                
                                {isEditable ? (
                                  <div className="flex items-center gap-1">
                                    {isMobile && (
                                       <div className="flex flex-col gap-1 mr-1">
                                          <button onClick={(e) => { e.stopPropagation(); moveTaskVertical(t.id, 'up'); }} className="p-1 bg-white/5 rounded text-neutral-400 active:bg-white/10 active:text-white"><ChevronUp size={12}/></button>
                                          <button onClick={(e) => { e.stopPropagation(); moveTaskVertical(t.id, 'down'); }} className="p-1 bg-white/5 rounded text-neutral-400 active:bg-white/10 active:text-white"><ChevronDown size={12}/></button>
                                       </div>
                                    )}
                                    <div
                                      onPointerDown={(e) => handleHandlePointerDown(e, t.id, t.title, isEditable)}
                                      className="shrink-0 flex items-center justify-center text-neutral-500 cursor-grab active:cursor-grabbing touch-none rounded-lg p-2.5 -m-2 md:p-1 md:-m-1 active:bg-white/10 active:text-white"
                                      title="Arrastar"
                                    >
                                      <GripVertical size={18} className="pointer-events-none" />
                                    </div>
                                  </div>
                                ) : (
                                  <Lock size={12} className="text-neutral-600 shrink-0 block" />
                                )}
                              </div>

                              <div className="mb-3">
                                <h3 className={`font-display text-[13px] font-bold leading-relaxed mb-1.5 ${isDoneOrCancelled ? 'text-neutral-500 line-through' : 'text-white'}`}>{t.title}</h3>
                                {t.description && <div className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">{t.description}</div>}
                              </div>

                              {t.status === 'waiting' && t.waitingFor && (
                                <div className="flex items-center gap-1.5 text-[10px] mb-4 font-bold uppercase tracking-tight w-fit bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-lg text-pink-400"><Clock size={12} /> Pendente: {t.waitingFor}</div>
                              )}

                              {/* Checklist Detalhado Visível no Cartão */}
                              {total > 0 && (
                                <div className="mb-3">
                                  <div className="h-1 rounded-full bg-black/40 overflow-hidden mb-2 border border-white/5">
                                    <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.3)]' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    {tChecklist.map((c: any) => (
                                      <div key={c.id} className="flex items-start gap-2 text-[11px] text-neutral-400">
                                        <button onClick={(e) => { e.stopPropagation(); toggleChecklistItem(t.id, c.id); }} disabled={!isEditable} className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${c.done ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-black/30 border-white/10 hover:border-white/20 text-transparent'} transition-colors`}>
                                           <Check size={10} strokeWidth={3} className={c.done ? 'opacity-100' : 'opacity-0'} />
                                        </button>
                                        <span className={`leading-snug ${c.done ? "line-through text-neutral-500" : "text-neutral-300"}`}>{c.text || ''}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Info de Rodapé do Cartão com Botões Integrados */}
                              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                                 <div className="flex items-center gap-2">
                                    {resp && (
                                       <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 uppercase overflow-hidden" title={`Responsável: ${resp.name}`}>
                                          <UserAvatar url={resp.avatar} name={resp.name} />
                                       </div>
                                    )}
                                    
                                    {(t.timerRunning || t.timerElapsed > 0) && !isDoneOrCancelled && (
                                      <div className="flex items-center gap-1 text-[10px] font-mono font-bold bg-black/30 border border-white/5 px-2 py-1 rounded-md text-neutral-400">
                                        <Clock size={10} className={t.timerRunning ? "text-amber-500 animate-pulse" : "text-neutral-500"} /> <LiveElapsed task={t} getElapsed={getElapsed} />
                                      </div>
                                    )}

                                    {isDoneOrCancelled && (t.timerElapsed > 0 || t.durationMin > 0) && (
                                       <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                                         <CheckCircle2 size={10} /> {formatTime(t.timerElapsed || (t.durationMin * 60))}
                                       </div>
                                    )}
                                 </div>

                                 <div className="flex items-center gap-1">
                                    {isEditable && (
                                      <>
                                        <button onClick={() => openEditModal(t)} className="p-1.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-lg transition-colors border border-transparent hover:border-white/10" title="Editar"><Pencil size={12}/></button>
                                        {!isDoneOrCancelled && <button onClick={() => toggleTimer(t.id)} className={`p-1.5 rounded-lg transition-colors border ${t.timerRunning ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-neutral-400 bg-white/5 hover:text-white hover:bg-white/10 border-transparent hover:border-white/10'}`} title={t.timerRunning ? "Pausar" : "Iniciar Timer"}>{t.timerRunning ? <Pause size={12}/> : <Play size={12}/>}</button>}
                                      </>
                                    )}
                                    {isEditable && t.status !== "cancelled" && isDoneOrCancelled && (
                                      <button onClick={() => handleRequestMove(t.id, null, 'cancelled')} className="p-1.5 bg-red-500/5 hover:bg-red-500/10 text-red-500/50 hover:text-red-400 rounded-lg transition-colors" title="Cancelar"><X size={12}/></button>
                                    )}
                                    {isEditable && t.status === "cancelled" && (
                                      <>
                                        <button onClick={() => handleRequestMove(t.id, null, 'backlog')} className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors" title="Restaurar"><RotateCcw size={12}/></button>
                                        <button onClick={() => setConfirmDelete(t.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Apagar Definitivamente"><Trash2 size={12}/></button>
                                      </>
                                    )}
                                 </div>
                              </div>
                              
                              {/* Datas Discretas */}
                              <div className="mt-3 flex flex-col gap-0.5 text-[9px] text-neutral-600 font-mono uppercase tracking-widest text-center">
                                {t.createdAt && <div>Criado em: {t.createdAt.split('-').reverse().join('/')}</div>}
                                {t.completedAt && <div className="text-emerald-500/60">Concluído em: {t.completedAt.split('-').reverse().join('/')}</div>}
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fantasma do card durante o arrasto (mouse ou toque) */}
      {dragState && (
        <div
          className="fixed z-[200] pointer-events-none px-4 py-3 rounded-xl bg-[#1c1d26] border border-indigo-500 shadow-2xl text-xs font-bold text-white max-w-[260px] truncate"
          style={{ left: dragState.x + 12, top: dragState.y + 12 }}
        >
          {dragState.title}
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around pt-2.5 px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-[#12121a]/95 backdrop-blur-md border-t border-[#27272a] z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         <MobileNavBtn icon={<LayoutDashboard size={20} />} label="Board" active={activeTab === 'board' && !isClosingModal} onClick={() => {if(activeTab !== 'board') handleCloseTab()}} />
         <MobileNavBtn icon={<Sun size={20} />} label="Hoje" active={activeTab === 'today' && !isClosingModal} onClick={() => setActiveTab('today')} count={todayCount} />
         <MobileNavBtn icon={<Clock size={20} />} label="Timer" active={activeTab === 'timer' && !isClosingModal} onClick={() => setActiveTab('timer')} />
         <MobileNavBtn icon={<CalendarDays size={20} />} label="Agenda" active={activeTab === 'agenda' && !isClosingModal} onClick={() => setActiveTab('agenda')} />
         <MobileNavBtn icon={<Users size={20} />} label="Equipe" active={activeTab === 'responsibles' && !isClosingModal} onClick={() => setActiveTab('responsibles')} />
         <MobileNavBtn icon={<Building2 size={20} />} label="Clientes" active={activeTab === 'clients' && !isClosingModal} onClick={() => setActiveTab('clients')} alert={clientsNearLimit.length > 0} />
         <MobileNavBtn icon={<BarChart3 size={20} />} label="Relatórios" active={activeTab === 'reports' && !isClosingModal} onClick={() => setActiveTab('reports')} />
      </div>

      {/* Pop-up: Perfil do Utilizador */}
      {profileModal && <ProfileModal user={user} responsibles={responsibles} onClose={() => setProfileModal(false)} onUpdate={(u: any) => { setUser(u); }} />}

      {/* Pop-up: Aguardando Retorno */}
      {waitingPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 pt-4 pb-24 sm:p-4 z-[70] fade-in" onClick={() => setWaitingPrompt(null)}>
          <div className="w-full max-w-sm rounded-[32px] bg-[#12121a] border border-[#27272a] p-8 shadow-2xl relative animate-modal-pop" onClick={e => e.stopPropagation()}>
            <button onClick={() => setWaitingPrompt(null)} className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors"><X size={20} /></button>
            <div className="flex items-center gap-3 mb-6 text-pink-500">
              <div className="p-3 bg-pink-500/10 rounded-2xl shadow-inner"><HelpCircle size={24} /></div>
              <h3 className="font-bold text-lg">Pendente de quem?</h3>
            </div>
            <p className="text-sm text-neutral-400 mb-8 leading-relaxed">O card foi movido para Aguardando. Selecione o bloqueador da tarefa:</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setTasks((prev: any) => prev.map((t: any) => t.id === waitingPrompt ? { ...t, waitingFor: 'Cliente' } : t)); setWaitingPrompt(null); }} className="w-full py-4 rounded-2xl border border-[#2a2d3d] hover:border-[#3f4359] hover:bg-white/5 text-white font-bold transition-all text-sm">Responsabilidade do Cliente</button>
              <button onClick={() => { setTasks((prev: any) => prev.map((t: any) => t.id === waitingPrompt ? { ...t, waitingFor: 'Time Interno' } : t)); setWaitingPrompt(null); }} className="w-full py-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold transition-all text-sm shadow-lg shadow-pink-600/10">Nossa Responsabilidade</button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up: Conclusão de Demanda */}
      {donePrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 pt-4 pb-24 sm:p-4 z-[90] fade-in" onClick={() => { setDonePrompt(null); setValidationError(null); }}>
          <div className="w-full max-w-sm rounded-[32px] bg-[#12121a] border border-[#27272a] shadow-2xl relative overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
            <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-[#27272a] flex items-center gap-3 text-emerald-500">
              <CheckCircle2 size={24} />
              <h3 className="font-display font-bold text-xl text-white tracking-tight">Finalizar Demanda</h3>
            </div>
            <div className="p-5 sm:p-8 flex flex-col gap-5">
              {validationError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-pulse"><AlertTriangle size={14} className="shrink-0" /> {Array.isArray(validationError) ? validationError.join(", ") : String(validationError)}</div>}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Data Real de Entrega *</label>
                <input type="date" value={donePrompt.date || ''} onChange={e => { setDonePrompt({...donePrompt, date: e.target.value}); setValidationError(null); }} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-4 text-sm text-white outline-none focus:border-emerald-500 [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Tempo Total Gasto (Minutos) *</label>
                <input type="number" value={donePrompt.durationMin ?? ''} onChange={e => { setDonePrompt({...donePrompt, durationMin: e.target.value}); setValidationError(null); }} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-4 text-sm text-white outline-none focus:border-emerald-500" placeholder="Ex: 45" />
              </div>
            </div>
            <div className="px-5 sm:px-8 py-5 border-t border-[#27272a] bg-black/20 flex items-center justify-end gap-3">
              <button onClick={() => { setDonePrompt(null); setValidationError(null); }} className="text-sm px-5 py-3 rounded-xl text-neutral-500 hover:text-white transition-colors font-bold">Cancelar</button>
              <button onClick={confirmDoneMove} className="text-sm px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg shadow-emerald-600/20">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Banco de Horas */}
      {pendingLimitAlerts.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 pt-4 pb-24 sm:p-4 z-[100] fade-in" onClick={() => setDismissedLimits(new Set([...dismissedLimits, ...pendingLimitAlerts.map(c => c.id)]))}>
          <div className="w-full max-w-md rounded-[32px] bg-[#12121a] border border-red-500/30 flex flex-col shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
            <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-[#27272a] flex items-center gap-3">
              <div className="p-3 bg-red-500/10 rounded-2xl shadow-inner text-red-500"><AlertTriangle size={24} /></div>
              <h3 className="font-display font-bold text-xl text-white tracking-tight">Alerta de Limite</h3>
            </div>
            <div className="p-5 sm:p-8 flex flex-col gap-4">
              <p className="text-sm text-neutral-400">Os seguintes clientes esgotaram as horas mensais ou estão próximos do fim:</p>
              <div className="flex flex-col gap-3 max-h-40 overflow-y-auto kp-scroll pr-2">
                {pendingLimitAlerts.map(c => {
                  const cTasks = tasks.filter((t: any) => t.clientId === c.id);
                  const hours = cTasks.reduce((acc: number, t: any) => acc + (getElapsed(t) / 3600), 0);
                  const remaining = (c.contractedHours || 0) - hours;
                  return (
                    <div key={c.id} className="flex justify-between items-center bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
                      <span className="text-sm font-bold text-white">{c.name}</span>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-md ${remaining < 0 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>{remaining.toFixed(1)}h Restam</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-500 italic">Formalize o aviso na aba Clientes para continuar.</p>
            </div>
            <div className="px-5 sm:px-8 py-5 border-t border-[#27272a] bg-black/20 flex justify-end">
              <button onClick={() => setDismissedLimits((prev: any) => new Set([...prev, ...pendingLimitAlerts.map(c => c.id)]))} className="w-full sm:w-auto text-sm px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-600/20">Ciente do Aviso</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar Exclusão de Cartão */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 pt-4 pb-24 sm:p-4 z-[110] fade-in" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-[32px] bg-[#12121a] border border-[#27272a] p-5 sm:p-8 shadow-2xl relative animate-modal-pop" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <div className="p-3 bg-red-500/10 rounded-2xl shadow-inner"><Trash2 size={24} /></div>
              <h3 className="font-bold text-xl tracking-tight">Apagar Card</h3>
            </div>
            <p className="text-sm text-neutral-400 mb-8 leading-relaxed">
              Deseja remover esta demanda definitivamente do sistema? A ação não pode ser desfeita.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button onClick={() => setConfirmDelete(null)} className="w-full sm:flex-1 py-3.5 sm:py-3 rounded-2xl border border-[#27272a] hover:bg-white/5 text-white font-bold transition-all text-sm">Cancelar</button>
              <button onClick={async () => {
                  const idToDelete = confirmDelete;
                  setConfirmDelete(null);
                  await deleteTaskById(idToDelete as string);
                }} 
                className="w-full sm:flex-1 py-3.5 sm:py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all text-sm shadow-lg shadow-red-600/10"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta "hora de começar" */}
      {dueAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[96] w-[92%] max-w-md rounded-2xl bg-[#12121a] border border-teal-500/30 shadow-2xl overflow-hidden animate-modal-pop">
          <div className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 shrink-0"><Clock size={18} className="text-teal-400" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-0.5">Hora de começar</div>
              <div className="text-sm font-bold text-white leading-snug font-display">{dueAlert.title}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                {(clients.find((c: any) => c.id === dueAlert.clientId)?.name || '')}{clients.find((c: any) => c.id === dueAlert.clientId)?.name ? ' · ' : ''}{(() => { const s = new Date(dueAlert.scheduledStart); return `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`; })()}
              </div>
            </div>
            <button onClick={() => setDueAlert(null)} className="p-1.5 rounded-lg text-neutral-500 hover:text-white transition-colors shrink-0"><X size={16} /></button>
          </div>
          <div className="px-4 pb-4 flex items-center gap-2">
            <button onClick={() => { handleRequestMove(dueAlert.id, null, 'inprogress'); if (!dueAlert.timerRunning) toggleTimer(dueAlert.id); setDueAlert(null); }} className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"><Play size={14} /> Iniciar agora</button>
            <button onClick={() => { openEditModal(dueAlert); setDueAlert(null); }} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">Abrir</button>
          </div>
          {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
            <button onClick={() => { try { Notification.requestPermission(); } catch {} }} className="w-full py-2.5 bg-white/[0.03] border-t border-white/5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-teal-400 transition-colors">🔔 Ativar avisos no navegador</button>
          )}
        </div>
      )}

      {/* Botão flutuante de Captura Rápida */}
      <button onClick={() => setQuickAdd(true)} className="fixed bottom-[88px] right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-[0_8px_30px_rgba(79,70,229,0.4)] transition-all active:scale-95" title="Captura rápida">
        <Plus size={24} />
      </button>
      {quickAdd && <QuickAddModal clients={visibleClients} onClose={() => setQuickAdd(false)} onCreate={(data: any) => setTasks((prev: any) => [...prev, { id: nextId(), title: upper(data.title), description: '', priority: data.priority, durationMin: 0, clientId: data.clientId, responsibleId: user.id, startDate: '', dueDate: '', status: 'backlog', waitingFor: '', checklist: [], timerRunning: false, timerStart: null, timerElapsed: 0, createdAt: getBrasiliaDate(), completedAt: '', history: [histEntry('created')] }])} />}
      {searchOpen && <SearchModal tasks={visibleTasks} clients={clients} onOpen={openEditModal} onClose={() => setSearchOpen(false)} />}

      {/* Modais de Popups Principais */}
      {closureModal && <ClosureModal tasks={tasksForClosure} clients={clients} responsibles={responsibles} onClose={() => setClosureModal(false)} onFormalize={(clientId: string | null) => { if (clientId) { setTasks((prev: any) => prev.map((t: any) => (t.status === 'done' && t.clientId === clientId) ? { ...t, status: 'formalize' } : t)); } else { setTasks((prev: any) => prev.map((t: any) => t.status === 'done' ? { ...t, status: 'formalize' } : t)); setClosureModal(false); } }} />}
      {modal && <TaskModal modal={modal} setModal={setModal} clients={visibleClients} responsibles={responsibles} closeModal={closeModal} saveModal={saveModal} validationError={validationError} setValidationError={setValidationError} user={user} />}
    </div>
  );
}

// --- Sub-Componentes UI Reutilizáveis (Lumina 2.0 Estilo) ---

function ProfileModal({ user, responsibles, onClose, onUpdate }: any) {
  const currentUserDB = responsibles.find((r: any) => r.id === user.id) || responsibles.find((r: any) => r.name.toLowerCase() === user.name.toLowerCase());
  const activeAvatar = currentUserDB?.avatar || user.avatar || '';

  const [password, setPassword] = useState('');
  const [avatarInput, setAvatarInput] = useState(activeAvatar);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSave = async () => {
    setIsLoading(true);
    setFeedback('');
    let updatedUser = { ...user };
    const supa = (window as any).supabaseClient;

    try {
      if (avatarInput.trim() !== activeAvatar) {
        await supa.from('responsibles').update({ avatar: avatarInput.trim() }).eq('id', currentUserDB?.id || user.id);
        updatedUser.avatar = avatarInput.trim();
      }

      if (password.trim()) {
        if (password.trim().length < 6) {
          setFeedback("A senha deve ter no mínimo 6 caracteres.");
          setIsLoading(false);
          return;
        }
        // Senha trocada via Supabase Auth — nunca mais gravada em texto puro na tabela.
        const { error } = await supa.auth.updateUser({ password: password.trim() });
        if (error) throw error;
      }

      onUpdate(updatedUser);
      onClose();
    } catch (e) {
      console.error("Erro ao alterar dados", e);
      setFeedback("Não foi possível salvar. Tente novamente.");
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center px-4 pt-4 pb-24 sm:p-4 z-[90] fade-in" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[32px] bg-[#12121a] border border-[#27272a] shadow-2xl relative overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
        <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-[#27272a] bg-[#0f0f13] flex items-center justify-between">
          <div className="flex items-center gap-3">
             <UserCog size={20} className="text-indigo-400" />
             <h3 className="font-display font-bold text-xl text-white tracking-tight">Meu Perfil</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-neutral-500 hover:text-white transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-5 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4 mb-2">
             <div className="w-24 h-24 rounded-[20px] bg-black border border-[#27272a] flex items-center justify-center text-3xl font-bold text-indigo-400 shadow-xl overflow-hidden relative group">
                <UserAvatar url={avatarInput} name={user.name} />
             </div>
             <p className="text-sm font-bold text-white">{user.name}</p>
          </div>

          {feedback && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" /> {feedback}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">URL da Fotografia de Perfil</label>
            <input value={avatarInput} onChange={e => setAvatarInput(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors" placeholder="https://site.com/sua-foto.jpg" />
            <p className="text-[10px] text-neutral-600 mt-1.5 ml-1 leading-relaxed">Cole o link (URL) direto de uma imagem online. Ele será guardado no banco de dados para acesso em qualquer dispositivo.</p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Nova Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors" placeholder="Deixe em branco para manter a atual" />
          </div>
        </div>
        
        <div className="px-5 sm:px-8 py-5 border-t border-[#27272a] bg-[#0f0f13] flex items-center justify-end">
          <button onClick={handleSave} disabled={isLoading} className="w-full sm:w-auto text-xs font-bold uppercase tracking-widest px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]">
            {isLoading ? "A Salvar..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarBtn({ icon, active, onClick, tooltip, alert, count }: any) {
  return (
    <button onClick={onClick} className={`w-12 h-12 rounded-[14px] flex items-center justify-center transition-all relative group ${active ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-transparent text-neutral-500 hover:bg-white/5 hover:text-white'}`}>
      {icon}
      {count > 0 ? (
        <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.8)] border border-[#0a0a0f]">{count}</span>
      ) : alert && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />}
      <span className="absolute left-16 bg-black text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-md opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none z-50 border border-white/10 whitespace-nowrap shadow-xl">
        {tooltip}
      </span>
    </button>
  );
}

function MobileNavBtn({ icon, label, active, onClick, alert, count }: any) {
  return (
    <button onClick={onClick} className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all relative gap-1.5 ${active ? 'text-indigo-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
      {icon}
      <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest truncate max-w-full">{label}</span>
      {count > 0 ? (
        <span className="absolute top-0 right-[22%] min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.8)]">{count}</span>
      ) : alert && <span className="absolute top-1 right-[25%] w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />}
    </button>
  );
}

function OverlayModal({ title, icon, onClose, children, fullWidth, isClosing }: any) {
  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center px-3 pt-3 pb-24 sm:p-4 z-[60] ${isClosing ? 'fade-out' : 'fade-in'}`} onClick={onClose}>
      <div className={`bg-[#12121a] border border-[#27272a] rounded-3xl sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden w-full ${isClosing ? 'animate-modal-out' : 'animate-modal-pop'} ${fullWidth ? 'max-w-7xl h-[80dvh] sm:h-[88dvh]' : 'max-w-4xl max-h-[80dvh] sm:max-h-[85dvh]'}`} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-[#27272a] flex items-center justify-between bg-[#0f0f13]">
           <div className="flex items-center gap-4">
             <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 hidden sm:block">{icon}</div>
             <h2 className="font-display text-xl font-bold text-white tracking-tight">{title}</h2>
           </div>
           <button onClick={onClose} className="p-2.5 rounded-xl text-neutral-500 hover:bg-white/5 hover:text-white transition-colors shrink-0"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto kp-scroll p-5 sm:p-8 bg-[#09090b] flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}

function FilterSelect({ value, onChange, options, defaultLabel }: any) {
  return (
    <div className="relative flex items-center w-full lg:w-auto shrink-0 flex-1 lg:flex-none bg-[#12121a] lg:bg-transparent rounded-xl lg:rounded-none">
      <select value={value || 'all'} onChange={(e) => onChange(e.target.value)} className="appearance-none w-full lg:w-auto text-[11px] font-bold bg-transparent border border-[#27272a] lg:border-none pl-4 pr-10 py-3 lg:p-0 lg:pr-6 rounded-xl lg:rounded-none text-neutral-300 outline-none cursor-pointer transition-all hover:text-white">
        <option value="all" className="bg-[#1c1d26] text-white">{defaultLabel}</option>
        {options.map((o: any) => (<option key={o.id} value={o.id} className="bg-[#1c1d26] text-white">{o.name}</option>))}
      </select>
      <ChevronDown size={14} className="absolute right-4 lg:right-0 text-neutral-600 pointer-events-none" />
    </div>
  );
}

function CustomSelect({ label, value, onChange, options, hasError, required }: any) {
  return (
    <div className="w-full">
      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block ml-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <div className="relative flex items-center">
        <select value={value || ''} onChange={onChange} className={`appearance-none w-full bg-[#09090b] border rounded-xl pl-4 pr-10 py-4 sm:py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-sm ${hasError ? 'border-red-500' : 'border-[#27272a]'}`}>
          {options}
        </select>
        <ChevronDown size={16} className="absolute right-4 text-neutral-600 pointer-events-none" />
      </div>
    </div>
  );
}

// --- Componentes Internos de Modais ---
// Exibe o tempo decorrido e se atualiza sozinho a cada segundo (só ele, não o quadro todo)
function LiveElapsed({ task, getElapsed }: any) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!task.timerRunning) return;
    const id = setInterval(() => force((x: number) => x + 1), 1000);
    return () => clearInterval(id);
  }, [task.timerRunning]);
  return <>{formatTime(getElapsed(task))}</>;
}

function TimerPanelContent({ tasks, getElapsed, onToggleTimer, user }: any) {
  const activeTasks = tasks.filter((t: any) => (t.timerRunning || t.timerElapsed > 0) && t.responsibleId === user.id).sort((a: any, b: any) => b.timerRunning - a.timerRunning);
  return (
    <div className="flex flex-col h-full fade-in">
      <p className="text-sm text-neutral-400 mb-8 text-center max-w-lg mx-auto">Inicie o cronômetro diretamente num card do painel principal para acompanhar o tempo de execução aqui.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeTasks.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-neutral-600 border border-dashed border-[#27272a] rounded-3xl">
            Nenhuma tarefa ativa neste momento.
          </div>
        )}
        {activeTasks.map((t: any) => {
          const isDoneOrCancelled = t.status === "done" || t.status === "cancelled" || t.status === "formalize";
          return (
            <div key={t.id} className="bg-[#12121a] border border-[#27272a] rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group hover:border-[#3f3f46] transition-colors shadow-sm">
              {t.timerRunning && <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />}
              <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-400 mb-4 truncate w-full">
                {COLUMNS.find(c=>c.id === t.status)?.name}
              </div>
              <h3 className={`font-bold text-base mb-5 truncate w-full ${isDoneOrCancelled ? 'text-neutral-500 line-through' : 'text-white'}`} title={t.title}>{t.title}</h3>
              <div className={`text-5xl font-mono font-light mb-8 tracking-wider ${t.timerRunning ? 'text-amber-400 drop-shadow-md' : 'text-white'}`}>
                <LiveElapsed task={t} getElapsed={getElapsed} />
              </div>
              {!isDoneOrCancelled ? (
                <button onClick={() => onToggleTimer(t.id)} className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all ${t.timerRunning ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 text-neutral-300 hover:bg-white/10 border border-white/10'}`}>
                  {t.timerRunning ? <><Pause size={14}/> Pausar Tempo</> : <><Play size={14}/> Iniciar Tempo</>}
                </button>
              ) : (
                <div className="w-full flex items-center justify-center py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] bg-black/40 border border-white/5 text-neutral-600">
                  Card Fechado
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}

// A criação de contas agora acontece pela tela de login ("Criar Conta"), via Supabase Auth.
// Este painel é apenas de visualização da equipe — criar conta por aqui digitando
// nome+senha deixou de existir (não gerava mais um login funcional e era inseguro).
function ResponsiblesPanelContent({ responsibles, tasks, user }: any) {
  return (
    <div className="flex flex-col h-full fade-in">
      {user.isAdmin && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 text-indigo-300 text-xs px-5 py-4 rounded-2xl mb-8 leading-relaxed">
          Novos consultores criam a própria conta pela tela de login, na aba "Criar Conta".
          Assim que criarem, aparecem automaticamente nesta lista.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {responsibles.map((r: any) => {
          const count = tasks.filter((t: any) => t.responsibleId === r.id).length;
          return (
            <div key={r.id} className="flex items-center justify-between gap-4 bg-[#12121a] border border-[#27272a] rounded-2xl p-5 group hover:border-indigo-500/50 transition-all shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  <UserAvatar url={r.avatar} name={r.name} />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold text-neutral-100">{r.name}{r.is_admin ? ' (Admin)' : ''}</span>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">{count} Demandas</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

function ClientModal({ modal, setModal, setClients, user }: any) {
  const [form, setForm] = useState(modal.form);
  const [newEmail, setNewEmail] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAddEmail = () => {
    if (!newEmail.trim()) return;
    if (!newEmail.includes("@")) { setValidationError("Insira um e-mail válido."); return; }
    setForm((prev: any) => ({ ...prev, emails: [...(prev.emails || []), newEmail.trim()] }));
    setNewEmail(""); setValidationError(null);
  };

  const handleRemoveEmail = (index: number) => { setForm((prev: any) => ({ ...prev, emails: (prev.emails || []).filter((_: any, i: number) => i !== index) })); };

  const saveClient = () => {
    if (!form.name || !form.name.trim()) { setValidationError("O nome do cliente é obrigatório."); return; }
    
    const finalForm = { 
       ...form, 
       name: (form.name || '').toUpperCase(),
       contractedHours: form.contractedHours === '' ? 0 : parseFloat(form.contractedHours) || 0 
    };

    if (modal.mode === "add") { 
       setClients((prev: any) => [...prev, { ...finalForm, id: 'c' + Date.now(), ownerId: user.id }]); 
    } else { 
       setClients((prev: any) => prev.map((c: any) => c.id === finalForm.id ? finalForm : c)); 
    }
    setModal(null);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center px-3 pt-3 pb-24 sm:p-4 z-[70] fade-in" onClick={() => setModal(null)}>
      <div className="w-full max-w-md rounded-3xl sm:rounded-[32px] bg-[#12121a] border border-[#27272a] flex flex-col max-h-[80dvh] sm:max-h-[85dvh] shadow-2xl overflow-hidden animate-modal-pop" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 sm:px-8 py-5 border-b border-[#27272a] flex items-center justify-between bg-[#0f0f13] shrink-0">
          <h3 className="font-display font-bold text-xl text-white tracking-tight">{modal.mode === "add" ? "Novo Cliente" : "Editar Cliente"}</h3>
          <button onClick={() => setModal(null)} className="p-2.5 rounded-xl text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"><X size={20} /></button>
        </div>
        
        <div className="p-5 sm:p-8 flex flex-col gap-6 bg-[#09090b] flex-1 overflow-y-auto kp-scroll">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Nome da Empresa *</label>
            <input autoFocus value={form.name || ''} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationError(null); }} className={`w-full bg-[#12121a] border rounded-xl px-4 py-4 sm:py-3.5 text-sm text-white outline-none focus:border-purple-500 transition-colors ${validationError && String(validationError).includes("nome") ? "border-red-500" : "border-[#27272a]"}`} placeholder="Ex: Acme Corp" />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Teto de Horas Contratadas (Mensal)</label>
            <input type="number" value={form.contractedHours === 0 ? '' : form.contractedHours} onChange={(e) => setForm({ ...form, contractedHours: e.target.value })} className={`w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-4 sm:py-3.5 text-sm text-white outline-none focus:border-purple-500 transition-colors`} placeholder="Ex: 50" />
          </div>


          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">E-mails (Contatos)</label>
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
              <input value={newEmail || ''} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddEmail()} className="w-full sm:flex-1 bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-4 sm:py-3.5 text-sm text-white outline-none focus:border-purple-500 transition-colors" placeholder="Ex: gestor@empresa.com" />
              <button onClick={handleAddEmail} className="w-full sm:w-auto justify-center px-6 py-4 sm:py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 shrink-0"><Plus size={16}/> Add</button>
            </div>

            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto kp-scroll pr-1">
              {(!form.emails || form.emails.length === 0) && <div className="text-center text-xs text-neutral-600 py-6 border border-dashed border-[#27272a] rounded-2xl">Nenhum e-mail adicionado.</div>}
              {form.emails && form.emails.map((email: string, index: number) => (
                <div key={index} className="flex items-center justify-between bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3 text-sm text-neutral-300"><Mail size={16} className="text-purple-400" /> {email}</div>
                  <button onClick={() => handleRemoveEmail(index)} className="p-2 text-neutral-500 hover:text-red-500 transition-colors"><X size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="px-5 sm:px-8 py-5 border-t border-[#27272a] bg-[#0f0f13] flex items-center justify-end gap-3 shrink-0">
          <button onClick={() => setModal(null)} className="flex-1 sm:flex-none text-xs font-bold uppercase tracking-widest px-5 py-4 rounded-xl text-neutral-500 hover:text-white transition-colors">Cancelar</button>
          <button onClick={saveClient} className="flex-1 sm:flex-none text-xs font-black uppercase tracking-[0.15em] px-8 py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]">Salvar Cliente</button>
        </div>
      </div>
      
      {validationError && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 fade-in z-[80] font-bold text-xs uppercase tracking-wider w-11/12 max-w-sm">
          <AlertTriangle size={18} className="shrink-0" /> {String(validationError)}
        </div>
      )}
    </div>
  );
}

function ClientDetailModal({ client, tasks, getElapsed, user, onClose, onEdit, onRemove }: any) {
  const [copiedLimitHtml, setCopiedLimitHtml] = useState(false);
  const copyLimitEmailHtml = async () => {
    const html = generateLimitEmailHtml(client, worked);
    try {
      if ((navigator as any).clipboard && (window as any).ClipboardItem) {
        const item = new (window as any).ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' }),
        });
        await (navigator as any).clipboard.write([item]);
      }
      setCopiedLimitHtml(true);
      setTimeout(() => setCopiedLimitHtml(false), 2000);
    } catch {}
  };
  const cTasks = tasks.filter((t: any) => t.clientId === client.id);
  const worked = cTasks.reduce((acc: number, t: any) => acc + (getElapsed(t) / 3600), 0);
  const teto = client.contractedHours || 0;
  const remaining = teto ? teto - worked : null;
  const pct = teto ? Math.min(100, (worked / teto) * 100) : 0;
  const emails = Array.isArray(client.emails) ? client.emails : [];

  const over = remaining !== null && remaining < 0;
  const near = remaining !== null && remaining >= 0 && remaining <= 5;
  const barColor = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-emerald-500';
  const accentText = over ? 'text-red-400' : near ? 'text-amber-400' : 'text-emerald-400';

  const doneCount = cTasks.filter((t: any) => t.status === 'done' || t.status === 'formalize').length;
  const activeCount = cTasks.filter((t: any) => !['done', 'cancelled', 'formalize'].includes(t.status)).length;

  const sorted = [...cTasks].sort((a: any, b: any) => COLUMNS.findIndex(c => c.id === a.status) - COLUMNS.findIndex(c => c.id === b.status));

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center px-3 pt-3 pb-24 sm:p-4 z-[75] fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-3xl sm:rounded-[32px] bg-[#12121a] border border-[#27272a] flex flex-col max-h-[80dvh] sm:max-h-[85dvh] shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
        <div className="px-5 sm:px-8 py-5 border-b border-[#27272a] flex items-center justify-between bg-[#0f0f13] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20 shrink-0"><Building2 size={22} className="text-purple-400" /></div>
            <h3 className="font-display font-bold text-xl text-white tracking-tight truncate">{client.name}</h3>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl text-neutral-500 hover:text-white hover:bg-white/5 transition-colors shrink-0"><X size={20} /></button>
        </div>

        <div className="p-5 sm:p-8 flex flex-col gap-6 bg-[#09090b] flex-1 overflow-y-auto kp-scroll">

          {/* Banco de horas */}
          <div className="rounded-2xl border border-[#27272a] bg-[#12121a] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Banco de Horas</h4>
              {teto > 0 && (
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${over ? 'bg-red-500/10 text-red-400 border-red-500/20' : near ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  {over ? `${Math.abs(remaining as number).toFixed(1)}h acima` : `${(remaining as number).toFixed(1)}h restam`}
                </span>
              )}
            </div>
            {teto > 0 ? (
              <>
                <div className="flex items-end justify-between mb-3">
                  <span className="text-3xl font-black text-white">{worked.toFixed(1)}<span className="text-lg text-neutral-500 font-bold ml-1">h</span></span>
                  <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">de {teto}h contratadas</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/50 overflow-hidden border border-white/5">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                {(over || near) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={generateLimitEmailLink(client, worked)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors">
                      <AlertTriangle size={14} /> Enviar aviso de horas
                    </a>
                    <button onClick={copyLimitEmailHtml} title="Copia formatado (com assinatura) para colar no Gmail" className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-colors">
                      {copiedLimitHtml ? <Check size={14} /> : <Sparkles size={14} />} {copiedLimitHtml ? 'Copiado! Cole no Gmail' : 'Copiar (HTML)'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-white">{worked.toFixed(1)}<span className="text-lg text-neutral-500 font-bold ml-1">h</span></span>
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-600">sem teto definido</span>
              </div>
            )}
          </div>

          {/* Mini-stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#27272a] bg-[#12121a] p-4 flex flex-col gap-1">
              <span className="text-2xl font-black text-white">{cTasks.length}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Demandas</span>
            </div>
            <div className="rounded-xl border border-[#27272a] bg-[#12121a] p-4 flex flex-col gap-1">
              <span className="text-2xl font-black text-blue-400">{activeCount}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Ativas</span>
            </div>
            <div className="rounded-xl border border-[#27272a] bg-[#12121a] p-4 flex flex-col gap-1">
              <span className="text-2xl font-black text-emerald-400">{doneCount}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Concluídas</span>
            </div>
          </div>

          {/* Contatos */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3 ml-0.5">Contatos</h4>
            {emails.length === 0 ? (
              <div className="text-center text-xs text-neutral-600 py-5 border border-dashed border-[#27272a] rounded-xl">Nenhum contato cadastrado.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {emails.map((e: string, i: number) => (
                  <a key={i} href={`mailto:${e}`} className="flex items-center gap-3 bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-neutral-300 hover:border-purple-500/40 transition-colors">
                    <Mail size={16} className="text-purple-400 shrink-0" /> <span className="truncate">{e}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Demandas */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3 ml-0.5">Demandas ({cTasks.length})</h4>
            {cTasks.length === 0 ? (
              <div className="text-center text-xs text-neutral-600 py-5 border border-dashed border-[#27272a] rounded-xl">Nenhuma demanda para este cliente.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {sorted.map((t: any) => {
                  const col = COLUMNS.find(c => c.id === t.status);
                  const tempo = getElapsed(t);
                  const closed = ['done', 'cancelled', 'formalize'].includes(t.status);
                  return (
                    <div key={t.id} className="flex items-center gap-3 bg-[#12121a] border border-[#27272a] rounded-xl p-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${col?.dot || 'bg-neutral-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-[13px] font-bold leading-snug truncate ${closed ? 'text-neutral-500' : 'text-white'}`}>{t.title}</div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mt-0.5">{col?.name || t.status}</div>
                      </div>
                      {tempo > 0 && <span className="text-[10px] font-mono font-bold text-neutral-400 shrink-0">{formatTime(tempo)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {user.isAdmin && (
          <div className="px-5 sm:px-8 py-5 border-t border-[#27272a] bg-[#0f0f13] flex items-center justify-between gap-3 shrink-0">
            <button onClick={() => onRemove(client.id)} className="flex items-center gap-2 px-4 py-3 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-widest transition-colors">
              <Trash2 size={16} /> Remover
            </button>
            <button onClick={() => onEdit(client)} className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]">
              <Pencil size={16} /> Editar Cliente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientsPanelContent({ clients, setClients, tasks, setTasks, user, getElapsed }: any) {
  const [clientModal, setClientModal] = useState<any>(null);

  const openAdd = () => setClientModal({ mode: 'add', form: { name: '', emails: [], contractedHours: '' } });
  
  // Apenas admin edita clientes — o RLS já bloqueia a escrita dos demais no banco,
  // então a UI acompanha a regra para evitar salvamentos que falhariam em silêncio.
  const [detailClient, setDetailClient] = useState<any>(null);

  const openEdit = (client: any) => {
    if (!user.isAdmin) return;
    const emailsArray = Array.isArray(client.emails) ? client.emails : [];
    setClientModal({ mode: 'edit', form: { ...client, emails: emailsArray } });
  };

  const remove = async (id: string) => { 
    if(!user.isAdmin) return alert("Apenas administradores podem remover clientes.");
    setClients((prev: any) => prev.filter((c: any) => c.id !== id)); 
    setTasks((prev: any) => prev.map((t: any) => t.clientId === id ? { ...t, clientId: '' } : t)); 
    if ((window as any).supabaseClient) {
      await (window as any).supabaseClient.from('clients').delete().eq('id', id.toString());
    }
  };

  return (
    <div className="flex flex-col h-full fade-in relative">
      {user.isAdmin && (
         <div className="flex justify-end mb-6">
           <button onClick={openAdd} className="w-full sm:w-auto px-8 py-4 sm:py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
             <Plus size={16}/> Criar Cliente
           </button>
         </div>
      )}
      
      <div className="grid grid-cols-1 gap-4">
        {clients.length === 0 && (
          <div className="text-center text-sm text-neutral-500 py-16 border border-dashed border-[#27272a] rounded-[24px]">
            A sua carteira de clientes está vazia.
          </div>
        )}
        {clients.map((c: any) => {
          const count = tasks.filter((t: any) => t.clientId === c.id).length;
          const emailsArray = Array.isArray(c.emails) ? c.emails : [];
          
          const cTasks = tasks.filter((t: any) => t.clientId === c.id);
          const hours = cTasks.reduce((acc: number, t: any) => acc + (getElapsed(t) / 3600), 0);
          const remaining = c.contractedHours ? c.contractedHours - hours : null;
          const isNearLimit = remaining !== null && remaining <= 5;
          
          return (
            <div key={c.id} onClick={() => setDetailClient(c)} className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#12121a] border border-[#27272a] rounded-[20px] p-6 transition-all gap-5 sm:gap-0 shadow-sm relative group hover:border-purple-500/50 cursor-pointer">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 group-hover:border-purple-500/30 transition-colors"><Building2 size={24} className="text-purple-400" /></div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-neutral-100 group-hover:text-purple-400 transition-colors">{c.name}</span>
                  <span className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-bold">
                    {c.contractedHours ? <span className="text-indigo-400">Teto: {c.contractedHours}h | </span> : ''} {emailsArray.length === 0 ? "0 E-mails" : `${emailsArray.length} Contato(s)`} • {count} Demandas
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 mt-4 sm:mt-0">
                {isNearLimit && remaining !== null && (
                  <a href={generateLimitEmailLink(c, hours)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-5 py-3.5 sm:py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors shrink-0 shadow-sm">
                    <AlertTriangle size={14}/> Aviso ({remaining.toFixed(1)}h)
                  </a>
                )}
                {user.isAdmin && (
                   <button onClick={(e) => { e.stopPropagation(); remove(c.id); }} className="p-3.5 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors sm:opacity-0 group-hover:opacity-100 z-10 relative">
                     <Trash2 size={20} />
                   </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {clientModal && <ClientModal modal={clientModal} setModal={setClientModal} setClients={setClients} user={user} />}
      {detailClient && <ClientDetailModal client={detailClient} tasks={tasks} getElapsed={getElapsed} user={user} onClose={() => setDetailClient(null)} onEdit={(c: any) => { setDetailClient(null); setClientModal({ mode: 'edit', form: { ...c, emails: Array.isArray(c.emails) ? c.emails : [] } }); }} onRemove={(id: string) => { setDetailClient(null); remove(id); }} />}
    </div>
  );
}

function AnalyticsModal({ onClose, tasks, clients, responsibles, getElapsed, isClosing, globalLookerUrl, setGlobalLookerUrl, user }: any) {
  const [activeView, setActiveView] = useState('internal'); 
  const [isEditing, setIsEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState(globalLookerUrl);

  const [showFilters, setShowFilters] = useState(false);
  const [filterClient, setFilterClient] = useState("all");
  const [filterResp, setFilterResp] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCreatedStart, setFilterCreatedStart] = useState("");
  const [filterCreatedEnd, setFilterCreatedEnd] = useState("");
  const [filterCompletedStart, setFilterCompletedStart] = useState("");
  const [filterCompletedEnd, setFilterCompletedEnd] = useState("");
  
  const hasDateFilters = filterCreatedStart || filterCreatedEnd || filterCompletedStart || filterCompletedEnd;

  const saveUrl = async () => {
    let finalUrl = inputUrl.trim();
    if (finalUrl && finalUrl.includes('/reporting/') && !finalUrl.includes('/embed/')) {
        finalUrl = finalUrl.replace('/reporting/', '/embed/reporting/');
    }
    setGlobalLookerUrl(finalUrl);
    setIsEditing(false);
    
    if ((window as any).supabaseClient) {
       try {
         const { error } = await (window as any).supabaseClient.from('settings').upsert({ id: 'global', looker_global_url: finalUrl });
         if(error) console.error("Erro ao salvar Looker URL global", error);
       } catch (e) {
         console.error("Erro crítico ao salvar Looker URL global", e);
       }
    }
  };

  const filteredTasks = tasks.filter((t: any) =>
      (filterClient === "all" || t.clientId === filterClient) &&
      (filterResp === "all" || t.responsibleId === filterResp) &&
      (filterPriority === "all" || t.priority === filterPriority) &&
      filterByPeriod(t.createdAt, filterCreatedStart, filterCreatedEnd) &&
      filterByPeriod(t.completedAt, filterCompletedStart, filterCompletedEnd)
  );

  const exportTasksCSV = () => {
    const headers = ["ID", "Título", "Status", "Prioridade", "Cliente", "Responsável", "Estimado (min)", "Gasto (h)"];
    const rows = filteredTasks.map((t: any) => {
      const clientName = clients.find((c: any) => c.id === t.clientId)?.name || '-';
      const respName = responsibles.find((r: any) => r.id === t.responsibleId)?.name || '-';
      const statusName = COLUMNS.find(c => c.id === t.status)?.name || t.status;
      const elapsedH = (getElapsed(t) / 3600).toFixed(2);
      return [t.id, `"${String(t.title || '').replace(/"/g, '""')}"`, statusName, t.priority, `"${clientName}"`, `"${respName}"`, t.durationMin || 0, elapsedH].join(',');
    });
    downloadCSV([headers.join(','), ...rows], 'lumina_tarefas.csv');
  };

  return (
    <OverlayModal title="Lumina Analytics" icon={<BarChart3 className="text-blue-500" size={24}/>} onClose={onClose} fullWidth isClosing={isClosing}>
      <div className="flex flex-col min-h-full fade-in pb-8">
        
        {/* Toggle View */}
        <div className="flex justify-center mb-8 shrink-0">
          <div className="bg-[#12121a] border border-[#27272a] p-1.5 rounded-2xl flex gap-2">
             <button onClick={() => setActiveView('internal')} className={`px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeView === 'internal' ? 'bg-[#27272a] text-white shadow-sm' : 'text-neutral-500 hover:text-white'}`}>Sistema Interno</button>
             {user.isAdmin && <button onClick={() => setActiveView('looker')} className={`px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeView === 'looker' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'text-neutral-500 hover:text-white'}`}><MonitorPlay size={16}/> Looker Studio</button>}
          </div>
        </div>

        {/* View 1: Relatórios Internos */}
        {activeView === 'internal' && (
           <div className="flex flex-col gap-6 fade-in">
             
             {/* Filtro Button */}
             <div className="flex justify-start">
               <button 
                 onClick={(e) => { e.stopPropagation(); setShowFilters(!showFilters); }} 
                 className={`h-11 w-full sm:w-auto px-4 flex items-center justify-center gap-2 rounded-xl transition-all shadow-sm shrink-0 border font-bold uppercase tracking-widest text-[10px] ${showFilters ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'glass-panel text-neutral-400 border-white/5 hover:text-white'}`}
               >
                 <Filter size={16} /> Filtros
               </button>
             </div>

             {/* Filtros Container */}
               {showFilters && (
                 <div className="w-full animate-fade-in" onClick={e => e.stopPropagation()}>
                    <div className="glass-panel w-full p-4 sm:p-5 rounded-2xl flex flex-col gap-4 shadow-sm border border-indigo-500/20">

                      {/* Seletores */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                         <FilterSelect value={filterClient} onChange={setFilterClient} options={clients} defaultLabel="Todos Clientes" />
                         {user.isAdmin && <>
                           <div className="hidden sm:block w-px h-4 bg-white/10"></div>
                           <FilterSelect value={filterResp} onChange={setFilterResp} options={responsibles} defaultLabel="Todos Responsáveis" />
                         </>}
                         <div className="hidden sm:block w-px h-4 bg-white/10"></div>
                         <FilterSelect value={filterPriority} onChange={setFilterPriority} options={[{id: 'Baixa', name: 'Baixa'}, {id: 'Média', name: 'Média'}, {id: 'Alta', name: 'Alta'}]} defaultLabel="Prioridades" />
                      </div>

                      <div className="h-px w-full bg-white/5"></div>

                      {/* Intervalos de data */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         <div className="rounded-xl border border-white/5 bg-black/20 p-3.5 flex flex-col gap-2.5">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300 flex items-center gap-1.5"><Clock size={12}/> Criado entre</span>
                            <div className="grid grid-cols-2 gap-2">
                               <div className="flex flex-col gap-1">
                                  <label className="text-[9px] uppercase font-bold text-neutral-500 ml-0.5">De</label>
                                  <input type="date" value={filterCreatedStart} onChange={e => setFilterCreatedStart(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-lg px-3 h-10 text-xs text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
                               </div>
                               <div className="flex flex-col gap-1">
                                  <label className="text-[9px] uppercase font-bold text-neutral-500 ml-0.5">Até</label>
                                  <input type="date" value={filterCreatedEnd} onChange={e => setFilterCreatedEnd(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-lg px-3 h-10 text-xs text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
                               </div>
                            </div>
                         </div>

                         <div className="rounded-xl border border-white/5 bg-black/20 p-3.5 flex flex-col gap-2.5">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-300 flex items-center gap-1.5"><CheckCircle2 size={12}/> Concluído entre</span>
                            <div className="grid grid-cols-2 gap-2">
                               <div className="flex flex-col gap-1">
                                  <label className="text-[9px] uppercase font-bold text-neutral-500 ml-0.5">De</label>
                                  <input type="date" value={filterCompletedStart} onChange={e => setFilterCompletedStart(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-lg px-3 h-10 text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]" />
                               </div>
                               <div className="flex flex-col gap-1">
                                  <label className="text-[9px] uppercase font-bold text-neutral-500 ml-0.5">Até</label>
                                  <input type="date" value={filterCompletedEnd} onChange={e => setFilterCompletedEnd(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-lg px-3 h-10 text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]" />
                               </div>
                            </div>
                         </div>
                      </div>

                      {hasDateFilters && (
                         <button onClick={() => { setFilterCreatedStart(''); setFilterCreatedEnd(''); setFilterCompletedStart(''); setFilterCompletedEnd(''); }} className="self-end flex items-center justify-center gap-1.5 px-4 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-bold uppercase tracking-widest transition-colors">
                           <X size={12}/> Limpar Datas
                         </button>
                      )}
                    </div>
                 </div>
               )}

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                   <h3 className="text-[10px] font-bold text-neutral-500 mb-4 uppercase tracking-[0.2em] ml-1">Por Fase do Fluxo</h3>
                   <div className="flex flex-col gap-3">
                      {COLUMNS.map(col => { 
                          const count = filteredTasks.filter((t: any) => t.status === col.id).length; 
                          return (
                              <div key={col.id} className="flex justify-between items-center bg-[#12121a] border border-[#27272a] p-5 rounded-2xl shadow-sm">
                                  <div className="flex items-center gap-4">
                                      <span className={`w-3 h-3 rounded-full ${col.dot} shadow-[0_0_8px_currentColor]`} />
                                      <span className="text-xs text-neutral-300 font-bold uppercase">{col.name}</span>
                                  </div>
                                  <span className="text-lg font-black text-white">{count}</span>
                              </div>
                          )
                      })}
                   </div>
                </div>
                <div>
                   <h3 className="text-[10px] font-bold text-neutral-500 mb-4 uppercase tracking-[0.2em] ml-1">Por Responsável</h3>
                   <div className="flex flex-col gap-3">
                      {responsibles.map((r: any) => { 
                          const rTasks = filteredTasks.filter((t: any) => t.responsibleId === r.id); 
                          if (rTasks.length === 0) return null;
                          const hours = rTasks.reduce((acc: number, t: any) => acc + (getElapsed(t) / 3600), 0); 
                          return (
                              <div key={r.id} className="bg-[#12121a] border border-[#27272a] p-5 rounded-2xl shadow-sm">
                                  <div className="text-base text-neutral-100 font-bold mb-2">{r.name}</div>
                                  <div className="flex items-center gap-4 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                      <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5">{rTasks.length} Demandas</span>
                                      <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5">{hours.toFixed(1)}h Totais</span>
                                  </div>
                              </div>
                          )
                      })}
                   </div>
                </div>
                <div>
                   <h3 className="text-[10px] font-bold text-neutral-500 mb-4 uppercase tracking-[0.2em] ml-1">Por Cliente</h3>
                   <div className="flex flex-col gap-3">
                      {clients.map((c: any) => { 
                          const cTasks = filteredTasks.filter((t: any) => t.clientId === c.id); 
                          if (cTasks.length === 0) return null; 
                          const hours = cTasks.reduce((acc: number, t: any) => acc + (getElapsed(t) / 3600), 0); 
                          return (
                              <div key={c.id} className="bg-[#12121a] border border-[#27272a] p-5 rounded-2xl shadow-sm">
                                  <div className="text-base text-neutral-100 font-bold mb-2">{c.name}</div>
                                  <div className="flex items-center gap-4 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                      <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5">{cTasks.length} Demandas</span>
                                      <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5">{hours.toFixed(1)}h Totais</span>
                                  </div>
                              </div>
                          )
                      })}
                   </div>
                </div>
             </div>
             
             <div className="flex justify-center mt-6">
                <button onClick={exportTasksCSV} className="w-full md:w-auto flex items-center justify-center gap-2 px-10 py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm">
                   <Download size={18}/> Baixar Dados (CSV)
                </button>
             </div>
           </div>
        )}

        {/* View 2: Looker Studio (iFrame) — configuração restrita ao admin */}
        {activeView === 'looker' && user.isAdmin && (
          <div className="flex-1 flex flex-col min-h-0 h-full fade-in">
            {(!globalLookerUrl || isEditing) ? (
               user.isAdmin ? (
                 <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full text-center gap-8">
                   <div className="w-24 h-24 rounded-[32px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.15)]"><BarChart3 size={40} /></div>
                   <div>
                     <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">Painel Analítico Global</h3>
                     <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">Configure aqui o Link de Incorporação (Embed) do Looker Studio para o painel de uso da sua equipe interna.</p>
                   </div>
                   <div className="w-full">
                      <input value={inputUrl} onChange={e => setInputUrl(e.target.value)} placeholder="https://lookerstudio.google.com/embed/reporting/..." className="w-full bg-[#12121a] border border-[#27272a] rounded-2xl px-6 py-5 text-sm text-white outline-none focus:border-blue-500 text-center shadow-inner mb-5" />
                      <button onClick={saveUrl} className="w-full py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-sm transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">Ligar Relatório Global</button>
                   </div>
                   {globalLookerUrl && <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-neutral-500 uppercase tracking-widest hover:text-white mt-2">Cancelar</button>}
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                   <div className="w-20 h-20 rounded-[24px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500"><Lock size={32} /></div>
                   <p className="text-sm text-neutral-400 max-w-sm">O painel do Looker Studio ainda não foi configurado. Peça ao administrador do Lumina para conectar o relatório global.</p>
                 </div>
               )
            ) : (
               <div className="flex flex-col h-full gap-5">
                 {user.isAdmin && (
                   <div className="flex justify-end shrink-0">
                      <button onClick={() => {setInputUrl(globalLookerUrl); setIsEditing(true);}} className="flex justify-center items-center gap-2 px-6 py-3.5 bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"><Settings size={16}/> Trocar Conexão Looker</button>
                   </div>
                 )}
                 <div className="flex-1 w-full bg-[#12121a] rounded-[32px] border border-[#27272a] overflow-hidden relative shadow-inner">
                   <div className="absolute inset-0 flex flex-col gap-4 items-center justify-center -z-10">
                     <Cloud size={40} className="text-indigo-500/20 animate-pulse" />
                     <span className="text-xs font-bold uppercase tracking-widest text-neutral-600">A Carregar Looker...</span>
                   </div>
                   <iframe src={globalLookerUrl} className="w-full h-full border-0 bg-transparent z-10 relative" allowFullScreen />
                 </div>
               </div>
            )}
          </div>
        )}

      </div>
    </OverlayModal>
  )
}

// Gera um link que abre o Google Agenda com o evento já preenchido (sem API/OAuth),
// exatamente como os botões de e-mail já fazem com o Gmail.
function toGCalStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}
// Prefixos de rótulo aplicados ao título do evento no Google Agenda.
// Observação: o Google só permite escolher o tipo nativo "Hora de concentração" via API completa
// com OAuth (mesma trava do acesso à organização da Rubeus). Por link direto, simulamos a
// distinção visual com um prefixo no título — funciona bem pra identificar o tipo de compromisso
// sem precisar daquele acesso.
const GCAL_LABELS: Record<string, string> = {
  reuniao: '',
  foco: '🎯 FOCO — ',
  tarefa: '✅ TAREFA — ',
};

function buildGCalLink(task: any, clientName: string, label?: string) {
  if (!task.scheduledStart) return '#';
  const start = new Date(task.scheduledStart);
  if (isNaN(start.getTime())) return '#';
  const durMin = task.scheduledDurationMin && task.scheduledDurationMin > 0 ? task.scheduledDurationMin : (task.durationMin && task.durationMin > 0 ? task.durationMin : 60);
  const end = new Date(start.getTime() + durMin * 60000);
  // Título no padrão "PREFIXO NOME DO CLIENTE | TÍTULO DA DEMANDA" (cliente em caixa alta)
  const prefix = GCAL_LABELS[label || 'reuniao'] || '';
  const title = prefix + (clientName ? `${clientName.toUpperCase()} | ${task.title || 'Demanda'}` : (task.title || 'Demanda'));
  // Descrição: só o contexto (sem o cliente) + checklist, se houver
  let details = task.description || '';
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  if (checklist.length > 0) {
    details += (details ? '\n\n' : '') + 'Checklist:\n' + checklist.map((c: any) => `${c.done ? '☑' : '☐'} ${c.text || ''}`).join('\n');
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&dates=${toGCalStamp(start)}/${toGCalStamp(end)}`;
}

function FocusRow({ t, clientName, onOpen, onToggleTimer, onComplete, onOpenAgenda, accent, meta, metaColor }: any) {
  const pr = PRIORITY_STYLE[t.priority] || PRIORITY_STYLE['Média'];
  const closed = ['done', 'cancelled', 'formalize'].includes(t.status);
  return (
    <div onClick={() => onOpen(t)} className="group flex items-stretch gap-3 bg-[#12121a] border border-[#27272a] rounded-xl p-3 cursor-pointer hover:border-[#3f3f46] transition-colors">
      <div className={`w-1 shrink-0 rounded-full ${accent}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          {clientName && <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 truncate max-w-[160px]">{clientName}</span>}
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pr.dot}`} />
        </div>
        <div className={`text-[13px] font-bold leading-snug truncate ${closed ? 'text-neutral-500 line-through' : 'text-white'}`}>{t.title}</div>
        {meta && <div className={`text-[10px] font-bold mt-1 ${metaColor || 'text-neutral-500'}`}>{meta}</div>}
      </div>
      {!closed && (
        <div className="self-center shrink-0 flex items-center gap-1.5">
          {onOpenAgenda && (
            <button onClick={(e) => { e.stopPropagation(); onOpenAgenda(t); }} className="p-2 rounded-lg border border-transparent bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors" title={t.scheduledStart ? 'Ver na Agenda' : 'Agendar um horário'}>
              <CalendarDays size={14} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onToggleTimer(t.id); }} className={`p-2 rounded-lg border transition-colors ${t.timerRunning ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-neutral-400 bg-white/5 border-transparent hover:bg-white/10'}`} title={t.timerRunning ? 'Pausar' : 'Iniciar timer'}>
            {t.timerRunning ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onComplete(t); }} className="p-2 rounded-lg border border-transparent bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Concluir">
            <CheckCircle2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function FocusSection({ label, count, dot, children }: any) {
  if (count === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 ml-0.5">
        <span className={`w-2 h-2 rounded-full ${dot} shadow-[0_0_8px_currentColor]`} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-300">{label}</h3>
        <span className="text-[10px] font-bold text-neutral-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function SearchModal({ tasks, clients, onOpen, onClose }: any) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const clientName = (id: string) => clients.find((c: any) => c.id === id)?.name || '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const results = query.length === 0 ? [] : tasks.filter((t: any) => {
    const hay = `${t.title || ''} ${t.description || ''} ${clientName(t.clientId)}`.toLowerCase();
    return hay.includes(query);
  }).slice(0, 40);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-start justify-center px-3 pt-[12vh] pb-24 sm:p-4 sm:pt-[12vh] z-[95] fade-in" onClick={onClose}>
      <div className="w-full max-w-xl rounded-3xl bg-[#12121a] border border-[#27272a] shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#27272a]">
          <Search size={18} className="text-neutral-500 shrink-0" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por título, cliente ou descrição..." className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-600" />
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="max-h-[52vh] overflow-y-auto kp-scroll p-2">
          {query.length === 0 && (
            <div className="text-center text-xs text-neutral-600 py-12">Digite para buscar entre suas demandas.</div>
          )}
          {query.length > 0 && results.length === 0 && (
            <div className="text-center text-xs text-neutral-600 py-12">Nenhuma demanda encontrada para "{q}".</div>
          )}
          {results.map((t: any) => {
            const col = COLUMNS.find(c => c.id === t.status);
            const cn = clientName(t.clientId);
            const pr = PRIORITY_STYLE[t.priority] || PRIORITY_STYLE['Média'];
            return (
              <button key={t.id} onClick={() => { onOpen(t); onClose(); }} className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <span className={`w-2 h-2 rounded-full shrink-0 ${col?.dot || 'bg-neutral-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-white truncate">{t.title}</div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mt-0.5 flex items-center gap-2 flex-wrap">
                    {cn && <><span className="truncate max-w-[140px]">{cn}</span><span className="opacity-40">·</span></>}
                    <span>{col?.name || t.status}</span>
                    <span className="opacity-40">·</span>
                    <span className={pr.text}>{t.priority}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-neutral-700 group-hover:text-neutral-400 shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>
        {results.length > 0 && (
          <div className="px-5 py-3 border-t border-[#27272a] text-[10px] text-neutral-600 uppercase tracking-widest font-bold flex items-center justify-between">
            <span>{results.length} resultado{results.length > 1 ? 's' : ''}</span>
            <span>Esc para fechar</span>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAddModal({ clients, onCreate, onClose }: any) {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [priority, setPriority] = useState('Média');
  const [error, setError] = useState('');

  const save = () => {
    if (!title.trim()) return setError('Informe um título.');
    if (!clientId) return setError('Selecione um cliente.');
    onCreate({ title: title.trim(), clientId, priority });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center px-3 pt-3 pb-24 sm:p-4 z-[95] fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl sm:rounded-[32px] bg-[#12121a] border border-[#27272a] shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[#27272a] flex items-center justify-between bg-[#0f0f13]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><Plus size={18} className="text-indigo-400" /></div>
            <h3 className="font-bold text-lg text-white tracking-tight">Captura Rápida</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-neutral-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 flex flex-col gap-5 bg-[#09090b]">
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2"><AlertTriangle size={14} className="shrink-0" /> {error}</div>}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Título *</label>
            <input autoFocus value={title} onChange={e => { setTitle(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && save()} className="w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors" placeholder="O que precisa ser feito?" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Cliente *</label>
            <div className="relative">
              <select value={clientId} onChange={e => { setClientId(e.target.value); setError(''); }} className="appearance-none w-full bg-[#12121a] border border-[#27272a] rounded-xl pl-4 pr-10 py-3.5 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer transition-colors">
                <option value="" className="bg-[#1c1d26]">Selecione o cliente...</option>
                {clients.map((c: any) => <option key={c.id} value={c.id} className="bg-[#1c1d26]">{c.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Prioridade</label>
            <div className="flex gap-2">
              {['Baixa', 'Média', 'Alta'].map(p => {
                const st = PRIORITY_STYLE[p];
                const on = priority === p;
                return <button key={p} onClick={() => setPriority(p)} className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${on ? `${st.bg} ${st.text} ${st.border}` : 'bg-[#12121a] text-neutral-500 border-[#27272a] hover:text-neutral-300'}`}>{p}</button>;
              })}
            </div>
          </div>
          <p className="text-[10px] text-neutral-600 ml-1 leading-relaxed">A demanda entra no Backlog com você como responsável. Detalhe (descrição, prazo, checklist) depois.</p>
        </div>
        <div className="px-6 py-5 border-t border-[#27272a] bg-[#0f0f13] flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-xs font-bold uppercase tracking-widest px-5 py-3.5 rounded-xl text-neutral-500 hover:text-white transition-colors">Cancelar</button>
          <button onClick={save} className="text-xs font-black uppercase tracking-widest px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]">Adicionar</button>
        </div>
      </div>
    </div>
  );
}

function TodayView({ tasks, clients, user, getElapsed, onOpen, onToggleTimer, onComplete, onOpenAgenda }: any) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowD = new Date();
  const todayMs = new Date(nowD).setHours(0, 0, 0, 0);
  const todayStr = `${nowD.getFullYear()}-${pad(nowD.getMonth() + 1)}-${pad(nowD.getDate())}`;
  const clientName = (id: string) => clients.find((c: any) => c.id === id)?.name || '';
  const greet = nowD.getHours() < 12 ? 'Bom dia' : nowD.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  const mine = tasks.filter((t: any) => t.responsibleId === user.id && !t.agendaOnly && !t.generatesCards);
  const isActive = (t: any) => !['done', 'cancelled', 'formalize'].includes(t.status);
  const dueMs = (t: any) => { if (!t.dueDate) return null; const [y, m, d] = t.dueDate.split('-'); return new Date(+y, +m - 1, +d).setHours(0, 0, 0, 0); };
  const schedDay = (t: any) => t.scheduledStart ? t.scheduledStart.slice(0, 10) : null;
  const startDay = (t: any) => t.startDate ? t.startDate.slice(0, 10) : null;
  const fmtBR = (s: string) => s ? s.split('-').reverse().join('/') : '';

  const overdue = mine.filter((t: any) => {
    if (!isActive(t)) return false;
    const d = dueMs(t);
    if (d !== null && d < todayMs) return true;
    const sd = startDay(t);
    if (sd && ['backlog', 'todo'].includes(t.status)) {
      const [y, m, dd] = sd.split('-');
      if (new Date(+y, +m - 1, +dd).setHours(0, 0, 0, 0) < todayMs) return true;
    }
    return false;
  });
  const dueToday = mine.filter((t: any) => isActive(t) && dueMs(t) === todayMs);
  // "Para hoje": agendada na Agenda (scheduledStart) OU com início previsto (startDate) para hoje.
  // Exclui as que já caem em Atrasadas/Vence hoje, pra não repetir.
  const scheduledToday = mine.filter((t: any) => isActive(t)
      && (schedDay(t) === todayStr || (startDay(t) === todayStr && ['backlog', 'todo'].includes(t.status)))
      && (dueMs(t) === null || (dueMs(t) as number) > todayMs)
    ).sort((a: any, b: any) => {
      const aS = a.scheduledStart ? new Date(a.scheduledStart).getTime() : Infinity;
      const bS = b.scheduledStart ? new Date(b.scheduledStart).getTime() : Infinity;
      return aS - bS;
    });
  const inProgress = mine.filter((t: any) => t.status === 'inprogress');
  const waiting = mine.filter((t: any) => t.status === 'waiting');
  const doneToday = mine.filter((t: any) => (t.status === 'done' || t.status === 'formalize') && t.completedAt === todayStr);

  // Semana (segunda a domingo)
  const ws = new Date(); ws.setHours(0, 0, 0, 0); ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const stats = [
    { label: 'Atrasadas', value: overdue.length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    { label: 'Vence hoje', value: dueToday.length, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    { label: 'Para hoje', value: scheduledToday.length, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
    { label: 'Feitas hoje', value: doneToday.length, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ];

  const nothing = overdue.length + dueToday.length + scheduledToday.length + inProgress.length + waiting.length === 0;

  return (
    <div className="flex flex-col h-full fade-in gap-6">
      {/* Saudação */}
      <div className="shrink-0">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">{greet}, {user.name.split(' ')[0]}</h2>
        <p className="text-xs text-neutral-500 mt-1 capitalize">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(nowD)}</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        {stats.map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 flex flex-col gap-1 ${s.bg}`}>
            <span className={`text-3xl font-black ${s.color}`}>{s.value}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Minha Semana */}
      <div className="shrink-0">
        <h3 className="text-[10px] font-bold text-neutral-500 mb-3 uppercase tracking-[0.2em] ml-0.5">Minha Semana</h3>
        <div className="grid grid-cols-7 gap-2">
          {week.map((d, i) => {
            const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const dayTasks = mine.filter((t: any) => isActive(t) && (schedDay(t) === dStr || startDay(t) === dStr));
            const load = dayTasks.reduce((acc: number, t: any) => acc + (t.durationMin > 0 ? t.durationMin : 60), 0);
            const isToday = new Date(d).setHours(0, 0, 0, 0) === todayMs;
            return (
              <div key={i} className={`rounded-xl border p-2 flex flex-col items-center gap-1 ${isToday ? 'border-teal-500/40 bg-teal-500/[0.06]' : 'border-[#27272a] bg-[#12121a]'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${isToday ? 'text-teal-400' : 'text-neutral-500'}`}>{dayNames[i]}</span>
                <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-neutral-300'}`}>{pad(d.getDate())}</span>
                {dayTasks.length > 0 ? (
                  <span className="text-[8px] font-bold text-neutral-500 text-center leading-tight">{dayTasks.length}× · {(load / 60).toFixed(1)}h</span>
                ) : (
                  <span className="text-[8px] text-neutral-700">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Listas de foco */}
      <div className="flex-1 overflow-y-auto kp-scroll flex flex-col gap-6 pr-0.5 pb-2">
        {nothing && (
          <div className="text-center text-sm text-neutral-500 py-12 border border-dashed border-[#27272a] rounded-2xl flex flex-col items-center gap-3">
            <CheckCircle2 size={32} className="text-emerald-500/60" />
            Nada atrasado ou pendente para hoje. Bom trabalho!
          </div>
        )}

        <FocusSection label="Atrasadas" count={overdue.length} dot="bg-red-500">
          {overdue.map((t: any) => <FocusRow key={t.id} t={t} clientName={clientName(t.clientId)} onOpen={onOpen} onToggleTimer={onToggleTimer} onComplete={onComplete} accent="bg-red-500" meta={(dueMs(t) !== null && (dueMs(t) as number) < todayMs) ? `Venceu em ${fmtBR(t.dueDate)}` : (t.startDate ? `Início era ${fmtBR(t.startDate)}` : 'Atrasada')} metaColor="text-red-400" />)}
        </FocusSection>

        <FocusSection label="Vence hoje" count={dueToday.length} dot="bg-orange-500">
          {dueToday.map((t: any) => <FocusRow key={t.id} t={t} clientName={clientName(t.clientId)} onOpen={onOpen} onToggleTimer={onToggleTimer} onComplete={onComplete} accent="bg-orange-500" meta="Prazo é hoje" metaColor="text-orange-400" />)}
        </FocusSection>

        <FocusSection label="Para hoje" count={scheduledToday.length} dot="bg-teal-500">
          {scheduledToday.map((t: any) => {
            let meta;
            if (t.scheduledStart) { const s = new Date(t.scheduledStart); const dur = t.durationMin > 0 ? t.durationMin : 60; meta = `${pad(s.getHours())}:${pad(s.getMinutes())} · ${dur}min`; }
            else meta = 'Início previsto para hoje';
            return <FocusRow key={t.id} t={t} clientName={clientName(t.clientId)} onOpen={onOpen} onToggleTimer={onToggleTimer} onComplete={onComplete} onOpenAgenda={onOpenAgenda} accent="bg-teal-500" meta={meta} metaColor="text-teal-400" />;
          })}
        </FocusSection>

        <FocusSection label="Em andamento" count={inProgress.length} dot="bg-blue-500">
          {inProgress.map((t: any) => <FocusRow key={t.id} t={t} clientName={clientName(t.clientId)} onOpen={onOpen} onToggleTimer={onToggleTimer} onComplete={onComplete} accent="bg-blue-500" meta={t.timerRunning ? `Rodando · ${formatTime(getElapsed(t))}` : (getElapsed(t) > 0 ? `Tempo: ${formatTime(getElapsed(t))}` : '')} metaColor="text-blue-400" />)}
        </FocusSection>

        <FocusSection label="Aguardando retorno" count={waiting.length} dot="bg-pink-500">
          {waiting.map((t: any) => <FocusRow key={t.id} t={t} clientName={clientName(t.clientId)} onOpen={onOpen} onToggleTimer={onToggleTimer} onComplete={onComplete} accent="bg-pink-500" meta={t.waitingFor ? `Depende de: ${t.waitingFor}` : 'Aguardando'} metaColor="text-pink-400" />)}
        </FocusSection>

        <FocusSection label="Concluídas hoje" count={doneToday.length} dot="bg-emerald-500">
          {doneToday.map((t: any) => <FocusRow key={t.id} t={t} clientName={clientName(t.clientId)} onOpen={onOpen} onToggleTimer={onToggleTimer} onComplete={onComplete} accent="bg-emerald-500" meta="Finalizada hoje" metaColor="text-emerald-400" />)}
        </FocusSection>
      </div>
    </div>
  );
}

function CalendarView({ tasks, setTasks, clients, handleRequestMove, user, onCreateCard, onDeleteTask }: any) {
  const ROW_H = 44; // pixels por hora
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;
    const nowH = new Date().getHours();
    const t = setTimeout(() => { el.scrollTop = Math.max(0, (nowH - 1) * ROW_H); }, 60);
    return () => clearTimeout(t);
  }, []);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // 0 = segunda
    d.setDate(d.getDate() - dow);
    return d;
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  }), [weekStart]);

  const [weekdaysOnly, setWeekdaysOnly] = useState(() => {
    try { return localStorage.getItem('lumina_agenda_weekdays') === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('lumina_agenda_weekdays', weekdaysOnly ? '1' : '0'); } catch {} }, [weekdaysOnly]);
  const visibleDays = weekdaysOnly ? days.slice(0, 5) : days;

  const pad = (n: number) => String(n).padStart(2, '0');
  const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const clientName = (id: string) => clients.find((c: any) => c.id === id)?.name || '';
  const isActionable = (t: any) => !['done', 'cancelled', 'formalize'].includes(t.status);
  const unscheduled = tasks.filter((t: any) => isActionable(t) && !t.scheduledStart);

  const tasksOnDay = (day: Date) => tasks.filter((t: any) => {
    if (!t.scheduledStart) return false;
    const s = new Date(t.scheduledStart);
    const sameDay = s.getFullYear() === day.getFullYear() && s.getMonth() === day.getMonth() && s.getDate() === day.getDate();

    if (t.templateId) {
      // Instância gerada: aparece só no dia em que ela de fato está marcada, mesmo já concluída (histórico)
      return sameDay;
    }

    if (sameDay) return true; // qualquer demanda agendada fica visível no seu dia, mesmo concluída/cancelada (histórico)

    // Repetição virtual do modelo em outros dias só faz sentido enquanto ele estiver ativo
    if (!isActionable(t)) return false;
    const matchesRepeat = t.recurrence === 'daily' || (t.recurrence === 'weekly' && s.getDay() === day.getDay());
    if (!matchesRepeat) return false;

    if (t.generatesCards) {
      // Modelo: não mostra (nem no próprio dia original) se já existir uma instância própria gerada pra este dia —
      // a instância assume o lugar dele ali, pra editar só aquela ocorrência sem mexer no padrão inteiro.
      const dayStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
      const hasOwnInstance = tasks.some((x: any) => x.templateId === t.id && x.occurrenceKey === `${t.id}|${dayStr}`);
      if (hasOwnInstance) return false;
    }

    return true;
  });

  const cycleRecurrence = (taskId: string) => setTasks((prev: any) => prev.map((t: any) => {
    if (t.id !== taskId) return t;
    const order = ['none', 'daily', 'weekly'];
    return { ...t, recurrence: order[(order.indexOf(t.recurrence || 'none') + 1) % 3] };
  }));

  const recurLabel = (r: string) => r === 'daily' ? 'dia' : r === 'weekly' ? 'sem' : '';

  const setSchedule = (taskId: string, value: string) => setTasks((prev: any) => prev.map((t: any) => {
    if (t.id !== taskId) return t;
    if (!value) return { ...t, scheduledStart: value };
    // A Data de Início acompanha o dia agendado na Agenda (não se aplica a modelos recorrentes)
    const datePart = value.slice(0, 10);
    return { ...t, scheduledStart: value, startDate: (t.agendaOnly || t.generatesCards) ? t.startDate : datePart };
  }));
  const setDuration = (taskId: string, dur: number) => setTasks((prev: any) => prev.map((t: any) => t.id === taskId ? { ...t, scheduledDurationMin: dur } : t));

  const scheduleAndStart = (task: any, day: Date, hour: number, minute: number) => {
    const start = new Date(day); start.setHours(hour, minute, 0, 0);
    const value = toLocalInput(start);
    setTasks((prev: any) => prev.map((t: any) => t.id === task.id ? { ...t, scheduledStart: value } : t));
    const link = buildGCalLink({ ...task, scheduledStart: value }, clientName(task.clientId));
    if (link !== '#') window.open(link, '_blank', 'noopener');
  };

  const doMeeting = (task: any, day: Date, hour: number, minute: number, durationMin: number) => {
    const start = new Date(day); start.setHours(hour, minute, 0, 0);
    const value = toLocalInput(start);
    setTasks((prev: any) => prev.map((t: any) => t.id === task.id ? { ...t, scheduledStart: value, startDate: value.slice(0, 10), scheduledDurationMin: durationMin, isMeeting: true } : t));
  };

  const doExecute = (task: any, day: Date, hour: number, minute: number, durationMin: number, label: string) => {
    const start = new Date(day); start.setHours(hour, minute, 0, 0);
    const value = toLocalInput(start);
    setTasks((prev: any) => prev.map((t: any) => t.id === task.id ? { ...t, scheduledStart: value, startDate: value.slice(0, 10), scheduledDurationMin: durationMin, status: 'inprogress', isMeeting: false } : t));
    const link = buildGCalLink({ ...task, scheduledStart: value, scheduledDurationMin: durationMin }, clientName(task.clientId), label);
    if (link !== '#') window.open(link, '_blank', 'noopener');
  };

  // Arraste (colocar/mover) e redimensionar via Pointer Events
  const dragRef = useRef<any>(null);
  const resizeRef = useRef<any>(null);
  const [ghost, setGhost] = useState<{ x: number, y: number, label: string } | null>(null);
  const [dropHint, setDropHint] = useState<{ dayIndex: number, minutes: number, dur: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ id: string, dur: number } | null>(null);

  // Criação de evento pela Agenda (clicar num horário vazio)
  const [createSlot, setCreateSlot] = useState<{ day: Date } | null>(null);
  const [cTitle, setCTitle] = useState('');
  const [cClient, setCClient] = useState('');
  const [cDate, setCDate] = useState('');
  const [cTime, setCTime] = useState('');
  const [cDur, setCDur] = useState(60);
  const [cRecur, setCRecur] = useState('none'); // 'none' | 'daily' | 'weekly'
  const [cShowBoard, setCShowBoard] = useState(false);
  const [cErr, setCErr] = useState('');
  const [scheduleChoice, setScheduleChoice] = useState<any>(null);
  const [scDuration, setScDuration] = useState(60);
  const [scLabel, setScLabel] = useState('reuniao');
  const [editSchedule, setEditSchedule] = useState<any>(null);
  const [esDate, setEsDate] = useState('');
  const [esTime, setEsTime] = useState('');
  const [esDur, setEsDur] = useState(60);

  const openCreateAt = (e: React.MouseEvent, day: Date) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const rawMin = ((e.clientY - rect.top) / ROW_H) * 60;
    const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(rawMin / 15) * 15));
    setCTitle(''); setCClient(''); setCDur(60); setCRecur('none'); setCShowBoard(false); setCErr('');
    setCDate(`${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`);
    setCTime(`${pad(Math.floor(snapped / 60))}:${pad(snapped % 60)}`);
    setCreateSlot({ day });
  };

  const createEvent = () => {
    if (!cTitle.trim()) { setCErr('Dê um título ao evento.'); return; }
    if (!cDate || !cTime) { setCErr('Informe a data e a hora.'); return; }
    const value = `${cDate}T${cTime}`;
    if (cShowBoard) {
      // Vai pro quadro: abre o formulário completo pra detalhar (descrição, checklist)
      onCreateCard({
        title: upper(cTitle.trim()), clientId: cClient, durationMin: String(cDur),
        startDate: cRecur === 'none' ? cDate : '', status: 'todo', scheduledStart: value,
        recurrence: cRecur, agendaOnly: false, generatesCards: cRecur !== 'none',
        scheduledDurationMin: cDur,
      });
      setCreateSlot(null);
      return;
    }
    const newTask = {
      id: nextId(), title: upper(cTitle.trim()), description: '', priority: 'Média',
      durationMin: cDur, clientId: cClient, responsibleId: user.id,
      startDate: '', dueDate: '', status: 'todo', waitingFor: '', checklist: [],
      timerRunning: false, timerStart: null, timerElapsed: 0,
      createdAt: getBrasiliaDate(), completedAt: '',
      scheduledStart: value, scheduledDurationMin: cDur, recurrence: cRecur, agendaOnly: true, history: [histEntry('created')],
    };
    setTasks((prev: any) => [...prev, newTask]);
    setCreateSlot(null);
  };

  const durationOf = (t: any) => (t.scheduledDurationMin && t.scheduledDurationMin > 0 ? t.scheduledDurationMin : (t.durationMin && t.durationMin > 0 ? t.durationMin : 60));

  const beginDrag = (e: React.PointerEvent, task: any, mode: 'place' | 'move') => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { task, mode };
    setGhost({ x: e.clientX, y: e.clientY, label: task.title });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const beginResize = (e: React.PointerEvent, task: any, blockTop: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { task, mode: 'resize', blockTop };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const resolveDrop = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y);
    const col = el ? (el as Element).closest('[data-cal-day]') : null;
    if (!col) return null;
    const idx = parseInt(col.getAttribute('data-cal-day') || '-1', 10);
    if (idx < 0) return null;
    const rect = col.getBoundingClientRect();
    const rawMin = ((y - rect.top) / ROW_H) * 60;
    const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(rawMin / 15) * 15));
    return { dayIndex: idx, hour: Math.floor(snapped / 60), minute: snapped % 60, minutes: snapped };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === 'resize') {
      const rawMin = ((e.clientY - d.blockTop) / ROW_H) * 60;
      const snapped = Math.min(24 * 60, Math.max(15, Math.round(rawMin / 15) * 15));
      resizeRef.current = { id: d.task.id, dur: snapped };
      setResizePreview({ id: d.task.id, dur: snapped });
    } else {
      setGhost({ x: e.clientX, y: e.clientY, label: d.task.title });
      const drop = resolveDrop(e.clientX, e.clientY);
      setDropHint(drop ? { dayIndex: drop.dayIndex, minutes: drop.minutes, dur: durationOf(d.task) } : null);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.mode === 'resize') {
      const rp = resizeRef.current; resizeRef.current = null;
      if (rp) setDuration(rp.id, rp.dur);
      setResizePreview(null);
      return;
    }
    setGhost(null);
    setDropHint(null);
    if (!d) return;
    const drop = resolveDrop(e.clientX, e.clientY);
    if (!drop) return;
    const day = days[drop.dayIndex];
    if (!day) return;
    if (d.mode === 'place') {
      setScDuration(d.task.scheduledDurationMin && d.task.scheduledDurationMin > 0 ? d.task.scheduledDurationMin : (d.task.durationMin && d.task.durationMin > 0 ? d.task.durationMin : 60));
      setScLabel('reuniao');
      setScheduleChoice({ task: d.task, day, hour: drop.hour, minute: drop.minute });
    } else {
      const start = new Date(day); start.setHours(drop.hour, drop.minute, 0, 0);
      setSchedule(d.task.id, toLocalInput(start));
    }
  };

  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const todayKey = new Date().setHours(0, 0, 0, 0);
  const weekLabel = `${pad(days[0].getDate())}/${pad(days[0].getMonth() + 1)} – ${pad(days[6].getDate())}/${pad(days[6].getMonth() + 1)}`;
  const shiftWeek = (dir: number) => setWeekStart(prev => { const d = new Date(prev); d.setDate(prev.getDate() + dir * 7); return d; });
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); setWeekStart(d); };
  const hintTime = dropHint ? `${pad(Math.floor(dropHint.minutes / 60))}:${pad(dropHint.minutes % 60)}` : '';

  return (
    <div className="flex flex-col h-full fade-in gap-5" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <p className="text-sm text-neutral-400 text-center max-w-2xl mx-auto shrink-0">
        Arraste uma demanda de "A Agendar" para o dia e horário em que vai atuar — o card é agendado ali (o status não muda) e o Google Agenda abre já preenchido. Ou clique num horário vazio para criar um novo evento. Arraste a borda inferior de um bloco para ajustar a duração.
      </p>

      {/* A agendar */}
      <div className="shrink-0">
        <h3 className="text-[10px] font-bold text-neutral-500 mb-3 uppercase tracking-[0.2em] ml-1">A Agendar ({unscheduled.length})</h3>
        {unscheduled.length === 0 ? (
          <div className="text-center text-xs text-neutral-600 py-5 border border-dashed border-[#27272a] rounded-2xl">Todas as demandas ativas já estão agendadas.</div>
        ) : (
          <div className="flex gap-2 overflow-x-auto kp-scroll pb-2">
            {unscheduled.map((t: any) => (
              <div key={t.id} onPointerDown={(e) => beginDrag(e, t, 'place')} style={{ touchAction: 'none' }}
                className="shrink-0 w-56 cursor-grab active:cursor-grabbing rounded-2xl bg-[#12121a] border border-[#27272a] hover:border-teal-500/40 p-3.5 select-none transition-colors">
                <div className="flex items-start gap-2">
                  <GripVertical size={16} className="text-neutral-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{t.title}</div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mt-1 flex items-center gap-2 flex-wrap">
                      {clientName(t.clientId) && <span className="flex items-center gap-1 truncate"><Building2 size={10} /> {clientName(t.clientId)}</span>}
                      <span>{t.durationMin > 0 ? `${t.durationMin}min` : '60min'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navegação de semana */}
      <div className="flex flex-col items-center gap-3 shrink-0 border-t border-[#27272a] pt-4 sm:flex-row sm:justify-center">
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => shiftWeek(-1)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 transition-colors shrink-0"><ChevronLeft size={18} /></button>
          <span className="text-base sm:text-sm font-bold text-white px-2 whitespace-nowrap">{weekLabel}</span>
          <button onClick={() => shiftWeek(1)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 transition-colors shrink-0"><ChevronRight size={18} /></button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />
          <button onClick={goToday} className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors shrink-0">Hoje</button>
          <button onClick={() => setWeekdaysOnly(!weekdaysOnly)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors shrink-0 ${weekdaysOnly ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white'}`} title="Alternar fim de semana">{weekdaysOnly ? 'Dias úteis' : 'Todos os dias'}</button>
        </div>
      </div>

      {/* Grade 24h */}
      <div ref={gridScrollRef} className="flex-1 overflow-auto kp-scroll border border-[#27272a] rounded-2xl bg-[#0d0d12] min-h-[240px]">
        <div className={`flex ${weekdaysOnly ? 'w-full' : 'min-w-max'}`}>
          {/* Gutter de horas */}
          <div className="sticky left-0 z-20 bg-[#0d0d12] border-r border-white/5 shrink-0" style={{ width: 46 }}>
            <div className="h-9 border-b border-white/5" />
            {hours.map(h => (
              <div key={h} className="text-[9px] font-mono text-neutral-600 text-right pr-2" style={{ height: ROW_H }}>
                <span className="relative -top-1.5">{pad(h)}:00</span>
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {visibleDays.map((day, i) => {
            const dayTasks = tasksOnDay(day);
            const isToday = new Date(day).setHours(0, 0, 0, 0) === todayKey;
            const showHint = dropHint && dropHint.dayIndex === i;
            return (
              <div key={i} className={`border-r border-white/5 ${weekdaysOnly ? 'flex-1 min-w-[100px]' : 'shrink-0'} ${isToday ? 'bg-teal-500/[0.04]' : ''}`} style={weekdaysOnly ? undefined : { width: 150 }}>
                <div className={`h-9 sticky top-0 z-10 flex items-center justify-center border-b border-white/5 ${isToday ? 'bg-teal-600/20 text-teal-300' : 'bg-[#12121a] text-neutral-300'}`}>
                  <span className="text-[11px] font-bold uppercase tracking-widest">{dayNames[i]} {pad(day.getDate())}</span>
                </div>
                <div data-cal-day={i} className="relative cursor-pointer" style={{ height: 24 * ROW_H }} onClick={(e) => openCreateAt(e, day)}>
                  {hours.map(h => (
                    <div key={h} className="absolute left-0 right-0 border-b border-white/5 pointer-events-none" style={{ top: h * ROW_H, height: ROW_H }} />
                  ))}

                  {/* Indicador ao vivo de onde vai cair */}
                  {showHint && (
                    <div className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-teal-400 bg-teal-400/15 pointer-events-none z-30 flex items-start justify-center" style={{ top: (dropHint!.minutes / 60) * ROW_H, height: Math.max(ROW_H * 0.6, (dropHint!.dur / 60) * ROW_H) }}>
                      <span className="text-[10px] font-mono font-bold text-teal-200 mt-1 bg-black/40 px-1.5 py-0.5 rounded">{hintTime}</span>
                    </div>
                  )}

                  {dayTasks.map((t: any) => {
                    const s = new Date(t.scheduledStart);
                    const top = (s.getHours() + s.getMinutes() / 60) * ROW_H;
                    const dur = (resizePreview && resizePreview.id === t.id) ? resizePreview.dur : durationOf(t);
                    const bh = Math.max(ROW_H * 0.6, (dur / 60) * ROW_H);
                    const cn = clientName(t.clientId);
                    const isDragging = dragRef.current && dragRef.current.task && dragRef.current.task.id === t.id && dragRef.current.mode === 'move';
                    const isDone = t.status === 'done' || t.status === 'formalize';
                    const isCancelled = t.status === 'cancelled';
                    const isClosed = isDone || isCancelled;
                    const blockColor = isDone ? 'bg-emerald-500/10 border-emerald-500/30' : isCancelled ? 'bg-neutral-500/10 border-neutral-500/30' : 'bg-teal-500/15 border-teal-500/40';
                    return (
                      <div key={t.id} onClick={(e) => e.stopPropagation()} className={`absolute left-1 right-1 rounded-lg ${blockColor} overflow-hidden group ${isDragging ? 'opacity-40' : ''} ${isClosed ? 'opacity-70' : ''}`} style={{ top, height: bh }}>
                        <div onPointerDown={(e) => !isClosed && beginDrag(e, t, 'move')} style={{ touchAction: 'none' }} className={`h-full p-1.5 select-none ${isClosed ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}>
                          <div className={`text-[9px] font-mono font-bold leading-none mb-1 flex items-center gap-1 ${isDone ? 'text-emerald-300' : isCancelled ? 'text-neutral-400' : 'text-teal-300'}`}>
                            {isDone && <CheckCircle2 size={9} />}
                            {t.recurrence && t.recurrence !== 'none' && <span className="flex items-center gap-0.5"><RotateCcw size={8} />{recurLabel(t.recurrence)}</span>}
                            {pad(s.getHours())}:{pad(s.getMinutes())} · {dur}min
                          </div>
                          <div className={`text-[10px] font-bold leading-tight line-clamp-2 ${isClosed ? 'text-neutral-300 line-through' : 'text-white'}`}>{t.title}</div>
                          {cn && bh > ROW_H && <div className="text-[8px] text-teal-300/70 uppercase tracking-widest font-bold mt-1 truncate">{cn}</div>}
                        </div>
                        <div className="absolute top-1 right-1 flex gap-1">
                          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { const d = new Date(t.scheduledStart); setEsDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); setEsTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`); setEsDur(durationOf(t)); setEditSchedule(t); }} className="p-1 rounded bg-black/40 text-neutral-400 hover:text-white hover:bg-black/60" title="Editar horário/duração"><Pencil size={11} /></button>
                          {t.templateId ? (
                            <span className="p-1 rounded bg-purple-500/30 text-purple-200" title="Gerado por uma recorrência — mover isto não muda o padrão, só esta ocorrência"><RotateCcw size={11} /></span>
                          ) : (
                            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => cycleRecurrence(t.id)} className={`p-1 rounded hover:bg-black/60 ${t.recurrence && t.recurrence !== 'none' ? 'bg-teal-500/50 text-white' : 'bg-black/40 text-neutral-400 hover:text-teal-300'}`} title={t.recurrence === 'daily' ? 'Repete todo dia (clique: semana)' : t.recurrence === 'weekly' ? 'Repete toda semana (clique: parar)' : 'Repetir (clique: dia → semana)'}><RotateCcw size={11} /></button>
                          )}
                          <a href={buildGCalLink(t, cn)} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()} className="p-1 rounded bg-black/40 text-teal-300 hover:bg-black/60" title="Abrir no Google Agenda"><ExternalLink size={11} /></a>
                          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { if (t.agendaOnly) { onDeleteTask(t.id); } else { setSchedule(t.id, ''); } }} className="p-1 rounded bg-black/40 text-neutral-400 hover:text-red-400 hover:bg-black/60" title={t.agendaOnly ? 'Excluir evento' : 'Desagendar'}><X size={11} /></button>
                        </div>
                        {!isClosed && <div onPointerDown={(e) => { const rect = (e.currentTarget.parentElement as Element).getBoundingClientRect(); beginResize(e, t, rect.top); }} style={{ touchAction: 'none' }} className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize bg-teal-500/40 opacity-0 group-hover:opacity-100 transition-opacity" title="Ajustar duração" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fantasma colado ao cursor */}
      {ghost && (
        <div className="fixed z-[300] pointer-events-none px-3 py-2 rounded-lg bg-teal-600 border border-teal-400 shadow-2xl text-[11px] font-bold text-white max-w-[220px] truncate" style={{ left: ghost.x, top: ghost.y, transform: 'translate(-50%, 18px)' }}>
          {ghost.label}
        </div>
      )}

      {scheduleChoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center px-3 pt-3 pb-24 sm:p-4 z-[95] fade-in" onClick={() => setScheduleChoice(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-[#12121a] border border-[#27272a] shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-[#27272a] bg-[#0f0f13]">
              <h3 className="font-display font-bold text-lg text-white">Como agendar?</h3>
              <p className="text-[12px] text-neutral-400 mt-1 leading-snug truncate">{scheduleChoice.task.title} · {pad(scheduleChoice.hour)}:{pad(scheduleChoice.minute)}</p>
            </div>
            <div className="p-5 flex flex-col gap-4 bg-[#09090b]">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Duração de hoje na Agenda</label>
                <div className="flex gap-2 mb-2">
                  {[30, 60, 90, 120].map(m => (
                    <button key={m} onClick={() => setScDuration(m)} className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${scDuration === m ? 'bg-teal-500/15 text-teal-300 border-teal-500/40' : 'bg-[#12121a] text-neutral-500 border-[#27272a] hover:text-neutral-300'}`}>{m < 60 ? `${m}min` : `${m / 60}h${m % 60 ? '30' : ''}`}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={5} step={5} value={scDuration} onChange={e => setScDuration(Math.max(5, parseInt(e.target.value) || 0))} className="w-24 bg-[#12121a] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
                  <span className="text-[11px] text-neutral-500">minutos exatos {![30, 60, 90, 120].includes(scDuration) && <span className="text-amber-400 font-bold">(valor já agendado)</span>}</span>
                </div>
                <p className="text-[10px] text-neutral-600 mt-2 ml-1 leading-relaxed">Isso só define o bloco na Agenda — não altera o "Est. Minutos" da demanda.</p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Como aparece no Google Agenda</label>
                <div className="flex gap-2">
                  {[{ v: 'reuniao', l: 'Reunião' }, { v: 'foco', l: '🎯 Foco' }, { v: 'tarefa', l: '✅ Tarefa' }].map(o => (
                    <button key={o.v} onClick={() => setScLabel(o.v)} className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${scLabel === o.v ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40' : 'bg-[#12121a] text-neutral-500 border-[#27272a] hover:text-neutral-300'}`}>{o.l}</button>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-600 mt-2 ml-1 leading-relaxed">"Foco"/"Tarefa" só ajustam o título do evento — o Google não libera o bloco nativo de concentração por link direto (precisaria de acesso OAuth da organização).</p>
              </div>
              <button onClick={() => { doMeeting(scheduleChoice.task, scheduleChoice.day, scheduleChoice.hour, scheduleChoice.minute, scDuration); setScheduleChoice(null); }} className="flex items-start gap-3 text-left p-4 rounded-2xl border border-[#27272a] bg-[#12121a] hover:border-teal-500/40 transition-colors">
                <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 shrink-0"><CalendarDays size={16} className="text-teal-400" /></div>
                <div>
                  <div className="text-sm font-bold text-white">Marcar reunião</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 leading-snug">Só marca o horário. Não muda a etapa e não abre o Google Agenda.</div>
                </div>
              </button>
              <button onClick={() => { doExecute(scheduleChoice.task, scheduleChoice.day, scheduleChoice.hour, scheduleChoice.minute, scDuration, scLabel); setScheduleChoice(null); }} className="flex items-start gap-3 text-left p-4 rounded-2xl border border-[#27272a] bg-[#12121a] hover:border-indigo-500/40 transition-colors">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shrink-0"><Play size={16} className="text-indigo-400" /></div>
                <div>
                  <div className="text-sm font-bold text-white">Vou executar</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 leading-snug">Move para "Em Andamento" e abre o Google Agenda preenchido.</div>
                </div>
              </button>
            </div>
            <div className="px-6 py-4 border-t border-[#27272a] bg-[#0f0f13] flex justify-end">
              <button onClick={() => setScheduleChoice(null)} className="text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-xl text-neutral-500 hover:text-white transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {editSchedule && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center px-3 pt-3 pb-24 sm:p-4 z-[95] fade-in" onClick={() => setEditSchedule(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-[#12121a] border border-[#27272a] shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-[#27272a] flex items-center justify-between bg-[#0f0f13]">
              <div>
                <h3 className="font-display font-bold text-lg text-white">Editar horário</h3>
                <p className="text-[12px] text-neutral-400 mt-1 leading-snug truncate">{editSchedule.title}</p>
              </div>
              <button onClick={() => setEditSchedule(null)} className="p-2 rounded-xl text-neutral-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 flex flex-col gap-5 bg-[#09090b]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Data</label>
                  <input type="date" value={esDate} onChange={e => setEsDate(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Hora</label>
                  <input type="time" value={esTime} onChange={e => setEsTime(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Duração</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {[30, 60, 90, 120, 180].map(m => (
                    <button key={m} onClick={() => setEsDur(m)} className={`flex-1 min-w-[64px] py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${esDur === m ? 'bg-teal-500/15 text-teal-300 border-teal-500/40' : 'bg-[#12121a] text-neutral-500 border-[#27272a] hover:text-neutral-300'}`}>{m < 60 ? `${m}min` : `${m / 60}h${m % 60 ? '30' : ''}`}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={5} step={5} value={esDur} onChange={e => setEsDur(Math.max(5, parseInt(e.target.value) || 0))} className="w-24 bg-[#12121a] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
                  <span className="text-[11px] text-neutral-500">minutos exatos {![30, 60, 90, 120, 180].includes(esDur) && <span className="text-amber-400 font-bold">(valor já agendado)</span>}</span>
                </div>
                <p className="text-[10px] text-neutral-600 mt-2 ml-1">Funciona mesmo se a demanda já estiver "Em Andamento" — ajusta só o horário e a duração na Agenda, sem tocar no "Est. Minutos" da demanda.</p>
              </div>
            </div>
            <div className="px-6 py-5 border-t border-[#27272a] bg-[#0f0f13] flex flex-col gap-3">
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setEditSchedule(null)} className="text-xs font-bold uppercase tracking-widest px-5 py-3.5 rounded-xl text-neutral-500 hover:text-white transition-colors">Cancelar</button>
                <button onClick={() => {
                  if (!esDate || !esTime) return;
                  setTasks((prev: any) => prev.map((t: any) => t.id === editSchedule.id ? { ...t, scheduledStart: `${esDate}T${esTime}`, startDate: (t.agendaOnly || t.generatesCards) ? t.startDate : esDate, scheduledDurationMin: esDur } : t));
                  setEditSchedule(null);
                }} className="flex-1 text-xs font-black uppercase tracking-widest px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)]">Salvar horário</button>
              </div>
              {!editSchedule.agendaOnly && !editSchedule.generatesCards && (
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 mr-1">Ou marcar como:</span>
                  <button onClick={() => {
                    if (!esDate || !esTime) return;
                    setTasks((prev: any) => prev.map((t: any) => t.id === editSchedule.id ? { ...t, scheduledStart: `${esDate}T${esTime}`, startDate: esDate, scheduledDurationMin: esDur, isMeeting: true } : t));
                    setEditSchedule(null);
                  }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-teal-500/30 text-teal-300 bg-teal-500/5 hover:bg-teal-500/15 transition-colors"><CalendarDays size={12} /> Reunião</button>
                  <button onClick={() => {
                    if (!esDate || !esTime) return;
                    const value = `${esDate}T${esTime}`;
                    setTasks((prev: any) => prev.map((t: any) => t.id === editSchedule.id ? { ...t, scheduledStart: value, startDate: esDate, scheduledDurationMin: esDur, status: 'inprogress', isMeeting: false } : t));
                    const link = buildGCalLink({ ...editSchedule, scheduledStart: value, scheduledDurationMin: esDur }, clientName(editSchedule.clientId));
                    if (link !== '#') window.open(link, '_blank', 'noopener');
                    setEditSchedule(null);
                  }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-indigo-500/30 text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/15 transition-colors"><Play size={12} /> Vou executar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {createSlot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center px-3 pt-3 pb-24 sm:p-4 z-[95] fade-in" onClick={() => setCreateSlot(null)}>
          <div className="w-full max-w-md rounded-3xl bg-[#12121a] border border-[#27272a] shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-[#27272a] flex items-center justify-between bg-[#0f0f13]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 rounded-xl border border-teal-500/20"><CalendarDays size={18} className="text-teal-400" /></div>
                <div>
                  <h3 className="font-display font-bold text-lg text-white">Novo evento</h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Reunião, atividade ou demanda</p>
                </div>
              </div>
              <button onClick={() => setCreateSlot(null)} className="p-2 rounded-xl text-neutral-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 flex flex-col gap-5 bg-[#09090b]">
              {cErr && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2"><AlertTriangle size={14} className="shrink-0" /> {cErr}</div>}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Título *</label>
                <input autoFocus value={cTitle} onChange={e => { setCTitle(e.target.value); setCErr(''); }} onKeyDown={e => e.key === 'Enter' && createEvent()} className="w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-teal-500 transition-colors" placeholder="Reunião, almoço, academia, demanda..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Data</label>
                  <input type="date" value={cDate} onChange={e => setCDate(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Hora</label>
                  <input type="time" value={cTime} onChange={e => setCTime(e.target.value)} className="w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-teal-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Cliente</label>
                <div className="relative">
                  <select value={cClient} onChange={e => setCClient(e.target.value)} className="appearance-none w-full bg-[#12121a] border border-[#27272a] rounded-xl pl-4 pr-10 py-3.5 text-sm text-white outline-none focus:border-teal-500 cursor-pointer transition-colors">
                    <option value="" className="bg-[#1c1d26]">Pessoal / sem cliente</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id} className="bg-[#1c1d26]">{c.name}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Duração</label>
                <div className="flex gap-2">
                  {[30, 60, 90, 120].map(m => (
                    <button key={m} onClick={() => setCDur(m)} className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${cDur === m ? 'bg-teal-500/15 text-teal-300 border-teal-500/40' : 'bg-[#12121a] text-neutral-500 border-[#27272a] hover:text-neutral-300'}`}>{m < 60 ? `${m}min` : `${m / 60}h${m % 60 ? '30' : ''}`}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Repetição</label>
                <div className="flex gap-2">
                  {[{ v: 'none', l: 'Não repete' }, { v: 'daily', l: 'Todo dia' }, { v: 'weekly', l: 'Toda semana' }].map(o => (
                    <button key={o.v} onClick={() => setCRecur(o.v)} className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-colors ${cRecur === o.v ? 'bg-teal-500/15 text-teal-300 border-teal-500/40' : 'bg-[#12121a] text-neutral-500 border-[#27272a] hover:text-neutral-300'}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setCShowBoard(!cShowBoard)} className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors ${cShowBoard ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-[#12121a] border-[#27272a]'}`}>
                <span className="flex flex-col text-left">
                  <span className="text-sm font-medium text-white">Mostrar no quadro</span>
                  <span className="text-[10px] text-neutral-500">Aparece como demanda no Kanban (senão fica só na Agenda)</span>
                </span>
                <span className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ml-3 ${cShowBoard ? 'bg-indigo-500' : 'bg-[#27272a]'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${cShowBoard ? 'left-[18px]' : 'left-0.5'}`} /></span>
              </button>
            </div>
            <div className="px-6 py-5 border-t border-[#27272a] bg-[#0f0f13] flex items-center justify-end gap-3">
              <button onClick={() => setCreateSlot(null)} className="text-xs font-bold uppercase tracking-widest px-5 py-3.5 rounded-xl text-neutral-500 hover:text-white transition-colors">Cancelar</button>
              <button onClick={createEvent} className="text-xs font-black uppercase tracking-widest px-8 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)]">{cShowBoard ? 'Detalhar' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// Assinatura fixa da Rubeus, embutida em base64 (não depende de link externo)
const RUBEUS_SIGNATURE_IMG = "data:image/png;base64,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X8dPV6NlvqCBu3w+73ke5zwSiShXJuAdKFBRcUVN04rF4u7duyORSDabvf7661//+tcDwDnnnOO67n333RdmFihIy+fz11xzzdVXXw0A559//vDw8J49e6SU5513nqK0nX/++ZOTk7/85S+FEIODg+EfiW3b73//+1/zmteoU9i2/eCDDxqGsXXr1te//vWKp+B5Xjqd/vSnP51OpwFg/fr173vf+0qlUiaT2bNnT1tbm+piPmvWLDVOd3f3xRdfvHv37lgstn37dhXia2FSy1oGZWG2iga2rAp4hxyRkPi32k05TJWW4eUu4IHGtqxTAYdgt+DAMqoFCuJ1Z6S6aYS7p0NVCVZWph3sGYwgEZAxx3WveN87zIhFvo+cZW67296xl0WiGEKjmu7nNVx3QgY8Yoi+bj5/DuvsYJFIELZKptqj8SRjLF8sMV13HS9bKI1PjCNwL5uVjiOpQvP1PElS9amQhD4I4lFCjQCYYREhyUrkkzEgkhKkK6XjIAIwASSQOHmuBJAlGxzHswteyZZSAkkCcqXM50uO53HD0jXBNS1fKM7qm9vV01fWuEWAZBLnzTGXLzF62lHjBEiSCCQgEjJCrPOaq0R9KdEyvd0Hcl+9GRgDKV+4L2IkElHFsMViUfUaD4gDiKhpmq7rhmEwxqanpwuFgorInX766b7v27YtpTzzzDPDkgdhW7BggZSyVCoR0Zw5czzP831/7ty5UspisSilXLRokSJtO44DFfad7/vxePzUU08NTnHWWWcp1JyYmAh2s2172bJl6XTa8zzP89rb25ctW1YqlRBxYmJiZGTE8zxd148fP/7mN7/5zW9+8+te97p//dd/LZVKExMTx44da3VLatnL3CsKB+6EnGFfCEsuQCUHEizYRKHMDSCU6WlYFqmpuizKmZHVIcLxtwqvAUJSAuX8TZWa0CQ1NXNksEyXYFjI5xdvWLvhovOk73MhvJGxqRvu4PE4yue4QxUitOSCi/YkX9CPs3swEWW6VrkzsGjpsr7enr17d3uux4ksXZO+ZJ6fjie7evokou97nss86flkIHLp+77nMSYk13zUORGA6kfBkEgCARdABMhACJISfY+QSyCJ3Hd8n4gkoBmVnocggEqMCBgTyKK6IUxzenzMtl1d17jQM1MTmm4AAIFEVbylCejuFEsXWs8edSemndEsSPKp3BUkLKGuVv8agXDps1Qi/80fWle+UizofyECd+p72d3dnU6nJycnC4XCli1brrzySt/3fd9XfOsHHnjA933HcZYvX97e3q4O9H1fcQSCLFRTP09Bi0rwBMQ2dbjaqNrozRROVLsFpwgcrzpHKnyU4zhqGpxz1WNQAdW5556rKHnRaFQI4fu+aZrYjBDUspa9fPJG4Z+SmHl9qVMWbUSsWpDAUDYolCyiZgNWs0LlHHpNb4vQllDSqe7AmTCpnP9hhHjFn1/DGJOeB4hT37ldTk6LdAp8qBGkqEQjsaazhmQMRNzS5vSy+XOgvZ2ZkfKNIgJE13Hsku16PhEZmojFoq5td8Si8/v6DMt07IJEjp5HxLimIRETmkReLJaEwYk5pmURoE/ISILvKd43IUNAxoUPvkQGgETkE/OkS4TSV/QIjxiTBL7r+D4DJsj1fd+Px+KZ7BAimJaVI0gkUlBXNhaPQv8sY8USY/C4ly36RRdIVjiSDKC+ExKFSfqC0+R09t+/nf7SJ+EFWDoVYFiWdcYZZ9xyyy3JZPJ73/teb2/vxo0bAaBYLH7rW9+6+eabI5HI1NTUF7/4xUWLFsXj8fHxcdd177zzzg984AOGYbiue++99wohmi7uv0PnPZW7yufz99xzzzvf+U7DMEql0j333KPO1dvbG+SoTNPcuXPnzp07V6xYAQBPP/30jh07LMtyHKenp6etrU3TNCmlrut/8zd/owY/cODA+Pg4AChKYVBR27KWvcxNUCXN85xFRBX9HwpJ2yHMvEQF6Z46FAlx+QibYUx9p1esORaDFNcMc2aMFfOF5aetX3nmqdL3mRDOoaPZ+37NE3HwZU2nJSQEkGEpcdUlA4Hpgnel+cJ52NvNYjHURBiJE6mUMHQi37QMwzBBUtwyVyxf2jurVzolT0oi0gwzZ9sDu/cQF5owCoX86Ni4rul93X1zZs/uaGuLpdMaEHgOcVFuxW6YIMkrFchxANF33EK+mC/lbdcTiIjIUDKUXDPcTNb1wSbGYwl2fEgILRaNSSQuWCIRSabSFZytGOfQ2c4XLYgeOeYMT8qhSfJJErFAF1CJLgXJpDDj3vNZMl6685fOO67ST139QjhJKmP0pje96de//vXU1JRpmv/4j/+4bNmyZDJ5+PDho0eP9vb2jo6OXn755QqlNm7c+MMf/rCjo+POO+8cHh6eP3++goFYLKaiec+LSSlN07z55puPHDnS19f3+OOP79+/X53inHPOCeNWoVD41Kc+df7550spf/nLXxKR67rd3d3Lli2LRCKLFi06ePDg4ODgxz72sfPPP39wcPCWW25R2kh/8zd/owiErZWoZS2DQKlBkX9P6IFQyJtRLAakE+xc0eGhmphfPSpRnY9FTXcOJbSIqnKrGEifhvtEEDGURK9825WBVzh5wx1QLGEy2VD3SjLUbokAgBEjQoY8ERFz+nDObEwnmWHUSwAguHZBCIGAyLhpWj1d7d3dPRVBGih5/tDRgYmhYc41wzR93xsbG/cAScqnd+1pT6ZXLVy4aH5/T2+vaUVFxOSGSYi+XXK9rFfMO8XS+NjY8aGRwdGxo6NDxWIxakWSiVg8Ee/sSOmaoZumky+6vkwmU23tnWOHDui6RgC6rmE0EleAVGcRC2b3aMsXm4ePudN5P1cKGojUKWyUS9Bqny7I83Jf+X7bN//5BYomSyk7Ojr+7u/+7tOf/vTIyIhlWU8//bSUUgghhBgeHj7ttNP+4i/+Qn2gb3nLWx599NEjR44kk8nHHnts8+bNvu/39fUVCoVwGims1hO+usbtM200TdMwjHvvvdcwDMMwTNMcHh5+5StfqQBJRdtc100kEplM5qabbjIMw7IsKWUul/vABz4Qi8UA4P3vf//f/u3flkqlxx9/fOvWrQBgmmapVLrqqqve9KY3BeM858xb1rKXfPhO1GjWAdZx1aqJmZqKWFT5Dgi31wvHzQjrYn1Y5lGHInVhlnmV1hYw57BhzAq3QpUHVbMfFbodAQEwxkvF4vzVy9aevZGk5EI4hwaKDz7GY9E6NGIqdxUI51ScOkRAU9N6O/nCeay7g0UjKHj4zgFiLpuzCyXfl4ZpMmSReCzd3s45dx0biTzPPzY+nZ2c7El3zOrskB6Zhm6sXDU+OTGVzeTzJafkTOdzx0dGPcftaG+LpdNG1OemZeemPd8ruc7owLEjg0NHh4cODgy6jhuLWS4v2QXkiE8MDkrfT3W2d8+ei4wbnEWjESIiQNe1Y8m4zo0ly1c1hlUBEdpSuLDfWrHQOT5cLA2TE9AZkJCAIcra1GA1kyRZPGb/4lFn2zP6hlUvkJMkpVy5cuWXvvSlH/zgB1u3bp2enlay393d3RdccMGVV16paZr64ra1tX32s5/9z//8zx07dgghTNO88MILV6xY8e///u+6rgdEOyGEpml1+kCqVEh5NnUbGWPBsQojdV3/4Ac/eOutt+7atUtN5o1vfON73vMelUPinBuG4XnemjVrNmzY8O1vfzufz0sp29ra/vf//t8XX3yxlBIRV61a9W//9m///d//vW/fPtu2ETGRSFx55ZXXXnutmoMqlVXQG545vIhbb7SsZc/vI2n5xXvOeS3Uh8SgKsFQhwl1fSiaZh2aJnZm6pcU8r+grg7qZIatksLLwUPOeW4q866/+/ArXneJ73pcE6P/+rXcj+8XDe4RIhLKuh88AnDOjO6kedoadvp6Nme2SCQw1K1Onclz3b+87tr77rtnwbz5KGUiHls0f8Hs9mQMSQMamsocHBptMyPzZvV0tyeTqU4zEpG+6zh2yXWyhVxmYrKYL1qWFdW09kS0s6s3Ek8ayXgxM1Eq2dO53NDw6PD4hOPZlmnGY4l4NG5FLc6ZbxeHRseGJiaePXa8rXfWwrlziIlDx44/+czTuWxeMzQtqqdjqS98/aZkW1uTDD8RTEzRtu35e381ve0Zb7JARLxc7iQRgNV+MiyU6SfG5HTGuupV6S9+8oWuSQKAUqk0NjZm23Y0Gu3u7g60UOteDAwMTE1Ntbe39/b2qiCYAhXFwJ6cnHRdFwASiYRpmuqoTCZTKpUAIBqNBsp4hUIhl8sBgGEYyWTy+PHj73vf+1Qd7je/+c1kMnnw4MFisdjd3d3R0RFMoO6oXC539OhRxtjcuXOD04VnOzQ0ND4+rmlaX1+fqpNVb9m2PT09rRTz2trawjNPJpOGYbwEnn8R8ciRI4lEIpVKvXhU21v2x/oyHD16dO/evfF4PBqNJpPJRCJhWZamaYKwQUU7iI7VtRMP8aKbxvfoRCAVjgw1poQa6Aw1+AehoFwzoKy250bHcdv7ek5/5TlAxITwRsYLv36UR+vdI2BE0IyRxUhEdW12D5s/FzvamGVhbe9UBJBSCk3r6etvT6TQl6ah64YuCV1JgL7QNM5FzDLbknFN48D4+PiInjM5w6mCnc/lDZS6MBzNyWQmvUgUwI9EI5FkkgvOyMtnJ4aHx8YyOd9321OpiGnqmmlFLE1w33GAi+6eLomy5HklCQzVo7SOjEtJmmEWpqcWz10YSySax1IRIRHH+f3misX2seFCfsC3fZKSqUgoomTqxlS92xonKRa179/sHTgiFs55gTBJJZNUrGz27NnBdkV1C2mTl5lps2fPVrsFvlR4NAVLdU9hiUQikUjUbYxEIpFIpOmDW7FYTCaTCxYsCCAzcLnCR0kpY7HY8uXL65A1cLYQsaenR8lA1I1jGEZXV9cJZt6yP0oE6TlR8yR3a9lvlUOa0YtqgKiZ3jrxCDP9+Zzj1JyRZhwktBNnpWzp/Fe8JpqIS8dlupa770E5mRGpFPiy3rlqRCMgLrhoT/H5c7GvlyXiZap3M4vEooJjJBoxdUGe5/m+63pSAxSCc55OJKyYVXJKA4NZEtqk7R48cmRiugCus6h/7qKuRG9f31TBmZic9P18Mp9plyWSHjKRt72RbDGbL3anUwYXE6MjQzmXmREEvzMRaUvEc7mcRD8ajXEqL8qMM920NLNYKBQ448tWreFCEMlaHYqKaYK6OsWSRZHDg+7opBzLko9SKUKEao3rw63Ku+JcTkwVbrk78bE/hxcsvRHu7xA0huANwkV1HSXq2k8E79YFBKCWbIoNNVhBVVDQaUL9qYhwdW0jwkMFUArN2k8E05tph5OZecv+kI/wJx9oajl8zysgMQxFvULJlLDXUyvXgHVpoyYMOWpo6Fo+C9b1Ka/PP4VaVASzqvPTgEIcsJo5S5KaZZ518QUqDE+uV/jZI8wwA/cICQjLjfugppUtAhJnyKOWmNPD5vezthQzDGzuBBAAnHbGprtvvdlxnaihWZGIlNLzpBRcEnCEjmRCaDg9kTs0OjE8nZ8YGzs2cKh/8WrKjfWe9iaWGc8ePTJ7yVK3mHNc6TqOPTWuG6ZfypHvuK7Tnk5393SMHzs+xmO/3Hyr3j5/8Mj+9vbkonkLFvb3WBrXNIMBB+AAxJAjkRCadB3LshYuWVH5kczwmcdiMKfPWLHEOHrMyxX9vFNuroiqjV+Noq2qGWYESEBSYsQq3fWr+Afe/kIrrmJV5/C50asRYE6wmp/kRq9iAaI0rXA6wWSec7YnHqq1Nv0R0Wh0dLRQKMydO3cmsFHbDx06lEgk2tvbW5j0vMVIAvWEkHRCmXJWVWQIlEcRCVFiSHwhJJFAlWfqymhIIYUFtUWG5FnDig9lsYQKuMnwrCpaDxBshGDw6pwRsWQ7/UsWzF++mKRkDEtP7nQPHmWGWS3jxQrru9x+r6zpAyARiGlc60yJ+XOxpxNjUTZDKxrleczvm71+3nwvMxWPWDHLApKe9H1JjuPFI2Y8qkejZqZY3P70Tt3xz930inXLl6W5s3b1mvnxaG8ibkXispTtSFhRU3emx8EuMuBuPlMYHTJ11tlmTR08yJi+dMWK5cuWWt7EnDZz9ZrTPJsefGRLplSKRI1ETOOCETApfU3TYtGYbZdMK7p87alQR0Jp8COhs40tmmctW6S3JZAHbMkyRbDRaaZA8sk0vINH7V9tUVGnl+qvAhHjFWstNH9yiCJrLdwrJOzUhmUPw35qLpf70S23cMahtglk8CLwdBmyH/7gB6rSoJHMOdOBTRmVTa/iBNfYdKg6FUeopWv+SfA2RdOH3GrOpjZlI1XVaS2ru8qCgHAlbFk1AerkGdStqWsy0egvhe4bNSTmm0+ZM9d1T9m0kXHmuy5nLP+L35D0kQH5TWKBiu0deF2IKOKWNm82zulj6SQzDJj5yWhq6Pjm//riOXP7z507Z4LRvvHJacdDRJ/QcZ10IiI4EMqYLk5dsnD2rHnpRHzOua+JxCKJRETzCyxqGWvX5koFd+iogSgANDMudAuQe6VSJJJC0OauW08SirnpSy54Td6R46NjvutRe9vBuJGbmjT6umOxWNGREkjnwopELd1l49rpHe3+8AD0znoO38UyYXavvnyReWTQnc562RKWy2SJAWJD78MQEZwQoPjTX5iXnA8vxZVawU9XV9eXv/xl9VnH4/GWy/Kn9QnO5ASfuH9jELC9++67T1m/fnb/7CAR6HmeECKcFFR5wbnz5q5cufLee++96qqrVFKw7nSNB568y36Cr9xMb4Vn27jnn8R3WNRGdrDijVT7f4eCbhAKmYXjXVTpJVFbCFtOS7CaEs1y4UtQhBpucFENw1GYQ1cpfaotP6qDGCYJjEjklE2nAQATQubypa1PM8uq6cKH1ZmFfWxEEKamzeriC+exni6MxLBWo7MOD0f37Skc2DtFvH/58qXzenl06NHdB6RPjucJjXMgQxM+x76+rnjETCfjVpQbumXpGqJNjAHwYsEuZsYNcnO2wxiTIKV0rURnLNlWyOQhFs/bUkdE8BM6T1hGm9UhuZ7JZDXdi1gibmBE566PtpSAYOnast7OjatXOuA88t9fPfeD6Y4Fi2dMIylPN51kC+ZbK447x0b84hA5EsvMeZJl77HZ11dKjFr2o0/6I+O8q/2F7pP0R4sbMJZMJluL+59itG14ePjxbduEpqmnqEQiuWbtGsuyjh8//thjj/X3959yyikAoHRyGeI5556rGPYKjSYmJiYmJpSUuxJOvOeee5SS4erVqzds2HD42cMPPHD/kiVLzzn3HCnlWZs2fe2/vjY1NRWwB9X/uVzu7rvuLpaKqphBNfH65S9++ezhZy3TJIBSqbRu3bp169bdddddI8PDl11+edCIRHFB/+enP730ssuSyWQ4HqheP/zww4cOHTJ0Q0lmMsYuv/xywzAeeuihQwcPMc5M07zooovi8fi2bdu2bd12zjlnL1227Ee3/AgAXnvlaw3DeLHFGAMfTjTIHeBMTl24DLa2/UQd8QFnOqrB+QmBUsPgNTLhdeM3di9nzCnZ/QvnzFk8H6RExopP7fGGx3gsBlJW2GJUK0FULrJFIi5QpON8/hycPYslEsx4jr7RWMgtm9M/PJ7bt2PvlOf2LJjVNzaVLbouE7bvyigDiTpnqPNIKqEJjsUcRyIW4cCFYUlksjSREHKi5JIvUWggfemW3FIWuSAf0S6ZbpGbMWGl3OI0eRkmfd93ddftMCHZmdJMXXouMpC+5nne7GTktBVLC+PTOx55Iuq7ozue6Viw+MQd5VHXobdLW7owcuioMzHtThRUJPQ5OggTgKbJkXHn4cetK18FUv5hGpz/sX4hLd/oTw6Qho4P/fQnP7WsCIH0PE/6csnSpe97//uGh4dvv/W2TeecvW7dOgAolUr33nMv52zjGWeoujR1+I4dO+bNnauq4lzXveGGGzZs2LBu3bpMJqPEQbp7uleuWrV7165zzj1H9a2f3T97165dSttXfVt837/xhhtWr169fsOGbDZ7yw9+2N7WtmDhwiNHjqxbt66/v1/tE41GSdIZZ5xx8003j4+PB4BERHf+z5179+59Rb7Q9MFo9apVixcvVueaGJ/4+c9/puv61q1b9+zZ88Y3vtE0zW1bt911551vfstblixZcvTIkYOHDi1fseLc88794Q9/WCwWX8yFBOX2EyHPp6qjWm6VE/5NVuNyVO3mRhRCCSVEFJJOqInOVWN8M2cLK95LtXK29gEBoBJVqj6eI0PHdZatW8U5V/G64qNPgvShvsqIQo4aISCQRAQeMbW+HjZ/DutsZ5EIsudYZHVdTyTjeQ8XpNJjo+OHfbcrGs0VpxzP1zXGdF0zTSEdS7eMqM5R+JJcDwRqViyicybdEpPeVMElzwOUzIiQLxEQpOfYDtN013bBdqIRKTQDEz3FQkF6PpCraUyiY7tF25ee63g2ecQFQP+svsGxyQNbti9uS/WmI9rJ8LERKRnDef3GyiXmsWE/fxhKfvhzkSEnqY7pAIj2Lx61rnwVvHQX6xYO/Yma0ISmaStWLn/DG96YzWVvvOGGffv2jY6ORiKRaCwaiUTUJ2saZiwaZbyeq3L8+PFVq1YpL7lUKm3cuFE1ETZNc8GCBYODg3Pnzp3V23vwwIHgkLlz5+7ffyD8zXEdd8OGDaeedpo6cPGSxUcHBhYsXKjp2ty5c8OcfpLU1taWTqcDwh7n/K677pozd04sHrMdu2nYLZ5IxCtbnn766XWnnIKIu3ftetWrXpVIJIjozLPOPHz48OjoaGdnZ1dX13QmAwA9PT3xWPxF/qMTsqprinU5nTKLIZwoCt0ZwJpgngx7Qoj1NUq1ThQ13acav8Nw9qiq61N3VIiwhwjI+coNawAAuSDPKz29G3UNZThgVxe7U5pDwAXT2lNi/hw2q5vF46CJ57xxRjJVIEQpI3ExP9795NAxMkyG4BIQkiQg5HqkLSoMAzVhGOAUCYnrltA5cl7MedJxOQqu6wbXjIhghgBkqOtMoK4LDr5TLEidRzss4GClYtIm8mxhGVK6edsmp5Qveq70fJKcYGRsQp/M97V3JkwyTTPa1XNSH78Q0NXBFy+IHB5wRsbckWmQqns7nchJkhJNw3l8B+ULf4Du5i1r2W9rKrev6ZphGJ7nJ1PJRCIxOTkJAPl8XrW8yufydZq26nWpWFSAQUSRSOTUU0/1PC+fz4+NjU1NTp5xxhkA4HqeDFUgtbW1FQtPhZHDtMxTTztNHTg+Pj48MvLqV78aAATnjz76aC6Xy+fylmVecumlqjTb98tZbs75zp07x0bHLrnkkhtvvJEhQkg8vrxkCxF48I5tHzx48K1vfWt5EaSgxxw6jjMxMdHZ2em4rjrW8zwp/Rfz8x8RCbU2S6hGP4kqWgzYGMerIVvLmvQSNBAOiJrgAIXTR1jpSltJLhEFvpki8hFRPQCWx6TQnF3fj7elFi5bDACMoXNo0BscAl0LPderMwbtyokREAFjyGOWmNPL5s9h7e3MtE5medWjMUTUIhFH+G1LF6Sy4wPjkxBNSMkZY8RNTzJfChSmHkkJwXg0xg2dMQYM3VJeaJoei9m2S07JjLJY1DCiMaZpyJhhCFtw0zQ0KfVYjJkxFCgiMXQ93/N8x5GSgee4ji+5DgLRhZLriFJxRU+nWyroiGY0mZgz72Sf8WMRmDtLX7HYOnLMy5ZkwcGQbmCNEm3oU0Vd8weHvV0HtFNXtwCpZS+uwJ0kwzAOHjj493/3Sdd1GedveetbotFoqVQyTfPAgQOf++d/IQDOmGWamlZdIsqBAUm6rgfARkQTExP33HPP8ePHL7jgAqWjUceG4JwHiBIEcqSUmUzmrrvuGhgYOO+885TAh+M4U5NTr37Nqy3T3LLlsdtuu+3tb397uPJsanLq17/61dXXXFPOhSADgPvuuy+bzQohXNft6up65StfGWS8nnr66Z6eHlWdvWTx4vvuu/9Nb36TaZoH9u8/cuTIWZvO+tNy+hGxRqmhHIFDqC1EDUNIUCtJarEKNTaqSjlQucY/3Fq2ylKo6UqBNQ0qQk5PfVCuWTKpHNxDxpySM3/p7FRHG/kSObN37peFIk8mwJ+Z5kjAkLiuad0d2oL5rLeTxSIg+MkguYjFQNMYOom2dg44K25o2HbQlj4CMiFd6QkEnQMgaho3hAACproKely3hOcyQy9mCtlsvlM3TCvJGBeRmGYXorFoPlfykenJqG5q6NsMBfN9AmRC84sl6blEjHwmJTJknKM3Nd0R56m5nZnDgxFipJlaLHGyXwHGoK2NLZpnLDtqD40WS+PoV5pQqdZW9U5sOUJKJdve9kwZkFrWshfTouZ53uz+/tNPP8227c2bH77v3vuWL19uGIbjuLP7+9etW4cAtu38+le/olC9XqXCutykMQCezs7Oa6+9Np/P33777el0etGiRXWEbN/3WW2QX5Vyp9Ppa665Jp/P33brbel0etmyZW9805sCtDvn3HP27d83NjbW2dmpTu37/h133H7+K14Rj8ellMhQkiSiiy++OOwhhV/s3LHj1a95jcLO0zdudD3v1ltv1YTWN7tv1epVdTD5on6MqBdXDVqQ1/EIECqq3lXICiulVlW6GVa9pHKQrVljCwQAkJWUE0H1ITws6lrJSlXFXqnBWVP7EgJnzPX9eUsWIoAvJefM3rUfkCEwVdEUOnd1bELJGePJqDa/H+fOxnQKdeMk1CcQiKLds2jeYm/rlv6OLs+1e3r7WL40Ojo5kSkikCt9gwB8l0mTnBIIExhngMAFIGNAnu/lcrbrIucUj0bNeEp1j+WakezoLtJQLud5UQ2MiOqIK22HmCDXIc8jFEiOYMK3HfJ8D6ADZZKY8N1UOulOZPWlK7XIbxNJi5jU16svW2IePuZM5ShboiojXkoi1izTh5y7T+yqcY9b1rIXBSKB53mdnZ1nbdoEAMMjIz9/4Gd79+5NJVPKwzj//PNV/Grz5s01z7ZEiGia5tTUVG9vLyKOj4+rlJLnedFodPWq1bt27Vq0aFG4hAgApqamItEIhJSEJicnjx49umbNGnXgKetP2bN797Jlyw4cOLBs6TJk5bgOr3paZOj62NjY6OjY0089vW3rNsbZwMDAXXfe+cpXvWrx4sWNyzciHjx4UNP17u5uRQgcHhlZv379pk2b7FLJMM0f/ehHihBRG5Z88T5GlEN2siqZXW3QGmi3lDvAVnM5VPWSWIXRgPWKM4RBK9hQb3KihrtCDWs9AJYPR0QZUMFDQUGqsiXKcyYEYLhg8QJQVZ9EzsEjKLSGZhPV/BRKQgRuCL23U8zvx+4OHomiOCnCGAEwIfovuWpw315koFkRHU1WPM4FQ0TBhSvJdV3QNCSUbskvEmiG0HUAckqF3MTwwMARZiUBfcZ8Kxo3IzHNiqMvuTA0PSK4Rlgq5AvjONGVShiGRr5HrkueJyWB65DrMQIkREDfddr65/QYzNQs1pkaZ2b72RfUcxCe87uQSuKCfnPFIntwuFQcIleWS2QBCam2u0flo9Q1b/+z5Lio4qItWGrZiyaBxDk/dOjQd7/z3ZJdevbQIcM0Ozo6SqWS9H3HcZR/k8/nPc8jXh+T7u7pOXL48PLly4lI07R777knmUz29/dLKZ96avuSpUvDaSplRw4fmdU7K/gxqQN/9sADiURi3rx5RPTU9qfmzpsLAE8//fSB/QcuvexSRHzyiSeISLU/JqKSbc+ZO/dDH/6QEgdBxO/feOM555yzYMGCmfhfjz76qGIMqrV6emrqth/96F3vfrdhmjt37iwVi4FAYqhLsnyxgVAY2hFRQJ2WT/Bn7Quo6wYbYhnUR3UQa4NvM6Nzky0BYiA13adZFa1PpJtG37x+AEDG/LFJb2iUaQKakM5lkADjnGltcW1+P/bPYsk4Vlzpk7mPJGW0s7P/4ssP33tLR0fHRM7N5jIAXNc0XTeImPQkAXmeI8CTgOCRtEuua08MHcvbxbHRaasNkVy35DqOi4BM+uTbRCQlFUquW7J1wOER15mcak93RNNt6BR9V0rpex75jqNgXhIyxnUrEmFkaDThuMlTNlnpthNVIDU1Xafebm3posjBAXdi2pvMkSxHVpnqo1jn5kpCXfOPj8rBIT6//8T88pa17A9pmtDSbWmGuH/fPmSYTqcvuvjVc+fO3blzZ6otHY1Eg9YhiUSCc1YXBFu5cuWtP7pVscATicTrXvf6++67Lx6LFUuldDqtGHeapqm0jYqzHT5yeNPZm8IrbCwWe/0b3vDA/fdHYzHbthOJxBlnnEFEr3vd63784x9/97vf1TXNdb3Lr7iiotIbVa3uNU3TKgIx8UQiGotxzhs1IBBxampKSrls2TJ1LUS0ZMmS4eHhG2+8MRKJlEqlyy69TA2u67ppmuVoSCT6Iswk1fhwb7v06pBgHDXWDGFDCgfrYmhB8K2uZXk5ulZ9vg5xv2vyUgCAwKjs7WDtqYN+SVTnW2GlXlb6MhKN/N+v/d9UOgkApe27hj78GW4aTYhiTIm1AUMSUcNasVDfdDpfsZh1tDNN/61uIkkJjP36v76UO7qvd07fwLNHjjqUK9oLujtKJS+hi55kMqrrBhea4IjMtZ3JsWHiZCSSxw4NjDoF0zKKhXxne2pxf38q3Q3AfKKh4YH9w8e570kPAfR2S9NcP93eHm3vglLedR3JDNu18wRjjp2XTtH323VtlvDjFgxDcu2b3xNPJxDxt4YIz4NDR71f/Wb6vl8V9h8lRwJV47hc1nemAM4ok0t/61/MV54FvgTOWkthy06QIfiDtZ9Q9UNKvlbVCVXYCtJ1Xc55wFJTDT700JOomtgtt9wyp3/OxjM2BkoNY2NjhmEozQ61m5KfZ4w9+OCDIyMjQSFteBwAGB8b1w09OFBZLpfzPE91r6/8+Dw1Wng3NVs2g6a+cqREQ/1+qVQqhoiCCjIVaKkxgxvyx/0yHD16dN++fbFYrLH9BFZWfGzafoiajFiDEVVBh2qGsKZVBNVCG9XG70KQE+BTsGe450VtaWuVm4eu76Y72hPJuOqJ4A0MgeOAVQ9ISOWEFgIwBixmYU8XdbZTJMK49rvB+uorXn/HFz7XxQ09FrOPT3DGkTHGgYg833eLBSY0DxGQT06Me+Al0x3geAby7PHJw/m8z/HQ0dFcpri4L89KbslzHx8cGs1lNSAD+LJZfTEjYXNnfGxMojBNyyPheZ7jSU9dP+fSdVFjkVndO3buW3D6WQykazt65YHotzAhoKNdzJttze4tDQy7TrGsZgGB4m19fJU83392YIbvSMta9scxxlhd4aeCirrtiKg3C4ooEsENN9wwd97cnp4edWy4CRaEuNeDg4PPPP3Mte+4tg5iA/Zve0c71NZcEpHqIxxuXSGa6cJomnbC36toCsamaSp/KDhpWCn/xGP+4ZGpyXVRuAQJahV7QpG0sMpc0LU1HGMjAmBYwziojFy98XXSQIGHNaN4eDkLFUwCK5MJNXlFz5cdXR2MMel5jDHv2BCQPEEYiUgCIOrCj1hS40IS832GvHo5zRdYleCq6g8RUVtXz7oNZwzs3xURBvN9YsL3JWcgyfOcIhiWzxgiTo2NFKQTT6bckuMWHQ+1VCoNhu773kQms/PQYLEkdcaGsvnDI2PCdyOGGUvEookYNw1Nioznjo4MtffMAiK7ZPucu9KznRLoHAhcosHpEvmxTmHkxkYjHV3IuBC83p9s5u6Gq8lAFxCPsGSM6aL6Odc9BdTcDPSeHXzhnqH+YIP8tqer+yGdzLEtNeg//DM4VIlz7CQ/haBj1tve9jblWITbmtTlPBDRMIy3Xf22oM1j41CNB76gHSuC2T6n8PyL8CMrA1JFaRRDHg5Wm4rXr2UEYdAJNSUvMx7qu9mBLPcbV+tfdTkP8S3DnAhqBksV96jabV1R+QAAiKFP1NbVHrhd3vA4NGeGlVssqPek4znZLE1Moa47ts0FV93MCRoas1NAgAYCQkJE4JxrgGxsbL4eHyQs5KbbLG3CAelLQyAjkkygrjNDz01NZUvFWDqNwPKlYj5vT+cnfU6O70nf7UjF48n06NRU0fYIqS8ZKXpexDC0iFGQJKR0S0UzEitQbnJ6Ip5K+yR9YC6QSxKIMWBTY5nsSP60vKCDhx1TJwluscCFYMiUlAY2cB0p1HwPARiCYEwUSpTJOrmc47keSQYMEHioYqwezzjzj41UgrYvVEz5DzDIb3u6uv1PZnFpodEfJSfxuzX1IKJwPK3pgWpLned08p/7C/p9+FP5sjUVfq0VV62CTQg6auBhxp571S5DDeelpt5PCNhCJK3naNbXpE0fQwJQrrEaxh+fRM7rSmJDAyEA+JIoV5CHB1xN88fHMWKW5YJUADOo1g3qrIL6XFT1uKhxYUjJRkZKz+xh05Ml0+5OJbJjOcbQsiKu43hSouCaaUjwrUR0bHQobztcGKWinc1MWGbMdz3fdWPIkpaZiM2Wjmc7xVKhMJbLZfP5outYsYjPfMdzYxaLplOFqSkJxGOWa7sSUTN0D4gTOiiWDGaTo3mbgS+90sgYRCOMa4gYjn0iIGENez7QY2cMdUQjX4C9B/OHjhQLNknSkFiZrdcsI0WAgsvxKSB4flvHEtHU1FQ8Hg8HJQLZyqZPf4pEFHT2U+/+6JZb1m/YsGDBgi//vy+3t7e9+S1vUXrMwUOr2s11Xd/3dV0PtoTb6IUHDOcAMpmMOmk6nVbNyBsfh1V1pGJ8bdmy5c1vfvNM82/cPtMj+Uz7t+z5XShbHWP/WCbq+7gFHfYCwAiTeqlRfLWmS0VdZI+qKSGsKjOU424ENYJ1NQUBECKOP8d3AoEYJNNJBU4gpT+dAZXGIbVOiYbnWSAJfsGhI0NeLm/HI54uCJEIZDkmV82BMaqs6FS9BQxBIBe+D9MZZ2DY1DDTb2TtvOPa5EdM0yACN1/gjHHLNGJmcTQ7Pj3p+oxz33McS4t0xFJtelQgmLoej6eZ0DzXBSlLkUJ7PD9pu1mnNDY6Pj2dydsF5vtLFi7obmvTDU360tU4ulJDQZ7rIEWKbt+RKd+z6cCAN51zknFX1yrVQxS6sVXxdApBbDmeLkErlujYsDM4Srarlz8kBACGEqkBk4iAMTmdIdtG03hemN8qXr9nz57//NKX3vKWt559ztlBojiI3ddFPE4Qk9m9a/fChYsAYO3aNZFINLjSYAff9znnO3bseOSRR66//vrwCDOJ9qv5/OyBBx7b8tjsOf2u42Yy06eedtrFF1/cNGijwvfT09O7du6qHTmUKG2AoqZI09jaoBUJ/KM7Ga2b/7wH1QVVqn/UGoUM1VpTw6LDsCODVJ+JIGCVR+mwfGp1TVOyDbVa3SzkgIXxLAAwhk1ieA0dbCUA4yIWjwEAMiYLRVksVUJ29T/+qjMHQB7ITInyRWLSJ/KAJFXYzk3IHUEkr/wWU89Rju97XgwF48JOYExYrucL5JZlZaZz0iMqeczzuJ1fMH/u8LHJwcERBkyPxgtTBU2i0DXyqQQlK2EI0HNjY77rCcIkM0zDzGExZxfjRjwW5xxcy9SjiUQpVwDfI/A0zjxJni9nHZ42C47NCMdzOJ0jwSSCBySBfCAkrMjVEpCs3mgq62goJVwHAF0PSg7aviAk5KHbjjNFrKlQolwBTeN5XAW2bd2Wbmt7avv2szadFWgnDw4O9vf3HzlyZGhoaPbs2X19feEv9N69e7OZzNy5czs6Ow8fPjxr1ixN0wzTVHiwYtUqTQgVYc/lcvv27eOcL1261DCMXC538ODBycnJXbt2JZPJWbNmIaLjOHv37nVdd8mSJZZlHT16dO7cueF52ra9Zu3aN735TQAwODj4n1/6z9mzZ69cuXJwcDAajQYssomJiVKpNGvWLMZYJGIh4sDAwNDxoc6uTjVggD1HjhwZHh5OpVKBhPPk5KRt2z09PWqfQqEwPj7e19enoHfv3r2Z6ek5c+cGhSYta9mfKCY1AlJN9U81mNasaojCPcRDCxYCUF3UrTahTifqUFHrXdWtgDPGCKtxPyZ4JGKpN6XtUMk94dN6lRSBEtCTSC5ISarHIpVVE2u6QSkXXrWmpTBuIiJw5AKwe7QUy5jZXi0T8dGXkWgsLybtUikSsdKz5kY6OzzP04ps71MHx8Bd1WmanaafsT3pSTIx6mcGnuWWZvue69i2dB3pZWzn+HRGTuTXrV2+au2qmKFz0hljJF3pSy2SYExmnGznWGHpcMFjhIDoSeZJLm1GEiUhIJIkqT40RgBU7lSI5SBk2e8jIPAAGCEjYsgEokDGABkBMqwUyTbcR8bIdqhkNwP93/FxKZPJHDiw/x3veMcPbv7BkSNH5s2bBwD5fP5b3/xW3+w+x3E0Tbv99ts3bdp0+eWXA0Amk/nmN75ZKBQ6Ozt++atfLV68+PHHH3/ve9+r+FGSJAD88Oab29rb3/jGN+7fv/+mm27q6OhwXfcnP/nJe9/73kKhsGvXLs/z7r///qVLls6aNevw4cPf+c53IpFILBp96KGHenp69u/b/5GPfoTXdtmQ0lf9Rvv6+ubPn7d///6VK1fedutty5Yve9WrXuX7vhDioYceGhgYeN/73qck0W6/7bZnn302Go0ODg7Omzf/mrdfI4RwPffGG24cGBjo7e0dHR2NWJF3/tk7E4nEI488cvjw4euvv14F/Q4fPvzDH/zw//zd/3Fd97vf+e74xHg6nb7jjjsuuvjic889N0w4blnL/qSRSdSFc8qVsEHQrDHlU1maw8oLJ+qMi0Fvv5BKali1IdBiqD3dyWkNIAEgY0bwkO564LrhLkuhKtEa3VeGKAGQoSBBIAHLXX+JwlE7gObLLRECB0RAwZiGXCAw32svieNF23X8WLsRTcRA10AXTAhNRLHgdPX3nbYy//iRA6mFPfMW95Mv4+09ZDup/v7M3kGtK57PZgsTk4jk+6X9A6OTWw7Mj3asWrcyme7QkaHne75EK4aSaYxJ6edte854XjiezxgDAkRBjEAA+YzIB5LECKjawR14NfBN5XowVg5GEgNkyAQDHUGXIACBEStDWfVGMAxpunse2Q48H4ikAOnJJ56IRKKLFi3q6e3Z+thjCpA457Zjp9PpN7zhDQBw6NChL/+/L6u+MjfffLOmaR/56Ec0TcsXCjfecEMhX6jjtuqaLrgAgPvuu2/5suVveOMbAOBb3/rWli1bLrnkkgsvvPDhhx/+i7/4C5VP+t73vrdq1arXve51ADA6Ovq1//pak7oNAiE0xSQeHxs/fPjImWedBQBCCBaqR2aMqfPquj4wMLhs+fIPfuhDqufbF/6//+/ee+697PLL7r37nsmJyU984hPqFN/59nduv+22d7zznQzLx4ajf5zzPXv2HDx48DOf/QwAbH9y+89+9sBZZ50lhGitaC17acRIBTXwCTAIyiE2oUBjJSNUx7uvTVPU4ApWq1rLQTRWwwgPHK2Qc1Ies2FACMfxFIEcOQvWIPI8cr2yiF61PKpGuSCYNwMQgAw5Z0wj6SNVikHDDh01e61CkogAHJEDcgAmYVaRdlh+3rajdikSi2iaTgjEybddrhse99r7u07x3K0/f2bPY3t7YvG5q1d2LlkgHAHd3bwjxcU0eObE8DHHtjN7j61wtIUblhsdCQ1RMw1ZyCNy13WAEQcqOcVSJt+R9YDKmIHIVIaPAWhIksruXkVdkMps+IoOLlC5Hx+RVADMATkiB1ArK8N6vY26FtDoeeB6z+M38oknnjjt9NMA4Mwzzrjttttd11XN0wQXm87apMJ38+fP7+ntGRkZ6enpOXTw0Af+4gOapnmeF41ELr/88v/4wr83VrarFwsXLvzNI7+ZP3/e4iVL3vWud6nSQpKq6yYh4qFDhxzbueKKKwDKemivfNUr77v33jpA0k3ziccfz2SmpZTj4xOnnnaq6qCDDdxOdWrP89Lp1GWXXcYY8zwvmUy+5pJLfv6zn11y6SU7duxYu27dwNGjJdvWdX3xksV33HEHAAjBiWTjaJ2dnZyzn/z4x6eedtradWvXrltLLXHblr2UPCTCppWwoY5Ezb7wNMOfzSI7GF7J6lb05gNWeybN4CZhrefCGBeVKiKicpqnnD0JBFUpJE2OwUqrUkGIyJGXNctrK6ZqG6wH8U0iYFhhFjIgJJBIcQ80D0emJ1LxiG4anDNfukCmZlh2wZWMyNTM9vZTJR4fHLAL2X2/eHRk+z7NcfJTk9G+HteTQ4PDU/n8nK7OeVY6Mi8tUxGQvh6JAZBkmut6kggFI5/Gs9nYlNuTcX0gVlZe9xEYRyYZSqDyUluGThWhwwpbBUlFLMvVx0zFYLlCWQKGFYVCOFHNDUkiKZ+Xr6NqPj0yMjq7r298fDzd1uY49r59+1asWFEOSWHlMYWIMaaSPULwSCSidpBSWpalG4ZsmBJjCAAXX3xxMpF45JFH7r//gdn9s6963VVCiCpZhSiXzUYilhAiKHFPJZON0TDPc2fN6j33vPN+cPPN8+bPv+qqqxQ/QmESVSy4V1LKaDTKOVc0P9/3k8mkJHIchzG2c8eOQ4cOqVkwztatXVe5ISw8FDJUGPm+973vnnvuueF7N3DOr3jtFYsXL25RG1r2koEloToE0QwEgECuhyqrWuA2YfCYTc3pJlWfqbLKBwcSAswQ4qkP/QRsi4bsOoWgpqYVOoZarFcwKVT2BBIoSAgwAqp6T2UGQNPaWAoRpBiV63uAKNTNCZjve56fyRVnFYpJwQh1ZJw8n1sRKUu+R1wzfS1Hprlk/iJWKk2jdKIRKx1vN7VCtuCPT85Kt69v7020teUBnJghGJjRGHDuO45P4HpEkqTnT01ND46MnT3mm45TYoiolmDkIAFQqs8UiRQOIREw1XkKEUIdpsrEBgRZCVEiBlBUlX9vzn5+fr+IiPjUU0/5vnfXXXd7nqtQYfv27StWrIDaSif1NOH7vmVZRDA4OBjwCI4dO1YoFMrYEAotqtfHjh0748wzzzjzzGw2+73vfe/Ht//4bVe/TWGJ2qG7p2d6eno6k0kmEmqQQ88+KxskeqXvt7W1L1q06Oprrvnql79y/IILent7AYAh5vN5VcaPiLlcTvlMQojx8Ynp6emgHfWzhw5ZpmmaJmPsjDPPPOusct+aXC53/PhxAGCcFypDAUCxWFTznJ6ejsZi7/yzP/N9/9FHH73xhhs++rGPWZbVwqSW/emG6SBEo2USgRAIQapWB5UXdX8CokQghlTZTky9i8FG2XBseWeGELxGkKzmjHKGM1b+lc+rXjTdk5CqD8WcI+dqpVV62OUmFYwA/ABnJCFV+l4wAgZqHQYGyIFxYBwZR+SIwQuh/gQUgAxRJZCUMcYYIAMUgBbDsUJhcHikWLSdXNF1bFd6jAsumGM7ruMARylgIp8FJuamuhYnOrt4LObynkhyRfvstV1z29o6pz0vI4gSViQW1QxL+h4BehI9z7Udt5AvHM8VOnNswXjJYcSQqeJjVlGBQgJ1eRxUOJEJUJfAKv8zDsiRcSAOxBEZAkPgSu2PqmiNkjX1jcp5NM6Q89//q8kY833/0d88evkVV7z3+ve+9/rr33v99de8/e3PPP10sVjUNM113HBsyvN913UZY2eeecb3b/z+/v37C4XCzp07777rbuWIqECZOsT3PNf1AODOO+/84n98cXp6WtM0wYV6NxaNjY6ODgwMZDKZvr6++QsWfO2r/3Xs2LFcLrdly5ZHHnlE00SdyyWldF2HiObNm7dq9eqbb7pZ7bB27dqHHnxw3769hULhqaee2vbYVk2UI8mOY998001HDh/O5/Pbtm174IGfveIVrwCA81/xirvuvGv37t2FQmFgYODf/vVfn3rqKQBYvmzZ4LHBzQ9tLuTzhw8fvvfee4GAMXb8+PFP/f2n9u7Z4/meZVlSyta69sKFj36rt1r2vNxnUWlSTljvwDSVUsWAYzYT7EG4YCcU7aq0giWsF2UAqLZHosZcRdkBC7gG4Sko2UQfXK+cyUDOgXNwvHK4USIyVmmwrnjPvHxwVe2hTH3GagOOcA+mSuuncLgQWajBOqIs9+UAApPAlfJIJp+YyhqMMV3nnvR8z4gltKSbPZ5jQuipOJhmbnTSnRxLRfoj8WRMN8B28hMD4/lsVrp+zGLphDBM3bQImUTNlXapaBdKdjabHS/kx6Yylw6XNMdxODIJZacm1Bk++LBZKAVGVFY7x1DQtKpCEfowUKo2H9W+VM01DYUAXYMZ3d3fwj0aHBy0LGvD+vWB4PGSJUt6enoVgS2dTodT96lUyrIsAHjNJZcAwM033aRpejweu/jVF//8Zz9T2JlKpZRYWSKRiMWiAPCWN7/llh/d8l9f/SoBpNPpy6+4nIiWr1i+cveqb37zm+tPWX/5FZdfc801t/7o1m9981uaELNm911+2WVbtmypA+NYLBYU6l7x2iv+33/+5+7du1esWHH6xo3j4xM33/QDTRNz5s7deMYZrltu9bZixcoNp2649dZbHcfxPP8Nb3zDKevXSyk3bNjg2M6P7/ixENxxnA0bTr3s8suklLP6+t529dV33XXXgw8+mEql1q5d++yhQ57nLVu27LLLLrv11ls1TfM8/41velPLPXpBn9wb32rd7RcUnPC1b/1fau3FWoWgau9XrI2/1WJOPUG7IrpKNaNhUJVEzYRXIaRkUxN2w1DcLhRCrMqsIiBiqeR+7h8/unrlUgkAmdzxd/6VnM6BEFju1aRicYBIqDy7sqg4BuyKID/RcINkLRSpm1RlHJZvhVRtAElj2gPduF3mbAl98ciK/lmJRFTTRbKjy4zG3KIzcvRoYTLnux4CaMIgx3PzBZIShfAd1/M9HwEjOuo6cpZKJTpmtVvptO/YdqGYz+ancrmJ6alDk1P5ydw7B2Q673rAVCc9QgIZkpio4DtWI06BBIG6GEVzp7quUeXwlk/P+asF38eI1X7n13hv1+9fGOv7frjENZixolD7nscqgTUo9+isNg5wHKdQKCi5F8/zFHQF+9SNnM1mVWeB2rSQF9SxAkChUPA8T+0TDBj2kCDUx1rpRgdKnY7jlEql8rG+p1wxdRVKhCKZTCoh6mB1U9uj0WgwSLA9k8moQF94Gp7nZTOZVCqFfyJs7z+k2vfvaVLKsbGxpgVevu+Pj493dXW1MOn3/zIcPXp079698Xi8Qe27UkVEVXjBCilYYQHW9mulkERq8HhdW0+KVdJcJTFTp+ddDvmE0YbqHsTDlAeswmNAzVNYwZD5UhaKxfKIpoGmSeNT5W57FRG3SkcfAvQBlEQbYoCQlf+xxmWDULKp6jwhVC6Iyump6iLNgDE0QYLkxzL5yMjoAiGE46A2JTTdsHiqPS0d38nmfMf1EdHQQIu4vufajmGZQtc5SiYJPIkCY8mEbkWkpHyxUMzns8ViplQ6Np0fzRYT5DNgoGKNtXpKFKTDZK1yRoVsLxEY0QmeColOzt+RhIaOEet5+ZryZqG/IInCayEhvLOUUtd1tZSrdgN1+wQvFBqrXgBh0ZfwUWq76najXjeSqsOoqX5dAZAEk1HbFXVbXYXaovoChBUo1OvG7Wp/hUbhGUophRDptjZoKTWcEFdCCUSE2pZ6TbUw1M287dbb+mb3dXV1BS0hws9xv/7Vr2b396vmRjPpP4W1NupiquGHmGoMo9nGk9SFUjSZQFWr8VwnHlO9+2IoYgux7ECJhVYF5YLYGlSFNTEUw6oPp4VaurLaKF9NNWyoNxIGagy17WDLJTMEwCrBvYCMIEn1qCUERuW+sYpIwDySuUIRAEhKpmssFiXfxwA3pWoPRIE+OZaxsra+JlieqmBKOENQMnR5CAE3Xt1UBpamCemNeXBgZNISentnErKZSDzORSwaj5Ln5XxpUwkQpednC5mS60mUvguGb+qGaWgG0yHenk71dEmUxWK+mMtOTWencsXhTO74dJ77niW0ihcjw9FPCusDEjR9C0M3G6mpNOpJBMoRyPcxFsGo9XuG7H7//FOdPN2JQzEzCTCfeJ+TDO+EJzPT2escwbBCc3h7eP/waH+6is5/yAfwxoeGEy+76lHg8ccfL5WKZ555ZvhBJHyfL7/iiq9//euLFy9ub2+vUxcMdmv8sJrOsOk3ZCb1wpmuNBj/BBB74gjkH/Er1PR3J5TKDtWuQ3XA03R9OsE+J8gw0XPsH+7/gKGcSBW96pvYIhDgVCYbLLo8lQCfwu2Twm2aQgASWrsDlw2VeF2TK2C1PXMx7HSEv9kAmhCGJdySO14oHRgZ9TkkY1HTnNR0K6KbiTTXAbNj06Vcnrgg19eFNpGdZr5M9qZMzTAsI56MW52d+bEhlkjk87nRqexUNjeeyQ9MZT3XTeigc85JBnksVM866koqqubhh4ZwnLXs81KDKuFvg0cACL6PbUkU4o/ewvy3+lH9DjDzPE7m+ZKFbkHRCe6w53m7d+/OTGdiseiSpUtN0ySiAwcOFItF5arGYrE5c+bUHSWlfOyxx6688koAGB4e3rx5c39//2mnnbZly5Zjx46dffbZ7e3thmGceuqpv/71r6+66qo6QcWx0dHNDz9cKpVSqdS5555rWVapVHrooYdUG0C126ZNm5LJJCLu2bNn9+7dUsrOzs4zzzxTOfGlUumRRx6ZnJwUQqxevXr+/PknwCT11q5du6SUK1euPHjw4K5duwLXHAE2nHpqOp0eGRnZunVrqVSKRCJnnHFGEC9V/5dKpccee+z000+v6yD1RzRR7RTeyHmoUVgI/VnZuYbvrSpcqOqGhH2xqu8V4h03e64O6TgEo4XmRvWaREAAEmF8YiqYKutIge9XdVyhpmugrPK3gzieit/hCX7uWMs6L7vBdX1xyu02wOBMQ06cO747ni/gyERbIScMEU2lNc4sw9A62gUTJcvyfWKAGI9NPb199qxZfbNng7SNRDLW3e16nudLWSpMZHKjmWy2UBzJZB3PTXJMRCzNlhVmtvLqqBxLrZQ0U9W9w2YPADQTGuFJAhIC+ZJ3tZe9V95aH1v2ovCNMpnMt7/znf179pIkQJg1u+9d73pXV1fXj2750bFjg4AofV/TtDVr1r71bW81DCNYnQ8fPmxZVnd3t5QyEonEY7Etjz562mmndXZ2PvqbR48ePdrR0UFEq1evfuKJJxzHCaLEiDgyMnLjjTeed955PT09Tz755K0/uvWat1+TyWR27dr1yle+MsAVxdZ5/PHHH9+27RUXXGCa5rZt226//fY3vOENnuf94Oab+/pmn3HGGZlM5q677rroootmKjIL6vZu+v5Nq1evXrlyZTQa7e/vDyLDd9999/oNGybGx3/4gx+effbZXd1dR48evfnmm6+55hrVvUnt9pOf/GT7k0+uWrXKMIwXQ/gXEQVhtQSlSq+raVSHGEq1BHp3QQyuBq4Aq9Ws1YzUCXwvaqJch/WpnGqMrUbyTq2sjHE+Mj4R7K3N6lGbQQVwVWCvQidjdR0Am2LPzJ8MlQnlFNJEgoAiKAF9kLpuGBKQwE8mJGWn8wXHKxVcLxJLCETUfdMwrFSSIfccVzMNZlrLFi+JxaxoPMJ4TEsmiXxJrkglh8dGj46NTUxP50tuyfPiHFOWYRgad9yqrB4SEoGs5OTCEVKiGV2emQisJ0skRpA+7+85eZeqZS37AwDS49u27XpmxynrT7nkkkvvu+++rVu3bn7oode9/vWmaZiGeelll8UT8YcefHDLlkcXL1189qazg94lzx46NGvWLDVOPB4/7bTTBgYGAGD+/PkLFy4MInvRaDQWjR47dmzevHnByj48PHzO2eesX78eAGbNmvXVr3zFtm3OeWdn5/Lly+syJdu3b3/NJZcogeC+vr4v/78v27Y9OTnp+/4rX/VKNYLneU8++eTixYvrhAoDKnCpVLr3nnte85pXj49PAEB3d3d3d7fa59ixY3Pnzm1ra/vFz3+xbPmydaesU2MeGxzcu2fv+g3rFUHmF7/4RSqVOmX9etu2/7h5oxoPqdrLrpJOoOpll5v/UDXfEtLVYaEaS6yExZBkJbyFNUAVCiHVtEPAMABRtSxVUS0orONKGBIPL4MASkAm+MjEFAAo0pHo62acMwr4FqQwhspiP9WmFxKbVOiWuWczNHeq0NYRm4QvqcxwQDRNQwAwTUPC8XxuKjt9dGAgZlm6QD+eJkm6LkQ86mfzGmMl2052deimzqwoku+7NqBeLBQmpzL7j40+OziEDD2fLKElTS1m6KRxjh7zfFm+FQELIaiyojpFVFL6OAgQlF/NGK6jk35MQj5vdmsdbNmLylzX44x5nheJRt7xzne88U1vLMMGoO/7605Zl0wmJycmd+3aNTY6Fj5wenp67rx5wZ/5fF5hFREFS7Za8JKp1Pj4uAIkhRarV6+GUP+UWDyuaZrv+1LK7du379u7j4DWrl27ZMkSAOjp6Tl48KACpKGhIStiCSHi8bgkymQyip955MgRtUMj2UeSZIz9+Mc/Xr9hQ0dHh0JNRSUlIs75Qw89tGbNGgDo6e154oknFGS6rpuZznR1dymCzKFDhw4dPPiud7/7u9/97osn/EtEgiqIRNW2rYpAhtWsTzVJgDVuDQY1QcoNolCqpZpTr6zuWBtpCzCLKIgyheTuqJK4obIuTnCwOgtUyoiICzE2OZUvFKMRCwC0/l5mmeRLBEBg5QWYVN0oBa4WBnJ5wX+hJNZMz/1YG9PC6m0jkESAEokj0w1TSI8LwbhAwRiDQi63/ZlnDI3P7+0tRqLJZBtnnARnup7LTPu22x7v9jgypknfKWSnx6emDgyNPbN3v2WZuhA6+W2mETOFaVg2koASyiB2WkkhwXN5ReW7R03do3Bw9SS+OxINXczvr/VoW9ayP2bABwBOWX/K1sce2/HMjs/802eWLF1y1llnrV69uiychXjfvfdZEevJJ55kjM8LwQ8AOK6ritvKqisz8wVMw3RqvQqFB08++eQjDz9i2/afvevPGGNCiH179/Z095xxxhn5Qv7ee+4FgCVLllx88cXf+Po3Dh44kEgk9u3bd/U113DOo9Ho2Wef/dWvfHXp0qUjI8ORSOSSSy6Znp6+7977EAGR2ba9fPnyU9afwhh7+OGHGWOrVq3au2dPUEKgiBvj4+OFfH7JkiVSyuXLlz976Nn//NJ/zps3d9++fadv3Dh79mwiyhfy99x19xve9EZVkAAvgoLfgAokiAWrE0J97KwuHFfflmGGo5q8SyexDzTn8tWPQLV1mgTAhZjM5kbGJ+ZH+giA93bztpQ/NgGaBlSpw62uthQkwJiECuuu7jpPHBaAAMEramWKboiSMY9JgYwLoXNhEOimBMEYI87mHDi4b/NjWzMLF83uaOvu86XrEnmmGZkYm4xFIzybhXy+ZBc0yxgfHzs8Or770CEuzGjElJ4Ti1hxy7IMnRM5SMgUwMtK4ZH6vbFAWS7UnCrU/jbgvsswQajef1U1YUgn+umD52M6yef1tQCpZS8qQOro6PjYx/92y5Yt27Zu27tnz9NPPfW6173uggsvVO7Llse2SCmjkegVV1y+du1a5eIoT0j5VSezOvvSZ7WOS7nz1ooV8+bNO3DgwC9+8YvXvva18Xj83dddN3t2NYqwbeu2JUuWPPTgg7P6Zq1bt07TtFl9fQ/++sE3vumNtm1v3br14ldf3N3dbdv2Y49uefzxx9esWXPueecyZICgpBoBYHBwcP/+/ddeey0AGKbJuQg3U966deuSpUsVSh06dGhicuKSSy+JRqOLlyzZsmXLokWLe3q677rzrgsuvKCzsxMAhBCmaeKJOza8YJ9XXbN55SEFggoY6LKdqPUDe46UAZbTSCcj5tBcNa4OquroyzX1ToAExBjL5wtHjg3N7++Tvs+jlujv9Y+NMF0nKcmvkCOr/lstc52C0GEDbs4Q0sOa/u7lWCeC9JXWEREhaobBkDQk0A2GiAz9BQueeXL7r7duXbZkyexCUSMydZMLkZ3OaaaRymU9t+T6MuM4I2MjgyMj0WSqPRnnQLplpSOxuKFxoXmeS66DBAjkky8BEYGRqkUoo02FbadaT5Cqgi27R+QHXwQKNRup+QKERXWbkpgRyXa05Qt5RxqoBUgtexHlkA4fPjw0NDRn7tyNGzdu3rz5lpt/+MwzOy648ELOuJTyXde9u7u727IsVWoWtkgkMj09fTInymWzQc/GQEQxlUpFIhHTNNva2nbt3Dk8PNzR0aHKyzzXQ4bxeFz9qHbu3Pmud79bcSK6u7v37tlz/PjxyYmJeDy+du1aNWw0Gv3xHXesX78+yAwFds8993iu+9Of/ERKms5MjwyP3H///RdeeCFjzLbtI0eOXH311WpWj23Zsv6U9SoB1tPTMzkx8cwzT7uus+PpZ6KR6M6dOxljQ8eHfvzjH1944YV9fX1/YF5DY+1UhdRQXXuxxiWaiQzX0HQ8/Hc1rVSzste+aHSQaiprqZ5QjjOGn1RvWQ9o/5GB8zZuAF8C59ri+aWHtgVCsFJKRIaolHMwfOZKva6szZ6EHAwIqNThICXUdgYnicBIEkkPSOeMM9S44JwTZ8JAQ9OZrmmmxU455dCB/QcO7Bs8PtjZ1dGR7igVcsg0ytF4PlMoFaZzufHRUdtxe/vn9nb1mLquMRaPRBKmZepCep70ERF9RsQgDgJAOh45lfBypVy3HJkkAgwxTNQNY2XskRhiiaj/pNKyUH5oTQqK6liI5HraysVKrwGeDzm7lrXseQGk48eO/ddX/2t2/+xXv+Y1h5991rbtrs5OAJBERNTe3t7e3g7Nqnx6e3v3799/4lMopcSpqelZvbMgVL+8d+/e48ePv/WtbwUA13Wz2VwkErFt+5vf+OZ1/+u6WCym3CMlACGJstmsmgYAFItFXdc1Xc9ls8GJpqamlNelSl/DbsTrXve6YrHoex4iO3zkMEm5atUq5f9t3769p7snEoko2oKm6dPTU9Uxp6cN3eju7v7z69/reZ4a9Pjx42vWrEmn0y8Glh0RCcIwo47ql9oTuS418j+Eof570IBUGFrZTzAiBo7MzOFDCMvhEQBIAM7F7kNHAIBxBgD66qXAGZAMpMjD3WUCkjcjQCTGyyqpys/BIJdSw07H4EIqETIiKUkCEfhEHDDGtWnObPQsABQcGAghmKYJ8jm3iHPTNC1dS8YiBw8eOnr0SC6f3717H9OEZUUYyWQ8OjU9nctmEunOeUuXzeruMnRDE8IUWtw0Y7pgiA4Q8xFdyln810uMbVsPdvLI+VZ8oQ+elC4A58g4Q6WqU9M7hICAETIoN8sI7p6SY5dEUhK4vvRIkgREyRiSnCFwRwCgrV/ZWgRb9uIxFac6fePGkdHR3zzym5tuukkIsXLNqotefbF6GJdSuq7bKE+gXi9ctOihzZtVV+JwYgMAqLySAAAcOXKEC55Kp4LMDRGdc845t/7oRzfeeGNXZ+fhw4eXLV+mhKzOOeecG264oX92fy6X8zzvVRe9CgDOPvvsW265Ze2aNbph7N69u6enp6urq62t7cknnrjt1lvnzZ+fyWR27Njxmte8pmkGK51OK8cLAGzHHh4a7u3tlVL6vr/jmWeUuqO6onPOPefWW2/N5nIdHR2Dg8eGho6/5S1v0XVdidMrM0xj3rx5kUjkjxKyq8shAQBe9O4PPkfcrJk7NPMWmgHKaIaNUANjdc0fEKqFTXUhvmqDIkAEz/PTyfh/f+bvYlELAPyxyZG3/yUWbWAMlFQDIkJZWpQhIgEyJgzBkxGtLcEMoyILhqGmSFgu7FEBuXKyxS8HxHzpF0rOxJQ3ldcl2Vz7n9zY1NyokzS7Eonuzo5YLGYyrlkm6Lpj27bjFH3fKZWKxUI2nx8ZGRkcPDY4NOz4vl0sRC0zHrVs12vv7J43f0EymdANXQMwDMsSWlQTGkff9x1JxVJxspgfmZyY1x555sjxb97/dF9775XR5Ns8vU3oXspiqRiPWFzXQPUQKv9ooOw5KYEjRTCsfgdJ+r4slJyRcWdk2suXpJSETLU9Z2UWC4bLsIBh5/98nc+fDVJCq392y07Cd/lDatlNTk5OTU3puq64agAwMjLi2E53T3ddQ+FybEGWqWvpVOrc884jIs/zpqenOzo6lL+i67plWYh4ww03rFmzZs2aNY2d4wcGBqanpzs7O5UnpC4zm80eGzxmRaxwKe7o6Oi+vXs93+/t7Q0XG+3csWNsbFzTteXLlytIa3ozg9e2bReLxVQqpTQbJyYmVGYosFKp9MwzzxTy+XgisXr1alWoFN5hfHw8mUw2vScv6JdhZi27avkQNO36Gtabq0WNulQMQu12mtnNaRBNrTaVpYaWcNTUlwII91gSmhiZnN5/dGDdssXSl7wjrS+aaz/2FI9FSAIRscrOrJIzETrXZ3dqKxaJ/tkQiwBnIZCsap9DlfNQZkNIIpKS+aTbrjV4DJ7ae2Dg2KeP/P/tfXmAHVWV/jnn3qp6S3cn6e6kQ1aykY2sQCBAgLDKqrKK6IADoiwK6jiLg+LgNo7K4G90FGXccAFUQFnDnsiaEEgg+0K2zp7et7fUvef3x62qV1XvdafBAAHq2MTX9W7de191vXvqnPud71uXHpedVF+rexQK8uSJbJuBbYGQSrHWSGhb1amUU11TM7iudtzokZ1dnblcPpcrFDVLKdJVmWw2k7YtKS0WNrg6Y1lZ25GCCMFV2s33CMvO7d7BbiHN6cvmzRhTV/M/9z//63znG7UN/zB44IxpkwfMmAKDB4NbVEUXCZGECfwiBc4IUU5VBLfI7V3Wxs306sqe9Vt1Vx7CNIUY5g8n7slZMyaJ0cOAOfFGiR2E/i8cRpgVsCJfavhpnZlPPfXUX/7yl2PGjh05cqRlWcYbAUDgG1568SVmnj59ejkFHDOPGDHCQBjCwVN1dfXESRNjLQcPHhx4jrB7njJ1aq958kqBRSqVSqVSQTox5o2YOZVKHXnkkX30GXzGd94qfjrJAe1CsOqW9nIwLAnhZ6tCWzhx3QK/QLTkXrhibo7joZC/9gUupkyn1MMSRHJ1PpsDIhLmi+6ytRtmTprASoEgZ870/AtLzfQ9J2SE+JiBWUgUtdViygRx1EwYOQwy6WAjBGMxHhsxJxPzMyKS44BjQy6/a+WaZevXbuxs+vOWdUNHOJ+ce/grG3ZqIGF4eTQAkZXOACvHkpxyVC5nI1lWhpXGbJbqagWCy7pYcF3lMmghbSkkEeRzhUJRo4QUoZRCEpEQivMoJWplZdJUyDlpB9OZk46eNmLooDseeuXZpo7l7qZRnU2T9mw/5ti580+dX9VQDwxQKLJb1FoDIGFlYURkZK2wq1sOqU9r7Ta1uN15c4pX7cXRDaRCwZ47C4je7g0k1b80AiVEOomVeZfAK/SHn9Ccks1mL7jggs7OTiij3/UcQDp14YUX9mfQ8MHY+hvmQo1l5Mo5YfsZcFT0NzHS1TBB/n7d3jvz3FDBIcWrPCNxDpcFQiH+BeBK4RCF2FZDyqPx0AsjPiz+LsViJwYjQRRqhuEQChlR2nLp6rVXfPhMkgIAnGNm4c/uBsUQFNeGKNdQIA3M6uFDig31Vu0gTKeg97QlR+UGtm3bvmTxkqefeebVl19r6ujIuUUsqEunHetk0gKhoBiRiFFrBs1ERJq169qOo5jcfA4ZhG0LIaVtC0tKywIkVxUQGUm6hWIhl9duJ5Am5Qoky0lbwK4uIgEJqbgg7ZQlMFuVTmezLFJTp1RP39y59LFl3cpd2d69ctuOPy98dvzdfzrjtJOPPvrICRPGDRo0MHAaSmtE3zPFduaq0lgoiOFDrUE1PbuaoKA1o0CPkCjEQsjo2Kn5x/SSmz2QJvr9VeF3kd41sYPSJ8XW2f0uu2b5DvZXKtLvBii43mKX3kh1+9MSeiFj7X+csV/C1n6GKe+ic5Lhyv1K4UykDCgq3BfGwwXY7EA0KMAxIEPFAqbSEFzm68KcamW1qJFKJi+00mjbztotjTv2Ng0bXMfM1tjR1oRDi6vXUyZdisM8Pm4AQI2ggIEVu66jvbrZ8AXSWiMACWG2lzo6Op579qUnn3rm2RdebN7bUnTddDolEC3NGlgLJ5XO1tTUdO1rJcti1mYbRrMWUhBLxVpK1MpWbh5VwbIkAdjStpwUEmpIs1ZQdFkXwVUIQFohgJNOW0TIjCCRGITLrBG0JGHZlrQcdLIksEeRdhVLYQsiQUBi87bt3/vvH2ccZ/ghQydOnjDnqNlz586ZOPEwQeQ9iDFj9IkJkUAIBlDMGlgzY4i4MKDn4FxejhttzZgEAEGe822yv+3e01zIU0hiI3braOaslCcNbZBIiU9K7ICEVn0s04HcQ3Kt3qb0XQn2HX1ajqSv4jm6krpryFWUcMVeco2j4OkK+1Deqwh7dmRQDDvPGIND/BQpZGtn50srVn10/jztusKyUifOKSxfhdksRCB2CMCslOro1nubVHObymTRtmyf7zaQXzOwy3w+v2r12scfferZF15Yt3FToehmM5mBQwb3dHW6hYJbcLXGzlx+y+62Yw8fm0rZ0pKEhKqImGJ2WTMIQQK0YgYEXUDQWmO+kGetJVlSCEqliJmQXOWqQq6QzxfdIgI6qbRl2cTAyOCChjxrFlJIISwpkCSQIIFM9tZdbZq1BlZKuQCslJVKDRg0UGu9Y0/Ttp27n1747KCaAZMmTzjllBNPOumE4cO8x8CI0l2hCM0txd17eto7ioqBkXzapdIDBhHncqlTj0XHfvvydYb66Irnn//Nhg2E1BvmxqPW1eqU4cPvnz8/I0RCgp3YgVoZKyeHkx3Tt9lkScUVQ44DK5SschjRjcBhhHcgcEe+5wmIfUpVR4G4XpRvNegAgSveDQHiDT3ihUCsiSmYCjCCkGLRstc/On+eqaNOnTy389d/Bq1i/K2sQbsaWtr1th3qkAauzuYdR0gZ0G8AQFtr2yvLXn/hhcVLXl66edOWnp6CsKWdyqTTIIQEhkI+D5q98iXEFZu259WMdDZjW23SFiCEF2ZopRHRLaCQNpEGcJUmaQGjqzlXzHEPO8JCIQEhX3C7eoo9BReILGETsBCSSDC7wAAkkJSwLMuyLUsoBqUxZVnrd7au3ryHgLWrkARrLaUkhqJSwGA7jhBp1qorn3/upaV/e3Hx4Nt/Oe/4Y88587Sj5xxhqvNMLIitbcXNW9vXv9HZ3O66WgBbhsYjVDoLSmM27ZwzP/i7HHBTzALxns1bfrNuXW0m0+m6BVf1mtMjqk9nntzWeNuqVTdNn27O7X/C+q2lLMp3BRJLLLED4vslE0bYZSIE3qGwyERFFHI/pcQae3k38qBbHm9B2L35YqvmPB1xNOwn7kosNhjGLqA3KyPkAYg+dagvsoDAAAo4lXJe27i5cc/eEUMGa6XkyGH2kdMKCxdTdRUEu4UMgKg1YlcBtu3Ghm2qdlAuk5aOnc5kAGDtuo1//OP9zz33wtbtOwpF17Ztx7KyNY72ucMVM7suIWpWWisNIC1at23vG7vaqrMZm8gSUloWa60BNRIgorSFEJpIFCwLSSnFqohSKq2LrqJ8QaTIZe5o7+ju6SaBhIJYCSuFUiIJ0MDKRUISJDXZjpCWrZi1ZiTrwWde2bVvb8oiBNSsDbu+YYhlrV23qDUBAiGkHBul7Gjvuvf+Bx544JEpkyedeeap553zocH1dZDLF7c2tq9Y0/LG1u7ObtTaAZRYAptoYCKhurrso2faU8a/Tfg6c7N0ue7Xly9LW05XsXj8kIZjhwzGSkUGhPh6S+tD2xur06n/Xr36E2PHjq6q0j6isp+O5y0kYRI/lFhiB+DLXvaMaApjg+DIV46IJdliRHYIcckjb80q7SVpX5AncG9ezORjuH36HYwl7tjEWAGqK0D5+fCwkOq54VwL77WzlLKlo/PJpcsvP/NU1hqEyJxzSv7pF5m5xA/up/l00eWWdr2pERsGp4Y2gOu+9OKSe+9/eNGzLzS1tKbSqXQ6k8mS0szIrBiREECxZtYkJQAqQ9nIDICtXblnXtl4wfxp2UyVJEFCEKE2EHGlKJUy3l2kq3RPN3jyxgpchZoJCaVVLBS6ujtZuUACQQhLCstGKQDRVRoISUhiVyh0nFSxJ9fV0Z1KZ15du+3BZ5ZKwUxIiMxMQmhE1i4iApFPpMquSRoyC6JMOi1Qrl2/YeXKNffcfd9ll1744aOPqtq0JbdqXceepkKh6AAhUswBKAQuutmLz3r7CBo0s0D80Zo1q1vbbEHHDh7y+GmnUp8O4NMvvPCL9RsA+D9ee+2Xxx7bm3pGS0tLT09PLOUyYMAAww/Wf6xRLpdraWkxIm+GmDmxxBI7UDGTD2qIcZkG/qBEZRpHDJfxvkVeM8ba+N6lRBMeYLep1ALLoQ/R9F4E98BRUglUDLZjP/Hyqx8/bb6UEpidubPkxLHuG1splUIdXnSQGWRXLrO7qWXTtkd273lixaqXXn41lytkspnqmmrNWinNSgEisw7rsYPWCrR0nEI+R0RaaSSBpJ5dvmbu9DEDamqkEJYjDdVp0S0IS5DbTVaaBEmQritBuYiCAZl0IZfTBVcVih0tzflcZ7qqRjoOIUrbQdtGIo2AliVAaykslmBpRpFOpVA6BaTfPvzsnrY2xyJCAR5on5A9CUFEZNaaXQQ0rp61VgQWkGbXtqx0Kr17777v3fo/940edfSAgVN27G7oKThKC0Ec+6ujB2dInTEP4G0JjzQAITZ2d9+6alWVJQtaf/eI2YSY7yURpwEk8y0zZz6wrbGr6P7+jU1XThh//OAhscSdKWD83//930WLFhkSl+Duz2Qys2fP/sQnPmG01/r2SQE7yy233FIsFi+66KJPf/rTSimRMCclltgBipaCwlgjz+rzH6Cvp+OR6fhpCn9HgSPkClhitwsw1kE4xWEGmwitNseLkSKRGPibTWYeXO6VgNjXSPJ0eYFTjrN66/bFq9ceN22KKrrCsrIfPaP1Wz/GdAZAedlCZgfREnIn6ieb9j66YOvqfU1aq1QqncqkXKVQMzCbvX7lo26UUqAZEbRSoMByLABg1kTMCqUQu1tan1669uITZ0kgW1qKkEDqYl5JtK1qc+kEkrRt0FqzobgXGrCYL+TaugqqkKmqslIOkURCtCzLthEBtEuEIKVghWAjsVKFgUPqGw4Z/ODfli16ZbVtIZE04REDSikBmFlpQKN+xFoxEqLwirC0UgTIrIusWZEkaaU279y5dV9zTUpOqs+c2KWn5FSVRs3A3h+TUAjd3Zm5+GzKZt6m8MjUL3/ztdf25nIA+KkJ4+fU1yutnYIL//N7aG4DlAGsEhyCz3zMbag9JJ3+58OnfmnJEluIm15d9tRpp2ElFLhSynVd13U7OzsDJFVXV9df//rXJUuWfOtb3zr00EPLecPC35bgX9NP8GvfuCzofc+p4vG+GyfZwsTe3xZC2SEGBT4cdhsQVgvCyPF4eBQk7kJhTJRqIVbwCpUAVBx7gXHFinBwxrHJIwLCvX974bhpU1AQMKfOmGfdeb/e1wKWZGAHkCxrG+pHi51PFDq2qKJ22XFSCKC11ppNpTACsGYgAqOErAGYGFzTgJWLBUAhCoUeIaTJ6AkpFi5be/iEUXMnjUKypRSsFMkMkFSakUGgBgSByLaNTFozgiZHWIRKklNVDchGAFfadiqVQiRmDUgaGTQIIpJEZOcLuYHV1eu2tfzivmcRyCIbEBGJCYkBCLVSAVmd+Z/HbocCWAOyZo2AwEq5GhmFIMuSFuuiguVpe0OVHOvy3B49u1s1FLTQOo+g8gU5YmjVx895m3aPTFjzclPTrzduzErLIfra9GmsGYngGz+Hb9/CMLCkEwkCoBWWrBcP3qY1XzNx4q83blzf3r5w164/bN582Zgx5eiGALFy4oknptNpZi4UCitWrOjs7NyzZ8/3vve9W2+91bbtPmrjg0goQL6YmKmPusvYBlXsV+zHXpcpPxBChDtJsF6Jvf+SdZEIqVTUg72TfFd49ivVCIWfScs9UDkveAWy8LAmLITqmkLhUZQsD0tigf6/ijmTSb+wau26bdsPGzlcuy5VZTMXn9X5vZ87tQMd5lWC7y+2vVDs3qVcBHaYNGmttKl+FUKwV/LLihVoTUjArLRCAKVdT3pVczGX8z641kCIioWg7nzP3U8sGXXI4DHDByhXMwlA0oiaNbMLTIhSCAlATKQ0AmvSLiJKx1EMGoFIkhCSQJC5SoI1gOsimzQaFYAGVtds2dX0v/c919TeIQQQyWAHRjoppVwGBq1BmDweIwEyIqDSyjzTK1ZEhmcViEBrXSy4CjQWlSTqsqwVKXttjVhQRbPzeExncWwRnNZO55rLaNAAUPrtKz/66rJlLnPOLf7LrJmjs1WKWbzRyLf9Gu1RUMgBqFKc7ozmhx7Fx15Qp89Ng7hl5syPPv1MRsivL19+7ogRVVJWIFtkBoDPf/7zARNMY2PjzTffvGfPnjVr1rz88svHHXdcS0uLuQ3C+0MdHR0mJKqtrQ26Mm4pn8+3t7fbtj1gwAAoK5s3nqO1tTWfz1dVVWWz2cCjaK07Ojq01kYtNBirvb3dYPFramqM9zIM0+3t7eZg4o0Se585oUiEZJDaXL6BBFCe+Yj7CoxkR7hCqBN+y4cnhDTTK0oUsYdtgAjMHCDEvx2qpY1sejEACBI9xdzvnlz0H1dcCkTAnPnwac33LmjdufuFFPw+37FTuQ6KNIpCseiavBSSt2vCjER+spLYsI4aLTxt5IU0sok5BBHaSLnuTiGkuRK2oO17dv/s/qf/6Yrzhw+u6+zoYgTlFl1gIhJWCojALaJiRERLIAsEiaA1IKFgVmb3TRABIoICJlQKgYV0GAFFsVrK1zds/ckfF27esVtI42iAiJSriJAQFIDhzSPAgNScGRS7PrM7EQJq1OQnO4m0ZkYtGYuu6ypXFPJaijcEvWGLx+ucCV3u6XUjzrvifGajDfi2hEf3bt366PbtaSnHVlXfMGWy1kyE8LWfQq6TNeLHzoVPnA1FFyyJS1fDzT8CafFXfiRPOVoRfnjkyLOGD3tsx84Nbe3/vWrVzTNm9AYB7+zsNA7AkI9ddtll//mf/4mIGzduPO644/7t3/5t586dY8aM+cEPfhCERN/4xjfWrVtXU1Nz++23W5ZlvI7ruo888sg999zT2dlp2/ahhx561VVXjRkzxsseMyPis88++5e//KWxsTGfz2ez2YkTJ1522WVjxowxXupLX/pSc3PzlClTvvOd7wQ60zfddNO2bdsGDx586623VlVVFQqFu++++7nnnmtpaSGioUOHnnTSSaeffroRVUsWtcTe6/tGsdtYcrkAUSkYiUsVVQIyYOX9n4otMRpcMYAPAY8IYGCIfDXsrHxmtcreEjxyVpc5m8k8/uprnzxt/rjhQ13Xldn0hsvPvemmbxRlDShdxVh0iwVmxYq1R9FQopxwlUdI5RGQMpg0HWoAkihcVQABoAGYLctypcVKkZBKu6BZIq3YuPX7v7rvxk9dNHZ4Q3tTs9ZKs9TMWhWRjCIisefVkABBaSRCJNbKc3hEiATauBZCEEAylZaK9SNPv3znA0+1d3ambMEgDMrPLRRJkLSdolswgkfITISsFRNpb8uPAFFrFsACBQizNxjwDnqc4IqZtWKWrtbIDN3QkdFP53qOufFKHFitlBYHOjwyAO4eV319+fKUED1F92vTp1VLSwHQMy/z734LgFA3En56EwzwIQlnz4OnFuPCx2DpU/CTe+D6jwHzN2fNemrXblvQD1ev/uTYcWOr+4KAB3s/Af+xgfV3dna2t7d3d3eHvyddXV3t7e1BGb9SKpvNPvnkk7t27TIk0M3NzTt37ly3bt2tt946YsQIg3S48847f/nLXyqljBzczp07t2zZsnTp0m9/+9uTJ09WSgVjhedmxjKMmVrr//zP/3zssccsy8pms8zc2Ni4cOHC1tbWyy+/PMFTJPY+CJJi4G8J5PPWeeLc6OGzwAQvzEhBjBOGNrC32xLqFMPkQSGct5/H4NALAAAKzaZcA9CwoWIoDcIe6C/0a2QI8/zOzEKIjlzu1088843LP4ZErPVxZ5026t6/Ll+6LJ1O511X+5k/KpVAmcn4CxUzgwZmAEJCo1BuLhOhYGQAzcBa63Qm09XeoVkJITQgMzoCVq1/42s//MUnP3rWcbMm2dop5vOq4GokiwEQWZDSmnVRawQpCUkzsy4gMCJJKYiQGF0ApVkzpzIZctJrt+6854Ennn/ldQXKEtLMUpBw3SIACGGxZiKpWaMUZDwVETAAEjALFAqYgAO+SQUM2qeBRelVNpPQSrlaERFoFpJaW1qmTJp4yblnsglZDrQZqPft69a93txiS5p/yNBLx4zxfMmIBvzN/wPNMGUCDKiComsyjCAIfvNNWHgeAMCUCQJAMc+srb3qsPE/XrO223X/47Xlvz7uuIqlsNls1mS9hBBNTU133XWX4zg9PT1jx441/klKKcoEqs1xCBF5dHZ2nnvuueecc042m33ooYceeeSR5ubmX/ziFzfffLMQ4qWXXvrVr37lOM7kyZOvvPLK+vr6TZs23X777Zs3b/7JT35y2223CSGIqLexiCiTyaxcuXLRokU1NTUnnXTSJZdcopRatmzZE088MW/ePEhYAxJ7vwRJEYekS9J5GMMyGK2hOMAh8AFBURGW6cP6p3ClF+hjHyLBEFQW4oOyiWGprrZE3YqIGkqYC5d1VSbz6CvLLznpuMNHjyy6ri3lP3/+sxdc+o/Skl6kSACAJEgrRUja5yk3C702VU7giyMFjpcVkVBaIwnNLjGgZdmZdCHXJYSFKFix4QTavXvPbf/3h2enTz3nxDlTxwyXpLVmpYElGRY5zQjM2i0CCtCu2rvNbhhNUjKwUkoRCwEybRdcXrFpx4Lnlz23ZFlXZ4flSAKBIBhZIioGZk6l0+g5VGDWBEhESis07pM1ABrZPUJCYMXaAOdYaS9MCiQqkFEK1h7nEQMWisUbv3Ct7Tja7KgdaDNBzJ+2brGlKCj3ygkTEFExSwAYPxLGjwxuXrAkgE+gN2oofPK88KOWZr5q/IQ71q0nwCd27mwpFAbZdrlP+tGPfmRqj1zXXbFiRXNzs1Lq0EMPnTNnTj6fjxEkB1+bgMjZbPB0dXWdcsop//Iv/2IaXHfddStXrty4ceNrr722e/fuhoaG+++/HwCqq6tvuukms/PU0NDguu4tt9yyYcOGzZs3NzQ0aK37GIuItm/fbnKDM2bMMJrZY8eO/fCHP2x8WJKyS+z955kkYzQrF82lcJxQNXKco3m4PjT7wp33VroYyw+GJYnCo+tKwwVT0n5LJCzk1Y8fXPCT664SJJTSs2ZN/4fLLrrjF3fW19crpdmUWXkco0SsmRiYERiQGJg1a80C0azZACb/g5o1AEgShpZCKy1tB4nyXV1CWkgCkZRWhLbW6sVXX1uxZuP0SeNPnDNt9uSxQwZmbSEK2lWuZlcpZlSgtMvAVt1w6ThSCtu2kajgFrdu37ts7aaXXluzfM0b7d1dWcdKZdIaUAIggyTBmpVbcNJpZGCtTCRkHCuDIkNrAV4NMpJgZmAk1MCsEdH3UN4FZwZgpVwigYRaMRO1tLReeP5584475u1LEJkIaWgq5WqNQJs6O3C/eJoQcXtwAwjErV1dRa0tEjWW5RBxpfzAwoULg20eI7mWTqe/9KUvpVKprq6u/m56KXXIIYcYCLjBHcycOXPt2rVdXV3bt2+vr6/fsmWLoWX6zne+Y9oYF5jJZNrb2xsbG4cPH963RqdSatSoUa7r1tTU/OxnP1u+fPncuXNnzpxZXV19MKhNJ5bY22HSl0MtOYCQSBEG/0R9TPgQRzF1GN1FYq4A1+YyzXQsVSV537aAzQhDVN0IGC5xKpES+TpM6L/Dirk6k3529doFryw/Y/YMV2mt9RdvuHbhoud37NydSqeVUkIY3iQ2ADcABYAmICMkjYpLWAoNAJrI7Ppozd5omhk0gZBCQjrT3dHupDMkhCpqA+GQgnryPYtefmXxaytHjxg66/DJ0yeNHT28oaY6m7ZtWxArbeSRXZSd+VxHU/veptY3tu5Ys3Hr+je27WxpUsApaaUtQUISCu0qJEQirZRbKAhLAqJm1sCoFQKTT/hEUmoArRR6LBMmsQka/OgPkcy1RiBANgpIQMysXU0kenK5Q4Y1/Ms/XV8uR3bA7YtTpjzY2CgE/XjN2k+NGz8sldYI9MBC/up/o5Awby7c9iUvZac02BJ+fi/89HfAGi48h79yJWouIn/ztdcEUY9yr504MSOlwTXEVv1MJmMCHcuyisViXV3dt7/9baOr1v/PaPxBgP823Rov0tnZWSwWc7mcECKXyy1btixIU5tEnBHS3k/USNTT0zN58uSPfvSj9913HxE98sgjTz75ZENDw/nnn/+Rj3wk8UmJvc82k4IIKSQ/EROJiGvA+iw04VgmzKOAJfY531EElD+RvSHPCXFc/jUYLyK1FMj9lc4KHE9ZpIalCWtA23Z++OBjx04+rCqVUlrX1FR/4+tf+YerrrNZG+Cch5NgYGIiCayYkTWTAR0gMTJoz9EiIyCBZmQ2wkLsfWStXCWFlamq7u7utJ20EKRczb7Qg+3YWhXXbXxj1fpNf7KsuoE1g2qqBw4YkK1KE6HWWrlud85tam1p7+jM5Qv5fJ4RbWlZliXNhxOGrEgLKZRS+e4uArQdB22LWbPSAKBZ++4IGZFZIxD7RcjKR2p4SpZAgP6fhYEINREbKCGSEFIQtXd03PyVLw8ZPPhtrX0RiIr52CFDLhs79pcbNna77rdef/1/jz5aM8OsSbhhN3ftg1dW4Pnz4YTZXspudxN/+QfYtpcB8Adf0QBC0B3r1r20d19KyFm1tVcfNqEc0WAW8a985SuHHHJIY2Pjd7/7XSLq6OgoFouxD2iukNku6o3pTkoZyKkBgMEmIKLjOFJK27Y7OzvHjBnz1a9+NZaO01oPGTKku7s7yLx5Wic+Ni8828997nNHHXXUU089tXr16j179uzdu/f73/++bdtnnXVWUpCU2PswQipx0PlS1eFEWAAZiG3zICLHSmNLbsNPsFEoBqIgqgn4iJDDIkqBwizGEHchoETA8o0YEmBCwDKqB4OGAk459qa9e3/8yBP/ev655rn4+OOO/syVl//P/94xuL7WNTTSBtXGoNn1LgCZNJ1HvcMAZLAfDEBhgUJTPQuMgISucqWQVdmanlwXoZTSVroIDBqZWSOwbVsWAjPvbW3e3dTkXVcy9bvAAIJICoHCFCMJImJmkhZrrZRCgZKoWMjn83nbSaVSaaM3wcyaDe85lhRAiDSjSTN69H2sEAhJBH9Vb0+IERC01oCIKEwlmG3JvU3Nn7j0wjPPOOUdQHOZi/m1GdP/um1bj1K/2rDx0xMmzBo0SI1oEN/7Elz77yizfNE/w+xJqBQQwabt2NHFSHjFpXr+Uai5qVj41uuvZ6XsUeobs2Y6JBRzxdV6/Pjx9fX1o0ePPvnkkx966CFE/OlPf/rd737XRDAm6Onu7g7La+ZyueBXE2ABQGtrKxEFF2ft2rVSSsdxhgwZIqUcMmRIc3Pzvn37qqurTYlSzIrFIhGZSMgk/UxgFAwduKu5c+fOnTu3ubn5mWee+f3vf++67nPPPXfWWWclEVJi7z8L88j5lGWeT0AwSAGz0kV/2AAT0NTBoK8P6+2Ns1dsFBz0X3iCFBjwtpoUmXmXg4EgNFapB4i/htLr0pwh1A+iq/WAbPb3f3vhpfUbTXGP1voLn//sscce3dbRaRnJCSEw2LUwcuie1yRgBg3CJLyIwBxA1shAGFTkEJCUlhBSMyBROlsNwMVCj5khIgoiQDKMDwwIDNKyLMt2HNu2bEtatmNZUniJSw9sjsKySEjWTEIgiUIh39Helsv12OlUKpPRoFkza62VMiQE5sMLkkiCTOLSABGJNAAiIRoIOCMKRBBAgszqh4jCc7aItmV3dnTNmDb13//lC+/MYzghaubR2aovTpnS5bou65uWLQNE0Bqu+ghOmcZuJ+7ZB48+Bo8/CQseg3UbQGvMDIBbPsvMRPjdFSu2dnbltT5n5Iizh4/oQ4cin89rrbXWl112WU1NTTqdXrp06aJFi0xwM2zYMABoamr64Q9/uGHDhjfeeOOnP/3pzp07iai+vj6VSh166KEDBw60bXvhwoXLli0TQhSLxT/96U9r1qwhouHDh5vs37x584rFYk9Pz6233trW1maGbmxs/K//+q/bbruNmaurqxsaGhCxsbHx9ttvf+ONNzZs2PCjH/3IMLcOGzbMIC8WLFjQ2toKALW1teeff35tba3ruo7jQO+CGokl9t41Mez4+YDAiMGP4dFmRCYvTeW/BVxyOT7tN/oou1Azv4eS0wp+9Y9AqEOMHo8Mx/GDpn/kfs/ZrMKvbt5y3lGzHCmZwbLkMXOOeOjhx7q6e6RlsfZo67wtqkAPkNnzsZ4sBuvwEuBx0QhEBM2IhEIQGpo6tCybhHALOa1cYG3w2aC1V/HD6MWkCMwKkTxghRCWZQkpAYCkZGaBxAD5Yr6YzxNCqroqW1UjLUsrpbRSrL0cHLMgobU2zjSgWRdEzDrYMPJWMc+ZEkT3VwjJgNeVVinH+dmPfzB06JB3YPconCWbXVd3/9Zt7cXi2ra2WbW1kwcOVILosFH4wDMMEqwsyDTIDFgOyiJ858v69GMIYE17+2dffNERghB/N29eQzodzkoHNapbt25Np9NnnXVWTU2NUqq6ulop9dJLL2Wz2U2bNp1xxhlCiLq6uscee4yI1q9f/8QTTyxYsGDlypUGVnfdddeNGTPGOIO//e1viLho0aIlS5Y88MADzzzzDCL29PR87nOfGzt2rNZ63Lhxy5cv37Fjx549e5577rnXXnvt4Ycfvuuuu5YtW7Z+/foTTjihtrY2m80+/vjjtm2vXLnyySefXLBgwdq1a4moUCh87nOfGzFixBNPPHHzzTcvX768s7Nz586dd9999+rVq7u7uz/+8Y+PHz/+vZWyQ8S2tjbHcUyJVRLefcB3jNrb25uamhzHsW07lUo5jmNZlhBCDJt3UuBgEE3IhCU+BQIACkIf71/CsrAJwBTrlFoGx0Mdln7CHYZ/qKxNtLfouWZPJzSZIHYK2pMGtm25s7W1ubPrlGlTGJi1HjhwwOSJh93/14elFOjXWBEiaw70bk0NFBrQmge+QyAkQAIiRGQ0WTWzmmMY0IEgpO2kM4hQKBa0Uj5PKZsCVcOi4Lk0IkECiYiQtQYGIsHKLbpF5brKLdpSZKuq09U1tuXoosusTfDjxaEGJOi5yEDJG4kEAmiPGRd9XXIWJLxtEZ8kF4kUK/J8LHZ1d9/6X9+Yc9Ssd7L00iAkU0IMTjt/2LTJEWJFa+sV48YRAIwfCZ+6EK76CFx3CVx3MVx3MVx7MdxwOZwxVystiD774ksrW1tySl0z8bArxo2PhUfGIS1YsGD16tWIeN555wW0QOPHj1+4cOG+ffsaGxullLNnzx46dOjIkSNXrlzZ2dlZKBQKhQIzZ7PZz372sx/60IfMJtDUqVNt216zZk1HR8eWLVv27t0LAAMGDLjxxhtPPvlksxtkWdbRRx+9ZcuW7du379mzZ+3atVu3bi0UCg0NDVdcccWRRx5JRIceeujgwYNXrFjR09OTz+eLxSIzDxgw4IYbbjjhhBMAYP369evXr9+6deuzzz771FNPrV+/noguuOCCSy65JIynSBxSYu8bh4RH/Ot/BFl8LNOMiEGuOQw2CI6UK01E9pt8jodwM58THCCkdo6ld0tcdUFLjnJH+G4oPuEQ7CI8ZxLU2tX17UsvvGDOEUprYBZC/P7ue7/y1W/WDhrk0TwjKtdVWhMJVkwIpvQVCTR7DguRAFhrRq2BPcJNpZXxaMzaUN4BECMyK+PNlFJauUq7oLTZlGKlEYUGMNGRV2Ll/RWQBBGgbaeQiCwppY0AhULeoNMRUWvNrMmPLE0hEXmS3hqJpJBgwA5etZani2Tqq4SUrDUAkxdSEQBoVlKK5ubWf//XL1z1j594V4gAFDMhnvH448/s3l3U+odz5nx+0qRykHf45ntsx44zn3gyI2SNLV8599whqRQzUJSJChH/8pe/rF69Op1OX3755QMHDgxqfV588cXHH3/ccZx0On311VcbftWOjo7nn39+w4YNzDxq1Khjjz02rE9hXuzYsWPx4sW7d+9m5tGjRx9zzDGDBg3ishrwpUuXrlq1qqOjw3GckSNHHnHEEXV1deGJNTU1vfjii5s3bwaAMWPGzJ07N9xPc3PzkiVL3njjjVwuV1dXN2vWrGnTpr3nFiDzcbZu3VpTU2MufuKQPrBm/vrbtm1bt25ddXV1NpsdMGCASZ5LKfGIr9wSCE1E0NRcQmPHWVMDNYo4HLzkvsoFlNhLiTGUtQxUYn0dv8C5hPFzHBkFAwC6r4XBgZwgl7tJUzfKwL++5qppI4cHPum/f/iTW//f7Q2DByvlMqJWysdWkQcIB0BAf+sFAU1qiw2lkEADx9OGZ8hbi7QhCvdGVKzNLDUzsNJmoddmKEMaBEJI76KSIEKBAgCEFOZSazMnNrVQRERKa6WKJCQhaa1ICAQkItamrRHn88ESJprUmhE93Qv0CHsCzgshBBA17Wu66h8/8dWvfOndoqUxwc3ifftOeHSBhZi15B9OOOGIujpfmTHqjAg3dXZeuuhvm7s6u4vF2+bMuWHy5D52j3r7bsQOVkyFxQ72p01vy264Wd/9VOzhvbiaJw4psX46JF8x1q9FjQc4iMAV2OnKCX84hM32vldl3As6XMNUNlaQ7GKMsL1yKaaC2Ll+PSxGSR+imn5+SxKip1D40u/v+f11n66vqlJaa6W/cMM1be2dv/7NPbV1NVp53xPNLJENXwAbohpgQ/ttqkeBGQilEMoterk3QESz3cKMbOR3UJBmBDYhlDKKSESSUEjbI/cBYBBEQAGCkIEJhRecIWntkUSYHA2bLByDRGG2xxAJET0acp8ZyHyKQHUKAYA8h49E5i3jX82DAiI27Wu6+KIP3/RvX3wXNycMBHxOff0/jBv383XrJNG5Tz09LJMuL7o2YdDefL6gFDPPqK39zGGH9UZeZ1b5gKI7nDoIQ7fNWyYNGzseuyD9aeP9FfxxvdRutFnf/cTQ5+XzTyyx942XMi8kV8yFhDN2/X2UKeXeohLoAPHkXL+yjOVZQK5E3Qpx0Hc8dAvMZZ12nC1NzV/43T3/d+U/WEIwgtb661/9suu6d/7unvr6WlVkRCBTG8tAiEwitPEDWhkuBEYN2nggxUBecQ8iIKNCUzJpClKRlQ//QxYkNCtEQCTFCpGYFWhwwTXyfcBml8ps9zChBiLT3qD1iq5r3Bj6dTDefAC11uYaa81CCE/olsyixkgUCNChp7LIRMIQ1u3es+/Cj57z3W99DXqvvHnnNpOYvzZj+n1bt+zL5W0p1re199ZYEiFCsVj85qxZKdEr1Bt6L3qteDxAXfedB+9PELlf/9F3P/0cJbHE3tMWrEvRwtgKlC0YX+IjcRDH/Zip+/eLdCKK4xWEjvoauJJoEgRqFfs5tayZaVXUXJPJPLf+ja/86f7vf+xCzd5+zDf/498A4He/+9Og2gFFl4G1h9AGIgIVPJP7D6rSkJayNtVUPjeCJ5VkUBXCslxXEZEmFgham2hLGXZY5VFLMAOy1kBg1C8QUbMm7bsNk8YDD0iiteEKB7PwEqHSLIkA0VUaPFfKiOThHhCBTf6QvDobQxkgSJsSLKWFEHv37Lvwo+f84L++UXJX754ZCPiITOZPJ5309WXLWosFAcS9P1gRwafGTzhnxAj9ZpJ1iSWW2EEYJ4UUY8MeprIcRSxLBxX4UKECv0OFfrBy3/GhsddQrFI8t59mxhEXNddWV/156bIB2exXzz1TaUPZoL/5H/9mW/Ydv7yzblCtyy6bpV+g1poDotWSU2VBxIYkXAjN2uwwMXsVphpYohASlNbmTEESWGlWaHi12dsWQkPbw0zk7RhZaHKbHre5zwSLik3yB7RWiIK19qHcqFgDMgGxZsUgkFmzkMI8GZCfLPKYqoUIapOlEE1NzZddeuG3v3kThh5V3l0zEeqJDQ1Pn3GGycJxL3/gMNciJd4oscTe43GSGHriKV6KDDESAiGWwqOQcnmvGbZSmzJv08fpGKp19YDmGE3cReYW8VkYVRKMlt/2OiiiBsg6zgsbNynm48aPNSENM5904nFCimcWPS8tKYVAJK8WCdCLLTBAT6DPYQGIZPiyBZGBNgQqGF5cY2i2hfQgGIH6EPr5HGY0XBAGa0BY0sw2W0eIACyFBA+lYLgW0OT3NGvFWiAZMIUpkvVxhiZgQopKZwOAIELEtrb2az/zqZu/+mU4aLxROHEHvpvBSj/BLaN63zpK7OBZaxLYd2LBzRCDfdu2bVkWEYmGk04t+YDAPZgjFAp0yCdfMO+adZ8qVQgF/VDorcBJUIiCgTAaTmFklKDeCEKlRRCbYZTKoVQ7FapziszTG1EjZGznmbUbNMBx48d4ahrMxxx95Ijhw55++tmiW7QdRysFCEIKLPlA9FZJDwge6Pt5Eg4MrEGXioE8JwNauUa7QYG3kWP8DqMnu2TcBgAgldyHSd0Jz8EYqII2W1ZaawND1MzIIEiw76XJ2xoPUc96m+oeNMSyZLHoFt3i1/79n675zKfM3tLBtkb0f0qJN0ocUmLvaYeUSqU8hzTk5FKExH4pK4cXcYjm0ChwUb3kATHwZOEgKRrohOMoqhQYRRqEfi0V20LAd+oNFy7UjSxXofFCz9UaOeM4z6zbkHeL8yaM84InrQ+fOmnOUbOee37x7t17stmMDqT/onkiA1wwMQ8SsgZm7T3aG2BVCXnoUYp7BICIaJALRsaVhPFEhjscAS2ylNGN9RZlz+96ik0+JAE0AAoGJk9DgjgIqpA8LqEQpp49BwmWlC3t7XW1g277wbfOPfsMg/BOFojEEoeU2DvpkJqbm23bDkdIQggx5OTTgngFEX090YCzruSZDDUB+O8yEhrWgoDRzm/sNzAviEPewrsRfbaC4PTgFK+TUChmcmLe5yC/FNSfG8ZI9kIkeH5jQix5XDNn00wDZBxn4fqNuzs6Tp44ISC7GzFi2FkfOmXzpi2vrVydSjmApJXyCWDJZy9Cg30wFA0eliHglUXUHsbaC+uIhCBizQKJkNDEVhTW4PUEzZEMNA7IEEOQQOMONSjWnjfV7O0u+US3jOyTNgTZOgYAMkVUzEhk4A/NLS3HHn3kT3/0/enTpiYy2PHHKf85IJl84pASe2ccUjqdLlEHDZ5/WrD1wl7SqfQT2klCHzPnv+VHAGEyVgj14L8AgGgnGB4COHpKlFA1TpZaomQNzTky4dBk/F+BI1OC8JQ0Q5XjLN68ddXO3fMPG5+yLAZgzdXVVeede6bj2C8ufiWXy6XTaaNpx4wGicAAGkEAauagGJN9aIPBWxN6eTgSwuMeEsJP8QEDE0nwWM41Bhs+gkrfWOMDSQB7ShZEUpLUWiEYOlUgQCQBQAJLYD9BBMxEfoUToSVld08Pa772M1d+99tfHTRooFI68UZvOU+YTD5xSIkdEIfkOE7gkDzuOJ/ANLJrHDlCWCJRpdJxDlGscrwfjPXMvbT3imGpwsEwi6tPdudl8Jji046PHsyZMNYs3LjIuraq6vG16z/2yzs37N0niIwcAzNf99krf/ern0yfOrm1uRWYpJAUykZ6YteakVlrBcBEwkRKggzrqrfxhIYFD9AwtpEQhORz/fiVqYAIKCCQeAXwqlgMpbcmIIGCwNuOklISkkDhyU143K+Ifu2Lx9gETEIAQ3NTy4RxY37x8x9+8YbPGCZWIT6oJZbca3jR2dm5detW8LWLKjbrP812Hy376H+/XfV27tatWzs7OyEhAk/svRPQx4yYkM1qSQiEHPqJHEFvL4cDTIFpg/6L6A+b9TZ+pNRh+Vte4q68vYmNKLTFRcjk0fhgpT6Z0Pea6Hu7kFPA+ARc1oOqMmv27L3kF3cuWL1WEBm6UqXU7FnT7/rtz//pi9cJQS1trUSGUNVn2TOuhP0Yjkt5OHO1NRvJO19rkBFRIBrZBzKMOB73tkGO+xxHgTS8eYsEkSBCYq2RvL0irbVmTYEMBvupSgPeM+hAova2NgT4/HWf/uMf/u+YOUcopRjhA13w3/vT+caNG+++6+4wyiP42nBpVy/C77Df7Fnsi2fciekn7FoCRoZy9xM+XvFcY3ffddfGjRsDYp79TjKxxA42Iw5ltEKvoexXYECFqNE7qM1bGOTlIHaWBtR+Wg/CvXG4fwgnADUGKbUgN+iHMoCMoNGMCwxopBd0hTl7LzQgIyoMzwc1enMOPSsjIxS0zqaczmLxM3f/+btPPK2UNkgDrbXj2Ndfe+Uf/3DH2R86taOjq7OzUwophEAk7SUPAcGXMydvYwz9HTZgYK2CHSgC1KwBURB60ugIaCQwfBQCa8Wm/oa1L3HOSruaXVP7ZD6mB6RjDcYTmqojJLNsCiG7uns6OjtPOfmEu3/38y/eeE06ndZaCyEOwnSJ4boOluDwYlosFguFQniBflPvBq9d1zUvenp6wr+as0xLIjJon0KhYISIgqU/0OXr6ekJ3LnyyQ+DIQK/4rpuS0tLLD0VuJO2traurq5wkq18UDN/RCwWi0FXiNjd3d3e3l6eoJNSptNpRGxubi4UCsEkYx88scQOksRd+UFpmJ59mHJQEs/mST1EtVDSLecoeQN69G0Q5WWIVMBqLlFzmyd+iNII+TTivrypPwUPTe1PyuCiwzyt4TmDL0frfV5fYjagZcUSaThqj8fAINAYAFwGKYSU8oeLnn+5cfs3zzpj4pDBzGyYWMePH/ujH3530aLnf/rzX7+0+FUArq6uMSN4dEKgPdo6j34bFXsk4uYioafQAcSoQAOwkVNiw+BtAiY0mheolSZJpiRWK6V9gQZgNvC5QBzeVEShzzBrXGFnd4cq6lmzpl9z9eUnz59nls5yvrWDwQx13lNPPeW67tlnnw0ATz/99MqVK6+//npEXLt27auvvlpdXe3YzqmnnQoAjzzySOO2bVd/5jMAsHzZsnUbNtjSqquvO/744wHgvnvv6+jouPyKywFg8eLFmzZtuuSSSwx24+mnn25uamptaxtQM+C8D5/3fz+/4x+vujKbzQLA5s2bH3/s8as/c7XZfvvb3/726iuvFItFEuKiCy8cMXKkafPXv/yFGYrF4tgxY877yIellPfde29DQ8O8E04wQ9x5551HHnnktGnTXl6y5JmFC6WUwHz+BReMGjUqCHT27Nnz5z//uZAvaK3qBw++6KKLjMbSgkcXvL7idUtaWqszPvShqVOnMvPvfvvbAQMH7d2zp62tzbLkpR//+KpVq5YtW1YoFIYMHvKxSz8W3pKRltXY2Lh48eK9u/fkCvnZs2efccYZAPDQgw8ppbZv3z5y5IiPfPSjifZ5Ygdxyq4kjoehrRrUXo6uvNIoIqnnAdsoVuuDMQ290rtU0tyrIEQbPkjRuqXQuVD6F0M7Q0FesWJvIVy735LD+0wmHkLUAHVV2cVbG8//5Z0/e3ExABi9V6W11vqEE479/Z23/+j/feeoo2a2d7S3tXcwspTCABi8x3P2kYLkeZTAOROYhkBA7Hkhj29Bs6Gv4wCDZ/RgmUGZ5IzZWxJCeEk84SMjyGD5SAoA6Ohsb29vmzp50q3fu+Wu395+8vx5ZlYHObZ71KhRa1avMa83rN+wY/uOnTt3AsDrr79eO6h2woQJr6943bjVjRs3Nm5rbNq3DwBeX7FiaEPD6ENHv7Z8OQDk8/lNmzdt2bKlvb0dAFasWHHI0KHBrZ/P5V5+eemco48++5yze3p6mluag69EseCFICnH2bxl8+5duz55+eXXXX/95EmT/u+O/8vlch0dHXf+5jfz5s274cYbrrn2mj179jz80MMA0Nra1t3dHXyKluYW5bpKqfvv/8uFF1144403jp8w4YG/PhCO2H71y18dOvrQa6695tNXX93Z0Xn3XXcZuabXli//5Cc/ec2115xy6ql/+P3vt2zZgoi7du1q3Lbtoosv+vwNnx81evQPvv+Drq6uq6+++tprr21tbX344YeDWMrcYM89+9ycOXOuvf66yy677Pnnnl+0cBEAdHS0v/LKK6ecesqpp532jikuJpbYmw2SmJmC/I9hv9HB6+DHPxh2MEGz8h/2c2ImZRc6DrqUTINYD8FYjKG0G2Ksjf8iPOfSVCHcT2TClacaGzc4WNA6m0oVmW9+9MmL7/zDq9t3CELh7yoBw5lnnHLXb39+x09vPfXkea5y9+1rzheKUkjbsqSQCCAEmUpb8nB26O0tIbhKMYAweDsTQvl5HCJiMJSogAASSQARgzTIdw9E71EYMDOhABJMKIQo5AutLW2uUvOOO+YnP/ren+76xXnnfkgIYbZDDuY1yMxt/PjxDNzc0rJ3795UKnX00XNWrVwJADt37pg4aeK4ceMKhUJPT8/27dtrB9VOnzlj1erVALB3z95JkyZNnDixo7NTKbV506YRw0ccNvGwdevWAUBrS8u06dOD+75YdGfOnDlr5szq6moAsCwr/MWQUgKAq1R1dfX5F1wwaODAVCr1oTPPzFZl169bt3bt2lQ6fejYsTu27+ju7p51xOyXlywBAMe2MXRtpZQmrVZVVfXastf27dt3zjnnXHnVlcEo69atY9ZnnnWmbdtVVVVXffqqk+bPd1136csvX3DRhUOHDrUsa8aMGTNnzXru2WfNOaeccsqgQYMcxznttNNSKeeEE07IZrPV1dWnnX765k2bw9/qXC534kknHnbYYZZljRo16tzzzn3xxRcBQGl9zDFHT5kypaqqKoG3JXbQBkmIKJlKenY+YUFID8LLymFEMIL9IAOi+n1BGg6hnJibMRCewEDQKFBAqsDYHVTCBj2HVCcic4byCUNJRymePoQwIzkjlLJ8iIF+uWJNRIOqMi9ubbzwN3+4dPaM6489Zmh1FQC4WqNmIcTJ8+edPH/eqlVr7/vrQ48/tWjb5m1a63QmbVmSCBlQs8exxuxpTWg/t6a0ix5DneIQ2S2h0AyaFaHBhDCDNhQ6HoDCQDSEAAAUotBT6OhoJ6TRo0acMn/eOed8aMb0qcH2hhDiPfE4rLW2LOuQoUO3bNrsKrdhaMOUKVMee+yxjo4OZhg2bJgQor6ufsuWLXt27xk5cuTQQ4YuXrzYKLfW19cjYk1NTWNj4+bNm8eNGyctuWH9hhEjRmSz2UGDBmlvEw6YOZVyjIcO71eF5SGU6w4cOMjw/pmwsq6urq2tDYk62jv+9Mc/aqUQkUgcPu1w8HfyvCHYbB0pIrrm2msefOCBO3/zG8uyzr/ggmHDhrmuK6Vsa2urqalhQ7SLaFnW6NGju7u7mWHAgAFmR4qZhwwZsnr1auOtSZCZoatUVVU1lGAOoS8Hs+EFHzJkSNBJXV2dUkY6Em3HMQcToH9iB7Nnklyi9vHX8kCEiGN0DBja7okeq/hr7Fks3FtA5B1SY8KyTji+JYXRLafYQFGRpuiGVkSkIsJXFFMjDdwYMoBmnU05mvnni19+eO26fzxy9uVHzKp2HOOWgFkQTZkyccqUiTdc/5nnX1j8yIInX166bOeOnUWtHcexpCRBggg8dT7tuVX2BMiRCJQCQIGovdpW1Oz6ZcCgTA0ssxE5B0QUpFxV6OnJ5wtSWA2D6087+YTTTzvp+OOOqanxViutWQh6zy09k6dMWb9+PSDMmjVr+PDhWqkXX3xx9KhRJpSZPGXyqtWr8j354+cdP3jI4EULFy5ZsmTM2DHGl0+aOHH5suXtHW1HHHmkZVlLly595ZVXxk+YACGFIVMiZl47jlMoFAM0XXt7mwEj2La9e/eujo6O6upq07JxW+MJJ57Y09MzcNDAT3/6015qrqVl165dAECCOjo6giE6OjpSjl0sFltbWy/7xCcA4Llnn73zN3d++Z+/bD5FQ0PD3n37DOYEAJqbm9etWzdnzhxpycbGxvr6evNXW7tm7SFDDwluR/QJ/WKlr0gU/lUzb9iwYdKkSaaTjRs3mh0yjrLrJpbYQZu7C8lPcHhlJy9uwLASa9SreOriHH5O653kGyJLPzOEI6ggeAqPFTzDxkeB0Lhh+SWCQLw6Pme/ZDTEixCJliKuLiJ/rZgRsTaTac3lb3nymbtfW/GpI2dfcPiUAamUSYaw1ghQVZU9/bT5p582v7W1fekry557YfGry1a88camtrZ2ASgtaVlSCimF0MjMIP0qXUHC1QqQ0P+rWFIygwDy9tFIKOXmC0VWWisNyFVVVePHjZk54/B5xx5zxBEza2sHBiGRyc4dlDC6/WftJk+e/MjDj6RSzkc+8hEiqq2tffSRR667/nrTZtq0aQsWLBhcP9gETOl05sknnrjhxhvNu9NnzLj1Bz84dMyYuro6g1Z87m/P3vCFGwFg1apVy1599eOXXVYsFkzEoJSqrq4eOXLEr371q3POOaezs3PBgsfMLeAqlc8X7rn7njlHz8lms4899tiAQQPGjBmjlHri8cfvufueucfO7WjvuOeee447/rjJkycfMfuI39z5m2HDhtXX1694/fUdO7YbUPgdP/v5MXOPmTV7dlt7eyqVQsR777139KjRs4+Y3dDQcMfP7zj99NN7cj1/+uMfp0yZSkQnn3zyfffeq1y3tq7u1Vde3b1718WXXAwA+Xwu8CLMnMvlgmdJpZTZvlqwYIFjOyfNPwkAXl6yJJPOjBk7ZtvWrU8+8cTll19uttbcENowscQO3gipQkCDyL5IOcf3nSpRcfcWEpU5wf237K1NQKnHsVRe6d/IVCvOueK7sZlU+pUBXGYpRG02u7Wt/V8fffxnS5ZeMv3wiw6fOmJAjWnoKm12jAYOrDnl5BNOOfkEZt68eeuqVWtXrFyzdt36bY07mpqa27u7i8WiZg0ABghBiIoVoQBEpZVfbqsJiFkjkm07TsoeOrh+1Mhhkw87bOqUw6ZOmXTooaOCAMikYojoPZ2NYeZ0Oj37iNmO7di2DQAzZs7o6u4eNWqUebe6unr27Nl1dXXmY86aNQsJhw0bZk6vq6ubPXv2qNGjzT0we/as6prqIUOGmHMLhSIAjBw1SvspLAC49OMff+SRRx568MH6wYNPP+P0Hdu3A0Amkzn1tFMPO+ywZ555pru7e8Tw4WeedaYJgK66+upHH3nkwQceRISzzz77qDlHMfPkKZMvvvji559/nhBnz5595llnOamU4zjXXHftY489dt9992Wz2cs+cRkiFvJ513UR8Yorrljw6KMPPfQgIJ544knHzzuemefMmZNOpZ97/rlioVhfX3fdddcPGDAAAKZOnVpT491jtm1PPXxqsPU1cODAKZMnA0CA8B4/fvzkyZM3rN/wwAMP2Lb9qU996rCJE83xQYMGQcKPkNhBGRVBqMwOx33/trKGoeAlFoREU3dvbRZB6BOLhHqdQ59vhfDfof7LTzfhFP+dE/bqXnuKbneh2FCVPX3C+AsPn3LMyBEB4bSrlEnoy6h76OnJ7dq9Z8eOXTt37d69a8/uffvaWto6u7p6unM9+Vyx6AKwlNJx7FQqVV1dVTtoYH1d3SFDGw45pGHYsKENDYOzmUy4Q/OwT0TJKvNuedBAVvxA9db3kQPS7bt4rbZu3VpTUzNw4MCDZFaJvYs3w7Zt29atW1ddXZ3NZgcMGFBTU5NOpy3LkkyRDFWc3htiWzK9tIlm5iq/xWU4hf1ES304iciUK3dYUYL2zX4LGEo0PsYNACjNtiVTttXpFu9c/trdK1ZOH9pw5mHjTxs3bvLg+sAPmZ1lI6gkBKXTqTGHjhpz6Ki/5w8ZFF0i0vtyd7qclSAMyjBAgN7ejdErBO9ySOo3/FwWtCnBpkNgB/NrxT7DnQdtwqt/UEtLvmx8ePS++ykftLyuNnatYi9KH4pNJvi9zRib2AfKZInWJrJ9EoHQYQg9x4h9uAhfxc7TSYiEV1gesEDFUfy4ByBSABs+DqXGWCFwi4dNffm0cJlvTLk23jn6vStmxSBIDMpIzbx89+7F23fc9sLiw4cMPmnMmBNGj5o6ZHDakiK0jrhae4Auf7HzadVjlfzB0sfhcNa0fd9DpGJRfGwNDQOsy9+lXt4tfxFrU5466LvP2NBBm4qTL393v/3EBu07y1H+ovQvVu4kscQOYodUglwjhIF0AR2b0RxiMHILJWR0iPUglHdD9hEF3psh31PyfP7L0KrvsSqYEUK9BXFNmFWoBFrgOPjPx4Qzluf4AkcVmnMFvXT/3eDTVZ4zA2gGRErbTtZBV+vFO3Y9u60xY1mjBw6YPrThqGHDZjQMGVs7aFAqJXtZFDw35auj+h4qWUESSyyxD6RDisULHH0EC9Zyn3EuKhxeEpgAMNw2YXAbRvoM7x1p/9xQGBUHHWCpT6iE7K405wC0jlAeV4GPogvo9aDMa0XfRY6GdBwKlTA0tGYGxIxjV6GtGTa1ta9par57xaq0ZQ3JZkcPHDBu0MAJtbWjBw4YVl1Vl84MTDlpKYUnT74/PEhiiSWW2PvXQii7aKYsvOpzBWhAaSXmWJuyHFzJMZQlzxhKNa2lf8v8Q/h0T8M7iE8YIo6nzzn7+PHQWGW4jH7OOfBqEIjChj8Rs2YAAEfKtGUZR7W3u3t7R8fCLVsZQBI5QlTZdpVtV9lWtW1nLMsW5EjZVSz+89xjZh8yVDMnmtyJJZbY+9sqouwk+LlmDvgMMBbMcGTJLn+gx5AzKI9fSr8zh3rHaGRSDk0ozapisa2ZfwBgwMrhU1lpbSmw89wK9DZn9vNyjOWlu76DxF7qghlA+btQliVsS6LHfcrM0KPczi5Xd2rFmj02B2jJ5T45fVpwmRJLLLHEPmguSmqM4OdKZaRRJ8Dl4QJAb4g6jjiCyBZSeKsp7q8qBWNlfoZD7yLEEOC9xYOVj2Dvbfycou+ayuYMsbd6iawwEnoFVBhoiLxL9auCSCNavo5RYoklltgH0GTZrj4G1aBeEOJxJUSdgpeyKmEQEGNY7PCyTJWcl49qjfDPlTjpOKh15VL2DoC8yClczMQeGx6GR/fKe0N+kz2J8WDcCF9DHB4hKnlbDDgm/M8enBRCSQRj+aIQsQvCGHWlzMDgMiQyn4klltgHxMrlJ5i5FCGFVIeiQQCG0GbhsCjgVzWuJbQ4h/xK+GClCAhRQyg7F7gm44eMr/GEVUssP3EHaGRhS2JNpTmHP5EhJuUQVR0HBUuRT4jxOYevG/kTiwWPWLoOvpcM+CMg/MliFxn9i+zpdCSWWGKJfXAjJPLWYy7jZyjho/1lueSKfPbt2B5PJMnmo+h0lPSnFGpEeahj0DiOcwNFeg7hy6NzDnEMReZs2mNoJgEIHaMeIpgzlhHdlXlWXenjYzlqAytfZPAVY4mQE5GaxBJL7APukPzKb/TyZKHHeS+IQsTKm0VYkVQo/KvvsiKOKlS/6mXb/BRXOXUeRCuNYsfLmFKjMVzFSleGUvAUKuONdB2D/1WSrShRL1ccvfxqlC6yP+dwjpEhQX4nllhiHyArr20Hs4cUVH2WM0wxYkCawGVeAULIArOM65L0ULi4qFRSGoq90N/F8foPxz1BJ1wahSsjyzEiPhGOh6AyLKJUTlSGNo9Xy0ZF1sMMFBgQW3C0QLiiZ4IorNyU8Jc+nadxnoRIib2fLRCmSiwx8AlpYi7KcNmV6LxCpFfesSiPA3Kp1Cf4fyz5qwilT5z1hLksFgmzAnn/EYcRC/5SXwp6wtIwgYsIE5T5p/o+Lk725b/rx1YR2lWKymJE54zI8aItg24AAKOj54PBuVTmG+UfM5/aNCsxrWkinewhJfa+tgEDBqRSKUiojBLr3UV5TA2xfFEJLRaPh6CS1B2Ee+AyKF04Moins7C8f0DDZhSEXb4jCm/MhBiForEIRjeqQo3jabEoD0Vvc46I4WKFy8JRt1Th6oX1cMvn7FdSJXtIib2PkzMAYCQwEkssfFcErsi8kAckhO5nKSf38rpysz50ad/0R3+LE451wn1SnPc9Yt/jclzEPbHEEkvsfR4PxZwTIso+0kS9AhbiGzrxRZb3txRH+YYYy1HR8JZUlzBecBujROpDZYn35ztiFEWVkeH9oBmvWP/rRW9JJiOxxBL74EVIgUlAquRZGKI8qhDDEyCESa97WXXjGLdwoap/NNhsQSgTpOgzNuplzoiVJhwmCgqQCL1yDJVPuNLcwgQTISoK3K8zqnSRERkpIWlILLHEPoARUskhsY/4ClGXYokbLqy+Gmz7YAhvXaJF8AHc3vGQwhGWnv9DsALwiAwCuoZwBBXFMETlJoxRaQJh5HpszhBMOLwXBGH1My5x7IX0MXwlOA7X97LPOhHD3EHo80ZENjCiXBEgJjwYRgk37xXGJjdpYokl9gF2TkHKLgJtiGMEKm7nRNEQJTqcyClYVtNaHsFghepTrDRWbCqhCcTAg32GViHMngeUwPIGEAOLx+ZTolmKzQtjnZSBIEq9RaqdSrQXiSWWWGIfLAvSd/LNrYN97tUfkAf8XmpgK7zuT1f73c7pu7D3LQ/UWz+9HWc0WobJnZlYYol9sJxQ2CQhKS/H5Rfr9OEGTI4rqCA1igq+4F5YVdWkwnwANyPGFRx8AtWoDCBzHGThkxoAgOkxRG4aoXUNkyAEXo1LScig+ocDRgoOOve2n1AHtUkxMoUgrsQYX2vFOft7bKUr4GUxOewJQ7pOjAhJyi6xxBL7ABszy/pMqrGr20ICvwgUo3v+HpGoWdgJtb/ZhGRYqitV85il3DQOvQiiAQxqemIRA2F4L4mhVMSDADoihhSvK/KaEUJYZNYv2mV/50v7kUi484AwCQm9ZCZhsBXFJbX2qIQu9zJnCjiYUAeNw64dS0R2PrkqakxCpMQSS+wDYblcrmLMRMcNHZrTiojYkNeYCk0CIGDyqzURgBAI/DbBawS/cekn4MFB713vLEIgb6fE6zZyInrnEjACE3JwBKE0HJaNFczTG6vkY8zGTDBnAxwID1Rp8pE5MwGTp3rBsbOiXZXmjN5H4+BKhs6KX9tgCExg34klltgHJVPX1tZWOWV3zeTJf9y8WQEHVAgx7HMoIYahDF6AQ0DuhehAR6h5gngLS/pBcZx1wB4U6gtDJT5lbHuVOgnRCEGsPywNVGnx5ygkDkJzDv++nzlHoq4Kyh2xYBKSIqTEEkvsg2FmH6e5ubmtrc22bQhRrJp/aXZ9/Q1Tp7bkcpLI7HPo0A+HXgQ/OvQi3Cb2w55KRbwfXdZDb0diQ+t+nMK9nNjvgZDLTuSyj993V9z7nLmPOSd7SIklltj73RsppTZs2BD2Q0RUQtkp5q/NnLmjq+uODRsyluUQQWWGuQoyEOFHf47ED73h1yqxL3AQOfmhBYcx0BEx1+hMyoeAslCkdAJHQiWO9cPhStc4CUPZQMxxJiEOA9x7gy72OmGBKAh9AtyEEjmxxBJ7X5nxQEqpFStWdHR0WJYFAEIIIQQRBT5JEiID/OyYY6bV1PzP+vWbcjnlJeoiNUmVGdhM9itSOVqSaS1hyPzsGoe4UuNLMnO8Yx810PsEuLdfK5wSJlpAxoiaLcddBof5FyKk5BEp3LKLUeYy+zthgeBqZikRUSZcyIklltj7Ljxqbm7euHFjR0eHlNJ4IymlZVlSSiGE55DM4ldg/vyECWfX1j69c+frbW1thQJrrbnC0okl/aQIFUGECCGshxQJjyr+6m/psMFVx6ITQMBK8VnMqYU9TJxeLuouInOO0wv16gDjfBW+ykRvbH/IobiJK8wwPDISQo+bcZqaG5XWzNQ/nxQIW8RehAUv3lQ/Fd8CgIqj9Of0PjqMqnLwm5Uk6O2U8ITf8gXp+yK/3XOu2Pjvv8hvYc5v6sao+Cn6P0rF6/xBuDH6eZHf1hvjzc6w7zmXX+RcLtfW1tbe3g4AJjaSUtq27TiO4zhSyiBC8m4jpVRPPu/mcqq7u6erq6e7u1AsKuWyZg5TBFV65sfwOg/xVT3sSDC0mAd6RuGgLspUFBZlxaDah7lCh+W6rvEMWflHQKwUnEW8Tayx4Tjq1UmFhJoCZxUjDwofgdA8mYEQ24vFotZ/z638pm6dN/Xd+PtXigPyFX3n53zAL/I78zS63/m872+M/nd1kNwY78Bd9C7eGERkwiCzaWTbdjqdzmazVVVVmUzGtm3jk2TQ2rEsYM4rVVSqwJxHdF3SWmvmGG1dzJeUyOrCIn0+y1x8WS93bP7BXsUdwh84qrAXCttCWuZhZXHmimm0UD1t2fRiM6/4EXr30PFmvc0Ho/rrzABgW5bznorBy+/Fd2xteps+yHtizm/HJN/uD/5evDHei2mxA36RD2A/xtEQkZTScZx0Op3JZGIRkvSXRxRC2JaFmYwlhGNZOdt2XVcppd/MM/u7YkHg/B76/kfka5M5v203RnKR3+tzTi7ye/fbV74smzjJOKRUKpVKpSzLCjaQSik7Y1prpZTrusVisVgsGodkGpSLn8eufsWcbMUrGEs3h1OxFT9Pxd2RWDK0j4HKs9sVs8m9zbn8o1UQRI9ek/K59ecjlw9R8Y9anm0vn1j5x+xjzn3/Zfv+Juz39H7eGP2/Sm/2xujt6sWu8LtyY/Tzz1Tx+sdO7+3GiH3dKl7kv/PG6G16b9ONUT75/twY/f/29XFjQNmeWW/TeFM3RsURK5613xvjTV3k3nrr/5z77rniJQ0iJMuyAjgDUUktOz4eMxu3FPz79rnlPq71+/Wh+939mH177oNnwu/FG+Pv/NMfnDfGwXwN38KcD86P+YG6MQKfFAC+Y2648nimGMYk6/oIQQ7ste7P3db/mfQdPB3wr0Q/B+p76e/taesdvsjvwP36tt4Y/en8zc78TbU/4DdGf0KQ5MY4gDdG/2+St/vGeLNDv7tz7k+DsFVo0P+Z9SeN0Nt6Wh6c7je4ewv5ov6kB99U/xVP2W+D3q7Dfj9L+fetj7zEgfKRf88TQH8m/NZujD4SKfvNMr0ph9RHeqePi/ym5rzf6/AWbowDeJHf7DbAW7u73rs3xptyitD7ZvZbWMr2O+F3eFnuz4T7vgL7vVX+PwLPTS1Sx78DAAAAAElFTkSuQmCC";

function buildEmailSignatureHtml() {
  return `
    <table role="presentation" style="margin-top:28px;border-top:1px solid #e2e2e2;padding-top:20px;width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding-bottom:14px;">
          <img src="${RUBEUS_SIGNATURE_IMG}" alt="Rubeus" width="280" style="display:block;border:0;border-radius:8px;max-width:280px;height:auto;" />
        </td>
      </tr>
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#555555;line-height:1.6;">
          Acesse dicas e conteúdos exclusivos sobre relacionamento com clientes em nossas mídias:
          📱 <a href="https://www.instagram.com/canalrubeus/" style="color:#c0392b;text-decoration:none;">Instagram</a>
          📽️ <a href="https://www.youtube.com/@Rubeus" style="color:#c0392b;text-decoration:none;">YouTube</a>
          💻 <a href="https://rubeus.com.br/blog/" style="color:#c0392b;text-decoration:none;">Blog</a>
          💻 <a href="https://www.linkedin.com/company/rubeus/posts/?feedView=all" style="color:#c0392b;text-decoration:none;">LinkedIn</a>.
        </td>
      </tr>
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999999;font-style:italic;line-height:1.5;padding-top:10px;">
          Aviso: Esta mensagem e seus anexos contêm informações confidenciais. Caso não seja o destinatário, por favor, notifique o remetente e apague os dados imediatamente.
        </td>
      </tr>
    </table>
  `;
}

function generateLimitEmailLink(clientData: any, consumedHours: number) {
  const emails = Array.isArray(clientData?.emails) ? clientData.emails : [];
  const emailTo = emails.join(',');
  const subject = `Aviso de Banco de Horas - ${clientData.name}`;
  const remaining = (clientData.contractedHours || 0) - consumedHours;
  
  const body = `Prezados(as),\n\nInformamos que o banco de horas contratado (${clientData.contractedHours}h) está prestes a ser atingido. No momento, restam apenas ${remaining.toFixed(1)}h disponíveis.\n\nGostaríamos de saber se autorizam a continuidade das demandas (cientes de que as horas excedentes poderão ser cobradas) ou se devemos pausar as atividades até à renovação do banco.\n\nCom os melhores cumprimentos,`;
  
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${emailTo}&bcc=analistasrubeus@rubeus.com.br&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function generateLimitEmailHtml(clientData: any, consumedHours: number) {
  const remaining = (clientData.contractedHours || 0) - consumedHours;
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">
      <p style="font-size:14px;color:#222;line-height:1.6;">Prezados(as),</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #fca5a5;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#dc2626;padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:#fff;">Aviso de Banco de Horas</td></tr>
        <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6;">
          Informamos que o banco de horas contratado (<b>${esc(clientData.contractedHours)}h</b>) está prestes a ser atingido.<br/>
          No momento, restam apenas <b>${esc(remaining.toFixed(1))}h</b> disponíveis.
        </td></tr>
      </table>
      <p style="font-size:14px;color:#222;line-height:1.6;">Gostaríamos de saber se autorizam a continuidade das demandas (cientes de que as horas excedentes poderão ser cobradas) ou se devemos pausar as atividades até à renovação do banco.</p>
      <p style="font-size:14px;color:#222;line-height:1.6;">Com os melhores cumprimentos,</p>
      ${buildEmailSignatureHtml()}
    </div>`;
}

function ClosureModal({ tasks, clients, responsibles, onClose, onFormalize }: any) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedNotionId, setCopiedNotionId] = useState<string | null>(null);
  const [copiedHtmlId, setCopiedHtmlId] = useState<string | null>(null);
  const [meetingData, setMeetingData] = useState<any>({});

  const tasksByClient = useMemo(() => {
    return tasks.reduce((acc: any, task: any) => {
      const cId = task.clientId || 'no_client';
      if (!acc[cId]) acc[cId] = { done: [], inProgress: [] };
      if (task.status === 'done') {
        acc[cId].done.push(task);
      } else if (['inprogress', 'paused', 'waiting', 'review'].includes(task.status)) {
        acc[cId].inProgress.push(task);
      }
      return acc;
    }, {});
  }, [tasks]);

  const generateEmailText = (clientTasks: any, mData: any) => {
    let body = `Prezados(as),\n\nEspero que se encontrem bem.\n\n`;
    
    let dateStr = "";
    if (mData?.date) {
      const [y, m, d] = mData.date.split('-');
      dateStr = `${d}/${m}`;
    }

    if (dateStr || mData?.link) {
      body += `Segue o resumo da reunião de overview`;
      if (dateStr) body += ` realizada a ${dateStr}`;
      body += `, com os principais pontos discutidos e o estado das demandas:\n\n`;
      if (mData?.link) body += `Link da gravação: ${mData.link}\n\n`;
    } else {
      body += `Segue o resumo semanal com os principais pontos e o estado das demandas:\n\n`;
    }

    if (clientTasks.done.length > 0) {
      body += `Demandas Finalizadas:\n`;
      clientTasks.done.forEach((t: any) => {
        body += `- ${t.title}\n`;
        if (t.description) body += `  ${t.description}\n`;
        body += `\n`;
      });
    }

    if (clientTasks.inProgress.length > 0) {
      body += `Demandas em Andamento:\n`;
      clientTasks.inProgress.forEach((t: any) => {
        body += `- ${t.title}\n`;
        if (t.description) body += `  ${t.description}\n`;
        body += `\n`;
      });
    }

    body += `Em caso de dúvidas, continuo à disposição.\n\nCom os melhores cumprimentos,`;
    return body;
  };

  const escapeHtml = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Versão em HTML, mais organizada e profissional (usada na "Copiar E-mail (HTML)")
  const generateEmailHtml = (clientTasks: any, mData: any) => {
    let dateStr = "";
    if (mData?.date) {
      const [y, m, d] = mData.date.split('-');
      dateStr = `${d}/${m}`;
    }

    let intro = 'Segue o resumo semanal com os principais pontos e o estado das demandas:';
    if (dateStr || mData?.link) {
      intro = `Segue o resumo da reunião de overview${dateStr ? ` realizada a ${dateStr}` : ''}, com os principais pontos discutidos e o estado das demandas:`;
    }

    const section = (title: string, color: string, items: any[]) => {
      if (!items.length) return '';
      const rows = items.map((t: any) => `
        <div style="padding:12px 16px;border-bottom:1px solid #eee;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#222;">${escapeHtml(t.title)}</div>
          ${t.description ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#666;margin-top:4px;line-height:1.5;">${escapeHtml(t.description)}</div>` : ''}
        </div>`).join('');
      return `
        <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <tr><td style="background:${color};padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:#fff;">${title}</td></tr>
          <tr><td>${rows}</td></tr>
        </table>`;
    };

    return `
      <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">
        <p style="font-size:14px;color:#222;line-height:1.6;">Prezados(as),</p>
        <p style="font-size:14px;color:#222;line-height:1.6;">Espero que se encontrem bem.</p>
        <p style="font-size:14px;color:#222;line-height:1.6;">${escapeHtml(intro)}</p>
        ${mData?.link ? `<p style="font-size:14px;"><a href="${escapeHtml(mData.link)}" style="color:#4f46e5;">Link da gravação</a></p>` : ''}
        ${section('Demandas Finalizadas', '#059669', clientTasks.done)}
        ${section('Demandas em Andamento', '#4f46e5', clientTasks.inProgress)}
        <p style="font-size:14px;color:#222;line-height:1.6;">Em caso de dúvidas, continuo à disposição.</p>
        <p style="font-size:14px;color:#222;line-height:1.6;">Com os melhores cumprimentos,</p>
        ${buildEmailSignatureHtml()}
      </div>`;
  };

  const copyEmailHtml = async (clientTasks: any, clientId: string, mData: any) => {
    const html = generateEmailHtml(clientTasks, mData);
    const text = generateEmailText(clientTasks, mData);
    try {
      if ((navigator as any).clipboard && (window as any).ClipboardItem) {
        const item = new (window as any).ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        });
        await (navigator as any).clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiedHtmlId(clientId);
      setTimeout(() => setCopiedHtmlId(null), 2000);
    } catch {
      await navigator.clipboard.writeText(text);
      setCopiedHtmlId(clientId);
      setTimeout(() => setCopiedHtmlId(null), 2000);
    }
  };

  const generateEmailLink = (clientTasks: any, clientData: any, mData: any) => {
    const emails = Array.isArray(clientData?.emails) ? clientData.emails : [];
    const emailTo = emails.join(',');
    const subject = `Atualização Semanal de Demandas - ${clientData ? clientData.name : 'Cliente'}`;
    const body = generateEmailText(clientTasks, mData);
    
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${emailTo}&bcc=analistasrubeus@rubeus.com.br&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleCopyText = (clientTasks: any, clientId: string, mData: any) => {
    const text = generateEmailText(clientTasks, mData);
    navigator.clipboard.writeText(text);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyNotion = (clientTasks: any, clientId: string) => {
    let text = "";
    if (clientTasks.done.length > 0) {
      text += "CONCLUÍDAS\n\n";
      clientTasks.done.forEach((t: any) => {
        const timeMin = t.timerElapsed > 0 ? Math.round(t.timerElapsed / 60) : (t.durationMin || 0);
        const dateStr = t.dueDate ? t.dueDate.split('-').reverse().join('/') : 'Sem data';
        text += `- ${t.title}\n  Descrição: ${t.description || 'Sem descrição'}\n  Tempo: ${timeMin} min\n  Data: ${dateStr}\n\n`;
      });
    }
    if (clientTasks.inProgress.length > 0) {
      text += "EM ANDAMENTO\n\n";
      clientTasks.inProgress.forEach((t: any) => {
        const timeMin = t.timerElapsed > 0 ? Math.round(t.timerElapsed / 60) : (t.durationMin || 0);
        const dateStr = t.dueDate ? t.dueDate.split('-').reverse().join('/') : 'Sem data';
        text += `- ${t.title}\n  Descrição: ${t.description || 'Sem descrição'}\n  Tempo: ${timeMin} min\n  Data: ${dateStr}\n\n`;
      });
    }
    navigator.clipboard.writeText(text);
    setCopiedNotionId(clientId);
    setTimeout(() => setCopiedNotionId(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center px-3 pt-3 pb-24 sm:p-4 z-[80] fade-in" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-3xl sm:rounded-[32px] bg-[#12121a] border border-[#27272a] flex flex-col max-h-[80dvh] sm:max-h-[88dvh] shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
        
        <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-[#27272a] flex items-center justify-between bg-[#0f0f13]">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl hidden sm:block text-indigo-400 border border-indigo-500/20"><Mail size={24} /></div>
            <div>
              <h3 className="font-display font-bold text-xl text-white tracking-tight">Fechamento Semanal</h3>
              <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-bold">Dispare os e-mails e copie os relatórios para o Notion.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl text-neutral-500 hover:bg-white/5 hover:text-white transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 sm:p-8 overflow-y-auto kp-scroll flex flex-col gap-8 flex-1 bg-[#09090b]">
          {Object.keys(tasksByClient).length === 0 && (
             <div className="text-center text-sm text-neutral-500 py-12 border border-dashed border-[#27272a] rounded-3xl">
               Nenhuma demanda pendente para fechamento nesta semana.
             </div>
          )}

          {Object.entries(tasksByClient).map(([clientId, clientTasks]: any) => {
            if (clientTasks.done.length === 0 && clientTasks.inProgress.length === 0) return null;

            const clientData = clients.find((c: any) => c.id === clientId);
            const clientName = clientData ? clientData.name : 'Sem Cliente Atribuído';
            const mData = meetingData[clientId] || { date: '', link: '' };
            const totalTasksCount = clientTasks.done.length + clientTasks.inProgress.length;
            
            return (
              <div key={clientId} className="bg-[#12121a] border border-[#27272a] rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6 border-b border-[#27272a] pb-5">
                  <h4 className="font-bold text-lg text-white flex items-center gap-3">
                    <Building2 size={20} className="text-indigo-400" /> {clientName}
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-neutral-300 px-3 py-1.5 rounded-lg">
                    {totalTasksCount} Demandas
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                   <div className="w-full">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-2 block ml-1">Data da Reunião (Opcional)</label>
                      <input 
                         type="date" 
                         value={mData.date || ''} 
                         onChange={e => setMeetingData({...meetingData, [clientId]: {...mData, date: e.target.value}})} 
                         className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500 [color-scheme:dark]" 
                      />
                   </div>
                   <div className="w-full">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-2 block ml-1">Link da Gravação (Opcional)</label>
                      <input 
                         type="text" 
                         value={mData.link || ''} 
                         onChange={e => setMeetingData({...meetingData, [clientId]: {...mData, link: e.target.value}})} 
                         className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500" 
                         placeholder="Ex: meet.google.com/..." 
                      />
                   </div>
                </div>

                <div className="text-[13px] text-neutral-400 mb-8 max-h-48 overflow-y-auto pr-2 kp-scroll font-mono border border-[#27272a] p-4 rounded-2xl bg-[#09090b]">
                  {clientTasks.done.length > 0 && (
                    <div className="mb-5">
                      <strong className="text-emerald-400 uppercase tracking-widest text-[10px] block mb-3 border-b border-emerald-500/20 pb-2">Demandas Finalizadas:</strong>
                      {clientTasks.done.map((t: any) => (
                        <div key={t.id} className="mt-2 pl-2 border-l-2 border-emerald-500/30">
                          <div className="text-neutral-200 font-bold">- {t.title}</div>
                          {t.description && <div className="pl-3 opacity-60 line-clamp-2 mt-1 leading-relaxed text-[11px]">{t.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {clientTasks.inProgress.length > 0 && (
                    <div className="mb-2">
                      <strong className="text-indigo-400 uppercase tracking-widest text-[10px] block mb-3 border-b border-indigo-500/20 pb-2">Demandas em Andamento:</strong>
                      {clientTasks.inProgress.map((t: any) => (
                        <div key={t.id} className="mt-2 pl-2 border-l-2 border-indigo-500/30">
                          <div className="text-neutral-200 font-bold">- {t.title}</div>
                          {t.description && <div className="pl-3 opacity-60 line-clamp-2 mt-1 leading-relaxed text-[11px]">{t.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[#27272a] pt-6">
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <a 
                      href={generateEmailLink(clientTasks, clientData, mData)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 px-5 py-3.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                    >
                      <Mail size={16} /> Abrir E-mail
                    </a>
                    
                    <button 
                      onClick={() => copyEmailHtml(clientTasks, clientId, mData)}
                      title="Copia formatado (com assinatura) para colar no Gmail"
                      className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 px-5 py-3.5 sm:py-3 bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      {copiedHtmlId === clientId ? <Check size={16} className="text-emerald-400" /> : <Sparkles size={16} />} 
                      {copiedHtmlId === clientId ? "Copiado! Cole no Gmail" : "Copiar E-mail (HTML)"}
                    </button>

                    <button 
                      onClick={() => handleCopyText(clientTasks, clientId, mData)}
                      className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 px-5 py-3.5 sm:py-3 bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      {copiedId === clientId ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />} 
                      {copiedId === clientId ? "Copiado!" : "Copiar Texto"}
                    </button>

                    <button 
                      onClick={() => handleCopyNotion(clientTasks, clientId)}
                      className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 px-5 py-3.5 sm:py-3 bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      {copiedNotionId === clientId ? <Check size={16} className="text-emerald-400" /> : <ClipboardList size={16} />} 
                      {copiedNotionId === clientId ? "Copiado!" : "Copiar (Notion)"}
                    </button>
                  </div>

                  {clientTasks.done.length > 0 && (
                    <button 
                      onClick={() => onFormalize(clientId)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:py-3 bg-transparent border border-[#27272a] text-neutral-400 hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      <CheckCircle2 size={16} /> Formalizar ({clientTasks.done.length})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="px-5 sm:px-8 py-5 border-t border-[#27272a] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0f0f13]">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Ação em lote (Formaliza tudo do sistema)</span>
          <button 
            onClick={() => onFormalize(null)} 
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 sm:py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold uppercase tracking-widest text-xs transition-all shadow-[0_0_15px_rgba(13,148,136,0.3)]"
          >
            <Check size={18} /> Formalizar Todos
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskModal({ modal, setModal, clients, responsibles, closeModal, saveModal, validationError, setValidationError }: any) {
  const updateForm = (patch: any) => { setModal((m: any) => ({ ...m, form: { ...m.form, ...patch } })); if (validationError) setValidationError(null); };
  const addChecklistRow = () => { setModal((m: any) => ({ ...m, form: { ...m.form, checklist: [...(m.form.checklist || []), { id: nextId(), text: "", done: false }] } })); };
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center px-3 pt-3 pb-24 sm:p-4 z-[85] fade-in" onClick={closeModal}>
      <div className="w-full max-w-xl rounded-[32px] bg-[#12121a] border border-[#27272a] flex flex-col max-h-[80dvh] sm:max-h-[85dvh] shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
        <div className="px-6 sm:px-8 py-5 border-b border-[#27272a] flex items-center justify-between bg-[#0f0f13] shrink-0"><h3 className="font-display font-bold text-xl text-white tracking-tight">{modal.mode === "add" ? "Nova Demanda" : "Editar Demanda"}</h3><button onClick={closeModal} className="p-2.5 rounded-xl text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"><X size={20} /></button></div>
        <div className="p-6 sm:p-8 overflow-y-auto kp-scroll flex flex-col gap-6 bg-[#09090b] flex-1">
          <div><label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Título do Card *</label><input autoFocus value={modal.form.title || ''} onChange={(e) => updateForm({ title: e.target.value })} className={`w-full bg-[#12121a] border rounded-xl px-4 py-4 sm:py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-all ${validationError && String(validationError).includes("Título") ? "border-red-500" : "border-[#27272a]"}`} placeholder="Ex: Ajustar Fluxo de E-mails..." /></div>
          <div><label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Contexto / Descrição *</label><textarea value={modal.form.description || ''} onChange={(e) => updateForm({ description: e.target.value })} rows={4} className={`w-full bg-[#12121a] border rounded-xl px-4 py-4 sm:py-3.5 text-sm text-white outline-none focus:border-indigo-500 resize-none transition-all ${validationError && String(validationError).includes("Descrição") ? "border-red-500" : "border-[#27272a]"}`} placeholder="Descreva os requisitos técnicos ou regras de negócio..." /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5"><CustomSelect label="Prioridade *" required hasError={validationError && String(validationError).includes("Prioridade")} value={modal.form.priority || ''} onChange={(e: any) => updateForm({ priority: e.target.value })} options={<><option value="" className="bg-[#1c1d26] text-white">Selecione...</option><option value="Baixa" className="bg-[#1c1d26] text-white">Baixa</option><option value="Média" className="bg-[#1c1d26] text-white">Média</option><option value="Alta" className="bg-[#1c1d26] text-white">Alta</option></>} /><div><label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Est. Minutos</label><input type="number" value={modal.form.durationMin ?? ''} onChange={(e) => updateForm({ durationMin: e.target.value })} className="w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-4 sm:py-3.5 text-sm text-white outline-none focus:border-indigo-500 shadow-sm" placeholder="Ex: 60" /></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5"><CustomSelect label="Responsável *" required hasError={validationError && String(validationError).includes("Responsável")} value={modal.form.responsibleId || ''} onChange={(e: any) => updateForm({ responsibleId: e.target.value })} options={<><option value="" className="bg-[#1c1d26] text-white">Selecione a pessoa...</option>{responsibles.map((r: any) => <option key={r.id} value={r.id} className="bg-[#1c1d26] text-white">{r.name}</option>)}</>} /><CustomSelect label="Cliente *" required hasError={validationError && String(validationError).includes("Cliente")} value={modal.form.clientId || ''} onChange={(e: any) => updateForm({ clientId: e.target.value })} options={<><option value="" className="bg-[#1c1d26] text-white">Selecione a empresa...</option>{clients.map((c: any) => <option key={c.id} value={c.id} className="bg-[#1c1d26] text-white">{c.name}</option>)}</>} /></div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div><label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Data de Início</label><input type="date" value={modal.form.startDate || ''} onChange={(e) => updateForm({ startDate: e.target.value })} className="w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-4 sm:py-3.5 text-sm text-white outline-none focus:border-indigo-500 [color-scheme:dark] shadow-sm" /></div>
            <div><label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block ml-1">Prazo / Deadline</label><input type="date" value={modal.form.dueDate || ''} onChange={(e) => updateForm({ dueDate: e.target.value })} className="w-full bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-4 sm:py-3.5 text-sm text-white outline-none focus:border-indigo-500 [color-scheme:dark] shadow-sm" /></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
             <CustomSelect label="Fase do Fluxo *" required hasError={validationError && String(validationError).includes("Fase")} value={modal.form.status || ''} onChange={(e: any) => updateForm({ status: e.target.value, waitingFor: e.target.value === 'waiting' ? modal.form.waitingFor : "" })} options={<><option value="" className="bg-[#1c1d26] text-white">Selecionar...</option>{COLUMNS.map(c => <option key={c.id} value={c.id} className="bg-[#1c1d26] text-white">{c.name}</option>)}</>} />
             {modal.form.status === 'waiting' && <div className="animate-fade-in"><CustomSelect label="Dependência *" required hasError={validationError && String(validationError).includes("Dependência")} value={modal.form.waitingFor || ''} onChange={(e: any) => updateForm({ waitingFor: e.target.value })} options={<><option value="" className="bg-[#1c1d26] text-white">Pendente de quem?</option><option value="Cliente" className="bg-[#1c1d26] text-white">Cliente</option><option value="Time Interno" className="bg-[#1c1d26] text-white">Time Interno</option></>} /></div>}
          </div>
          
          <div className="mt-2"><div className="flex items-center justify-between mb-3"><label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 ml-1">Checklist de Passos</label><button onClick={addChecklistRow} className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors p-1 flex items-center gap-1"><Plus size={12}/> Adicionar Passo</button></div><div className="flex flex-col gap-3 pb-safe">{(modal.form.checklist || []).map((c: any) => (<div key={c.id} className="flex items-center gap-3"><button onClick={() => { setModal((m: any) => ({ ...m, form: { ...m.form, checklist: m.form.checklist.map((ci: any) => ci.id === c.id ? { ...ci, done: !ci.done } : ci) } })); }} className={`p-2.5 border rounded-xl transition-all shrink-0 ${c.done ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-[#12121a] border-[#27272a] text-neutral-700 hover:text-neutral-500 hover:bg-white/5'}`}><Check size={16}/></button><input value={c.text || ''} onChange={(e) => { setModal((m: any) => ({ ...m, form: { ...m.form, checklist: m.form.checklist.map((ci: any) => ci.id === c.id ? { ...ci, text: e.target.value } : ci) } })); }} className="flex-1 bg-[#12121a] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-all shadow-sm" placeholder="O que precisa ser feito?" /><button onClick={() => setModal((m: any) => ({ ...m, form: { ...m.form, checklist: m.form.checklist.filter((ci: any) => ci.id !== c.id) } }))} className="p-2.5 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"><X size={18} /></button></div>))}</div></div>
          {modal.mode === 'edit' && Array.isArray(modal.task?.history) && modal.task.history.length > 0 && (
            <div className="mt-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-3 block ml-1">Histórico</label>
              <div className="flex flex-col">
                {modal.task.history.map((h: any, i: number) => {
                  const d = new Date(h.at);
                  const valid = !isNaN(d.getTime());
                  const p2 = (n: number) => String(n).padStart(2, '0');
                  const dateStr = valid ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} · ${p2(d.getHours())}:${p2(d.getMinutes())}` : '';
                  let label = h.type;
                  if (h.type === 'created') label = 'Demanda criada';
                  else if (h.type === 'status') { const to = COLUMNS.find(c => c.id === h.to); label = `Movida para ${to ? to.name : h.to}`; }
                  const isLast = i === modal.task.history.length - 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${isLast ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-[#3f3f46]'}`}></span>
                        {!isLast && <span className="w-px flex-1 bg-[#27272a] my-1"></span>}
                      </div>
                      <div className="pb-4 min-w-0">
                        <div className="text-[12px] text-neutral-200 font-medium leading-snug">{label}</div>
                        {dateStr && <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{dateStr}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 sm:px-8 py-5 border-t border-[#27272a] flex flex-col sm:flex-row items-center justify-end gap-3 bg-[#0f0f13] shrink-0 pb-[max(env(safe-area-inset-bottom),1.25rem)] md:pb-5"><button onClick={closeModal} className="w-full sm:w-auto text-xs font-bold uppercase tracking-widest px-6 py-4 rounded-xl text-neutral-500 hover:text-white hover:bg-white/5 transition-colors">Cancelar</button><button onClick={saveModal} className="w-full sm:w-auto text-xs font-black uppercase tracking-[0.15em] px-10 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]">Salvar Demanda</button></div>
      </div>
      {validationError && <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 fade-in z-[80] font-bold text-[11px] uppercase tracking-widest w-11/12 max-w-md"><AlertTriangle size={20} className="shrink-0" /> <span className="truncate">{Array.isArray(validationError) ? `Obrigatório: ${validationError.join(", ")}` : String(validationError)}</span></div>}
    </div>
  );
}
