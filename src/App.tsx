import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Plus, Pencil, Timer as TimerIcon, Trash2, X, Clock, 
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
          durationMin: t.durationMin || 0, clientId: t.clientId || '', responsibleId: t.responsibleId,
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
      return (due !== null && due <= todayMs) || start === todayMs || sched === todayMs;
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
                            } else if (startMs === todayMs) {
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
                                  {t.isMeeting && t.scheduledStart && <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold" title="Reunião agendada"><CalendarDays size={10} /> Reunião</span>}
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
                  <a href={generateLimitEmailLink(client, worked)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors">
                    <AlertTriangle size={14} /> Enviar aviso de horas
                  </a>
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
function buildGCalLink(task: any, clientName: string) {
  if (!task.scheduledStart) return '#';
  const start = new Date(task.scheduledStart);
  if (isNaN(start.getTime())) return '#';
  const durMin = task.durationMin && task.durationMin > 0 ? task.durationMin : 60;
  const end = new Date(start.getTime() + durMin * 60000);
  // Título no padrão "NOME DO CLIENTE | TÍTULO DA DEMANDA" (cliente em caixa alta)
  const title = clientName ? `${clientName.toUpperCase()} | ${task.title || 'Demanda'}` : (task.title || 'Demanda');
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
      && (schedDay(t) === todayStr || startDay(t) === todayStr)
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
    if (t.templateId) return false; // instâncias geradas aparecem só no quadro
    if (!t.scheduledStart) return false;
    const s = new Date(t.scheduledStart);
    const sameDay = s.getFullYear() === day.getFullYear() && s.getMonth() === day.getMonth() && s.getDate() === day.getDate();
    if (sameDay) return true;
    if (!isActionable(t)) return false;
    if (t.recurrence === 'daily') return true;                                  // repete todo dia
    if (t.recurrence === 'weekly' && s.getDay() === day.getDay()) return true;  // mesmo dia da semana
    return false;
  });

  const cycleRecurrence = (taskId: string) => setTasks((prev: any) => prev.map((t: any) => {
    if (t.id !== taskId) return t;
    const order = ['none', 'daily', 'weekly'];
    return { ...t, recurrence: order[(order.indexOf(t.recurrence || 'none') + 1) % 3] };
  }));

  const recurLabel = (r: string) => r === 'daily' ? 'dia' : r === 'weekly' ? 'sem' : '';

  const setSchedule = (taskId: string, value: string) => setTasks((prev: any) => prev.map((t: any) => t.id === taskId ? { ...t, scheduledStart: value } : t));
  const setDuration = (taskId: string, dur: number) => setTasks((prev: any) => prev.map((t: any) => t.id === taskId ? { ...t, durationMin: dur } : t));

  const scheduleAndStart = (task: any, day: Date, hour: number, minute: number) => {
    const start = new Date(day); start.setHours(hour, minute, 0, 0);
    const value = toLocalInput(start);
    setTasks((prev: any) => prev.map((t: any) => t.id === task.id ? { ...t, scheduledStart: value } : t));
    const link = buildGCalLink({ ...task, scheduledStart: value }, clientName(task.clientId));
    if (link !== '#') window.open(link, '_blank', 'noopener');
  };

  const doMeeting = (task: any, day: Date, hour: number, minute: number) => {
    const start = new Date(day); start.setHours(hour, minute, 0, 0);
    setTasks((prev: any) => prev.map((t: any) => t.id === task.id ? { ...t, scheduledStart: toLocalInput(start), isMeeting: true } : t));
  };

  const doExecute = (task: any, day: Date, hour: number, minute: number) => {
    const start = new Date(day); start.setHours(hour, minute, 0, 0);
    const value = toLocalInput(start);
    setTasks((prev: any) => prev.map((t: any) => t.id === task.id ? { ...t, scheduledStart: value, status: 'inprogress', isMeeting: false } : t));
    const link = buildGCalLink({ ...task, scheduledStart: value }, clientName(task.clientId));
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

  const openCreateAt = (e: React.MouseEvent, day: Date) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const rawMin = ((e.clientY - rect.top) / ROW_H) * 60;
    const snapped = Math.max(0, Math.min(23 * 60 + 30, Math.round(rawMin / 30) * 30));
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
      scheduledStart: value, recurrence: cRecur, agendaOnly: true, history: [histEntry('created')],
    };
    setTasks((prev: any) => [...prev, newTask]);
    setCreateSlot(null);
  };

  const durationOf = (t: any) => (t.durationMin && t.durationMin > 0 ? t.durationMin : 60);

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
    const snapped = Math.max(0, Math.min(23 * 60 + 30, Math.round(rawMin / 30) * 30));
    return { dayIndex: idx, hour: Math.floor(snapped / 60), minute: snapped % 60, minutes: snapped };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === 'resize') {
      const rawMin = ((e.clientY - d.blockTop) / ROW_H) * 60;
      const snapped = Math.min(24 * 60, Math.max(30, Math.round(rawMin / 30) * 30));
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
                    return (
                      <div key={t.id} onClick={(e) => e.stopPropagation()} className={`absolute left-1 right-1 rounded-lg bg-teal-500/15 border border-teal-500/40 overflow-hidden group ${isDragging ? 'opacity-40' : ''}`} style={{ top, height: bh }}>
                        <div onPointerDown={(e) => beginDrag(e, t, 'move')} style={{ touchAction: 'none' }} className="h-full p-1.5 cursor-grab active:cursor-grabbing select-none">
                          <div className="text-[9px] font-mono font-bold text-teal-300 leading-none mb-1 flex items-center gap-1">{t.recurrence && t.recurrence !== 'none' && <span className="flex items-center gap-0.5 text-teal-400"><RotateCcw size={8} />{recurLabel(t.recurrence)}</span>}{pad(s.getHours())}:{pad(s.getMinutes())} · {dur}min</div>
                          <div className="text-[10px] font-bold text-white leading-tight line-clamp-2">{t.title}</div>
                          {cn && bh > ROW_H && <div className="text-[8px] text-teal-300/70 uppercase tracking-widest font-bold mt-1 truncate">{cn}</div>}
                        </div>
                        <div className="absolute top-1 right-1 flex gap-1">
                          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => cycleRecurrence(t.id)} className={`p-1 rounded hover:bg-black/60 ${t.recurrence && t.recurrence !== 'none' ? 'bg-teal-500/50 text-white' : 'bg-black/40 text-neutral-400 hover:text-teal-300'}`} title={t.recurrence === 'daily' ? 'Repete todo dia (clique: semana)' : t.recurrence === 'weekly' ? 'Repete toda semana (clique: parar)' : 'Repetir (clique: dia → semana)'}><RotateCcw size={11} /></button>
                          <a href={buildGCalLink(t, cn)} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()} className="p-1 rounded bg-black/40 text-teal-300 hover:bg-black/60" title="Abrir no Google Agenda"><ExternalLink size={11} /></a>
                          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { if (t.agendaOnly) { onDeleteTask(t.id); } else { setSchedule(t.id, ''); } }} className="p-1 rounded bg-black/40 text-neutral-400 hover:text-red-400 hover:bg-black/60" title={t.agendaOnly ? 'Excluir evento' : 'Desagendar'}><X size={11} /></button>
                        </div>
                        <div onPointerDown={(e) => { const rect = (e.currentTarget.parentElement as Element).getBoundingClientRect(); beginResize(e, t, rect.top); }} style={{ touchAction: 'none' }} className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize bg-teal-500/40 opacity-0 group-hover:opacity-100 transition-opacity" title="Ajustar duração" />
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
            <div className="p-5 flex flex-col gap-3 bg-[#09090b]">
              <button onClick={() => { doMeeting(scheduleChoice.task, scheduleChoice.day, scheduleChoice.hour, scheduleChoice.minute); setScheduleChoice(null); }} className="flex items-start gap-3 text-left p-4 rounded-2xl border border-[#27272a] bg-[#12121a] hover:border-teal-500/40 transition-colors">
                <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 shrink-0"><CalendarDays size={16} className="text-teal-400" /></div>
                <div>
                  <div className="text-sm font-bold text-white">Marcar reunião</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 leading-snug">Só marca o horário. Não muda a etapa e não abre o Google Agenda.</div>
                </div>
              </button>
              <button onClick={() => { doExecute(scheduleChoice.task, scheduleChoice.day, scheduleChoice.hour, scheduleChoice.minute); setScheduleChoice(null); }} className="flex items-start gap-3 text-left p-4 rounded-2xl border border-[#27272a] bg-[#12121a] hover:border-indigo-500/40 transition-colors">
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

function generateLimitEmailLink(clientData: any, consumedHours: number) {
  const emails = Array.isArray(clientData?.emails) ? clientData.emails : [];
  const emailTo = emails.join(',');
  const subject = `Aviso de Banco de Horas - ${clientData.name}`;
  const remaining = (clientData.contractedHours || 0) - consumedHours;
  
  const body = `Prezados(as),\n\nInformamos que o banco de horas contratado (${clientData.contractedHours}h) está prestes a ser atingido. No momento, restam apenas ${remaining.toFixed(1)}h disponíveis.\n\nGostaríamos de saber se autorizam a continuidade das demandas (cientes de que as horas excedentes poderão ser cobradas) ou se devemos pausar as atividades até à renovação do banco.\n\nCom os melhores cumprimentos,`;
  
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${emailTo}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function ClosureModal({ tasks, clients, responsibles, onClose, onFormalize }: any) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedNotionId, setCopiedNotionId] = useState<string | null>(null);
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

  const generateEmailLink = (clientTasks: any, clientData: any, mData: any) => {
    const emails = Array.isArray(clientData?.emails) ? clientData.emails : [];
    const emailTo = emails.join(',');
    const subject = `Atualização Semanal de Demandas - ${clientData ? clientData.name : 'Cliente'}`;
    const body = generateEmailText(clientTasks, mData);
    
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${emailTo}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
