import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Plus, Pencil, Timer as TimerIcon, Trash2, X, Clock, 
  Users, Building2, BarChart3, LogOut, RotateCcw, 
  Filter, AlertTriangle, GripVertical, Download, 
  Play, Pause, Square, CheckCircle2, User, CheckSquare,
  HelpCircle, ChevronDown, LayoutDashboard, Mail, Check, Copy, ClipboardList, Cloud, Lock,
  Eye, EyeOff, Settings, MonitorPlay, CloudRain, Sun, Moon, CloudLightning, Snowflake, CloudFog, UserCog, Calendar, ChevronUp, ChevronLeft, ChevronRight
} from "lucide-react";

// ==========================================
// CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE)
// ==========================================
const supabaseUrl = 'https://wztalukwyzqbjcvhrunt.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dGFsdWt3eXpxYmpjdmhydW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODM2NDQsImV4cCI6MjA5ODY1OTY0NH0.pvYYtBfK1HY73UbSadb8UiZARYvDFzxfB7qDwFLNUr8'; 
// ==========================================

// --- Funções Auxiliares ---
const nextId = () => Math.random().toString(36).substr(2, 9);

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

// --- Componente de Login ---
function LoginScreen({ onLogin }: { onLogin: any }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleLoginSubmit = async () => {
    setError('');
    const cleanName = name.trim();
    if (cleanName.length < 3) return setError("O nome deve ter no mínimo 3 caracteres.");
    if (password.length < 4) return setError("A senha deve ter no mínimo 4 caracteres.");
    
    setLoading(true);
    try {
      const { data: userRow, error: fetchErr } = await (window as any).supabaseClient
        .from('responsibles')
        .select('*')
        .ilike('name', cleanName)
        .maybeSingle();
      
      const isAdmin = cleanName.toLowerCase() === 'othávio campbell';

      if (userRow) {
        if (userRow.password && userRow.password !== password) {
          setError("Senha incorreta!");
          setLoading(false);
          return;
        }
        if (!userRow.password) {
           await (window as any).supabaseClient.from('responsibles').update({ password }).eq('id', userRow.id);
        }
        onLogin({ id: userRow.id, name: userRow.name, isAdmin, avatar: userRow.avatar || '' });
      } else {
        const newResp = { id: 'r'+Date.now(), name: cleanName, password, avatar: '' };
        const { error: insertErr } = await (window as any).supabaseClient.from('responsibles').insert([newResp]);
        if (insertErr) throw insertErr;
        onLogin({ id: newResp.id, name: cleanName, isAdmin, avatar: '' });
      }
    } catch (e) {
      console.error(e);
      setError("Erro ao conectar no servidor. Tente novamente.");
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

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {String(error)}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block ml-1">Usuário</label>
            <input 
              autoFocus
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors" 
              placeholder="Digite o seu nome" 
              value={name || ''} 
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block ml-1">Senha</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3.5 pr-10 text-sm text-white outline-none focus:border-indigo-500 transition-colors" 
                placeholder="Sua senha secreta" 
                value={password || ''} 
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button 
            disabled={!name.trim() || !password || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-4 font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex justify-center items-center gap-2 mt-4" 
            onClick={handleLoginSubmit}
          >
            {loading ? <Cloud size={18} className="animate-pulse" /> : 'Entrar no Sistema'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Componente Principal ---
export default function App() {
  const [supabaseReady, setSupabaseReady] = useState(!!(window as any).supabaseClient);

  // Injetar Polyfill de Drag & Drop para Mobile no carregamento da App
  useEffect(() => {
    const loadMobileDragDrop = async () => {
       const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
       if (!isTouchDevice) return;
       if ((window as any).MobileDragDrop) return;
       
       const script1 = document.createElement('script');
       script1.src = 'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/index.min.js';
       script1.onload = () => {
          (window as any).MobileDragDrop.polyfill({
             holdToDrag: 200 // Diminui o delay de arrasto para 0.2s para ficar mais fluido
          });
          window.addEventListener('touchmove', function() {}, {passive: false});
       };
       document.head.appendChild(script1);
    };
    loadMobileDragDrop();
  }, []);

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

  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("kanban_user_obj");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (userData: any) => {
    localStorage.setItem("kanban_user_obj", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("kanban_user_obj");
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

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
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

  // Monitora se está em Mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Busca dados da Nuvem
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
          setTasks(resTasks.data.map((t: any) => ({
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
            checklist: Array.isArray(t.checklist) ? t.checklist : [],
            timerElapsed: t.timerElapsed || 0,
            durationMin: t.durationMin || 0,
            // Fallbacks inteligentes: Se não existir createdAt, usamos o dueDate ou a data de hoje.
            createdAt: t.createdAt || t.dueDate || getBrasiliaDate(),
            completedAt: t.completedAt || ((t.status === 'done' || t.status === 'formalize') ? (t.dueDate || getBrasiliaDate()) : '')
          })));
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

  // Sincroniza Tarefas
  useEffect(() => {
    if (isCloudSynced && tasks.length > 0) {
      (window as any).supabaseClient.from('tasks').upsert(tasks).then();
    }
  }, [tasks, isCloudSynced]);

  // Sincroniza Clientes
  useEffect(() => {
    if (isCloudSynced && clients.length > 0) {
      (window as any).supabaseClient.from('clients').upsert(clients).then();
    }
  }, [clients, isCloudSynced]);

  const [activeTab, setActiveTab] = useState('board'); 
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeTooltipCol, setActiveTooltipCol] = useState<string | null>(null);
  
  // Controle de Filtros Principais
  const [showFilters, setShowFilters] = useState(false);
  const [filterClient, setFilterClient] = useState("all");
  const [filterResp, setFilterResp] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterDeadline, setFilterDeadline] = useState("all");
  
  const [filterCreatedStart, setFilterCreatedStart] = useState("");
  const [filterCreatedEnd, setFilterCreatedEnd] = useState("");
  const [filterCompletedStart, setFilterCompletedStart] = useState("");
  const [filterCompletedEnd, setFilterCompletedEnd] = useState("");
  
  const hasDateFilters = filterCreatedStart || filterCreatedEnd || filterCompletedStart || filterCompletedEnd;

  const [modal, setModal] = useState<any>(null); 
  const [profileModal, setProfileModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<any>(null);
  
  const [waitingPrompt, setWaitingPrompt] = useState<string | null>(null);
  const [donePrompt, setDonePrompt] = useState<any>(null);
  const [closureModal, setClosureModal] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  const [now, setNow] = useState(Date.now());

  const handleCloseTab = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setActiveTab('board');
      setIsClosingModal(false);
    }, 250);
  };

  useEffect(() => {
    const anyRunning = tasks.some((t) => t.timerRunning);
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [tasks]);

  const getElapsed = (t: any) => {
    if (t.timerRunning) return t.timerElapsed + (now - t.timerStart) / 1000;
    return t.timerElapsed || 0;
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
  }, [visibleClients, tasks, now]);

  const pendingLimitAlerts = clientsNearLimit.filter(c => !dismissedLimits.has(c.id));

  const canEditTask = (taskRespId: string) => taskRespId === user.id;

  const visibleTasks = user.isAdmin ? tasks : tasks.filter(t => t.responsibleId === user.id);
  
  const filteredTasks = visibleTasks.filter(
    (t) => {
      const todayStr = getBrasiliaDate();
      let matchDeadline = true;
      if (filterDeadline === 'startToday') matchDeadline = t.startDate === todayStr;
      if (filterDeadline === 'dueToday') matchDeadline = t.dueDate === todayStr;
      if (filterDeadline === 'late') matchDeadline = t.dueDate && t.dueDate < todayStr && t.status !== 'done' && t.status !== 'cancelled' && t.status !== 'formalize';

      return (filterClient === "all" || t.clientId === filterClient) &&
        (filterResp === "all" || t.responsibleId === filterResp) &&
        (filterPriority === "all" || t.priority === filterPriority) &&
        matchDeadline &&
        filterByPeriod(t.createdAt, filterCreatedStart, filterCreatedEnd) &&
        filterByPeriod(t.completedAt, filterCompletedStart, filterCompletedEnd);
    }
  );

  const activeTasksCount = visibleTasks.filter((t) => t.status !== "cancelled").length;
  const doneCount = visibleTasks.filter((t) => t.status === "done" || t.status === "formalize").length;
  const overallProgress = activeTasksCount ? Math.round((doneCount / activeTasksCount) * 100) : 0;
  
  const tasksForClosure = visibleTasks.filter(t => ['inprogress', 'paused', 'waiting', 'review', 'done', 'formalize'].includes(t.status));

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
        title: f.title.trim(),
        description: f.description.trim(),
        priority: f.priority || 'Média',
        durationMin: parseInt(f.durationMin) || 0,
        clientId: f.clientId || '',
        responsibleId: f.responsibleId || '',
        startDate: f.startDate || '',
        dueDate: f.dueDate || '',
        status: finalStatus,
        waitingFor: f.waitingFor || '',
        checklist: (f.checklist || []).filter((c: any) => c.text.trim()),
        timerRunning: false,
        timerStart: null,
        timerElapsed: 0,
        createdAt: getBrasiliaDate(),
        completedAt: (finalStatus === 'done' || finalStatus === 'formalize') ? getBrasiliaDate() : ''
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
            title: f.title.trim(), 
            description: f.description.trim(), 
            priority: f.priority || 'Média',
            durationMin: parseInt(f.durationMin) || 0,
            clientId: f.clientId || '',
            responsibleId: f.responsibleId || '',
            startDate: f.startDate || '',
            dueDate: f.dueDate || '',
            status: finalStatus,
            waitingFor: f.waitingFor || '',
            checklist: (f.checklist || []).filter((c: any) => c.text.trim()),
            timerRunning, timerElapsed, timerStart,
            createdAt: t.createdAt || getBrasiliaDate(),
            completedAt: (finalStatus === 'done' || finalStatus === 'formalize') ? (t.completedAt || getBrasiliaDate()) : t.completedAt
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
      const finalTask = {
         ...donePrompt.draftData,
         id: donePrompt.taskId,
         dueDate: donePrompt.date,
         timerElapsed: (parseInt(donePrompt.durationMin) || 0) * 60,
         durationMin: parseInt(donePrompt.durationMin) || 0,
         timerRunning: false,
         timerStart: null,
         status: 'done',
         completedAt: donePrompt.date
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

      const originalToIndex = donePrompt.targetId ? prev.findIndex(t => t.id.toString() === donePrompt.targetId.toString()) : -1;

      const newTasks = [...prev];
      newTasks.splice(fromIndex, 1);

      if (donePrompt.targetId) {
        let toIndex = newTasks.findIndex(t => t.id.toString() === donePrompt.targetId.toString());
        // Ajuste de Reordenamento na mesma coluna para baixo
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
      
      const originalToIndex = targetId ? prev.findIndex(t => t.id.toString() === targetId.toString()) : -1;

      const newTasks = [...prev];
      newTasks.splice(fromIndex, 1); 
      
      if (targetId) {
        let toIndex = newTasks.findIndex(t => t.id.toString() === targetId.toString());
        
        // Ajuste fundamental de reordenamento: se foi puxado de cima para baixo na mesma coluna, encaixa abaixo do alvo.
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
  
  const moveTaskHorizontal = (taskId: string, direction: 'left' | 'right', currentStatus: string) => {
    const currentColIdx = COLUMNS.findIndex(c => c.id === currentStatus);
    if (direction === 'left' && currentColIdx > 0) {
       handleRequestMove(taskId, null, COLUMNS[currentColIdx - 1].id);
    } else if (direction === 'right' && currentColIdx < COLUMNS.length - 1) {
       handleRequestMove(taskId, null, COLUMNS[currentColIdx + 1].id);
    }
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

  const handleDragStart = (e: any, taskId: string) => {
    // text/plain is much more reliable across browsers/mobile polyfills
    e.dataTransfer.setData("text/plain", taskId);
  };

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
             <SidebarBtn icon={<Clock size={20} />} active={activeTab === 'timer' && !isClosingModal} onClick={() => setActiveTab('timer')} tooltip="Timer" />
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
              <h1 className="font-bold text-2xl text-white tracking-tight">Kanban & Analytics</h1>
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
        {activeTab === 'timer' && <OverlayModal title="Cronómetro" icon={<Clock size={20} className="text-amber-500"/>} isClosing={isClosingModal} onClose={handleCloseTab}><TimerPanelContent tasks={filteredTasks} now={now} getElapsed={getElapsed} onToggleTimer={toggleTimer} user={user} /></OverlayModal>}
        {activeTab === 'responsibles' && <OverlayModal title="Equipe (Contas)" icon={<Users size={20} className="text-indigo-400"/>} isClosing={isClosingModal} onClose={handleCloseTab}><ResponsiblesPanelContent responsibles={responsibles} setResponsibles={setResponsibles} tasks={tasks} setTasks={setTasks} user={user} /></OverlayModal>}
        {activeTab === 'clients' && <OverlayModal title="Gestão de Clientes" icon={<Building2 size={20} className="text-purple-400"/>} isClosing={isClosingModal} onClose={handleCloseTab}><ClientsPanelContent clients={visibleClients} setClients={setClients} tasks={tasks} setTasks={setTasks} user={user} getElapsed={getElapsed} now={now} /></OverlayModal>}
        {activeTab === 'reports' && <AnalyticsModal isClosing={isClosingModal} onClose={handleCloseTab} tasks={filteredTasks} clients={visibleClients} responsibles={responsibles} now={now} getElapsed={getElapsed} globalLookerUrl={globalLookerUrl} setGlobalLookerUrl={setGlobalLookerUrl} />}

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

                   <div className="glass-panel h-11 flex-1 flex items-center px-4 rounded-xl gap-3 shadow-sm min-w-0 lg:flex">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Progresso</span>
                     <div className="flex-1 h-1.5 rounded-full bg-black/50 overflow-hidden border border-white/5">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${overallProgress}%` }} />
                     </div>
                     <span className="text-xs font-bold text-white shrink-0">{overallProgress}%</span>
                   </div>

                   {tasksForClosure.length > 0 && (
                      <button onClick={() => setClosureModal(true)} className="h-11 w-11 sm:w-auto px-0 sm:px-6 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] shrink-0">
                        <Mail size={16}/> <span className="whitespace-nowrap hidden sm:inline">Fechar Semana</span>
                      </button>
                    )}
                </div>
             </div>

             {/* Filtros Container Expansível */}
             {showFilters && (
               <div className="flex flex-col items-stretch gap-3 w-full animate-fade-in" onClick={e => e.stopPropagation()}>
                  <div className="glass-panel w-full p-4 rounded-xl flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center gap-4 shadow-sm border-indigo-500/20 bg-indigo-500/5">
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                       <FilterSelect value={filterClient} onChange={setFilterClient} options={visibleClients} defaultLabel="Todos Clientes" />
                       <div className="hidden sm:block w-px h-4 bg-white/10"></div>
                       <FilterSelect value={filterResp} onChange={setFilterResp} options={responsibles} defaultLabel="Todos Responsáveis" />
                       <div className="hidden sm:block w-px h-4 bg-white/10"></div>
                       <FilterSelect value={filterPriority} onChange={setFilterPriority} options={[{id: 'Baixa', name: 'Baixa'}, {id: 'Média', name: 'Média'}, {id: 'Alta', name: 'Alta'}]} defaultLabel="Prioridades" />
                       <div className="hidden sm:block w-px h-4 bg-white/10"></div>
                       <FilterSelect value={filterDeadline} onChange={setFilterDeadline} options={[{id: 'startToday', name: 'Iniciar Hoje'}, {id: 'dueToday', name: 'Entregar Hoje'}, {id: 'late', name: 'Atrasados'}]} defaultLabel="Prazos (Todos)" />
                    </div>

                    <div className="hidden lg:block w-px h-4 bg-white/10"></div>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto bg-black/20 p-3 lg:p-0 lg:bg-transparent rounded-lg border border-white/5 lg:border-none">
                       <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                          <label className="text-[10px] uppercase font-bold text-indigo-300 whitespace-nowrap">Criado de:</label>
                          <input type="date" value={filterCreatedStart} onChange={e => setFilterCreatedStart(e.target.value)} className="bg-[#12121a] lg:bg-transparent border border-[#27272a] lg:border-none rounded-lg px-2.5 py-1.5 lg:py-0 text-xs text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
                       </div>
                       <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                          <label className="text-[10px] uppercase font-bold text-neutral-500 whitespace-nowrap text-right">Até:</label>
                          <input type="date" value={filterCreatedEnd} onChange={e => setFilterCreatedEnd(e.target.value)} className="bg-[#12121a] lg:bg-transparent border border-[#27272a] lg:border-none rounded-lg px-2.5 py-1.5 lg:py-0 text-xs text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
                       </div>
                    </div>
                    
                    <div className="hidden lg:block w-px h-4 bg-white/10"></div>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto bg-black/20 p-3 lg:p-0 lg:bg-transparent rounded-lg border border-white/5 lg:border-none">
                       <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                          <label className="text-[10px] uppercase font-bold text-emerald-300 whitespace-nowrap">Concluído de:</label>
                          <input type="date" value={filterCompletedStart} onChange={e => setFilterCompletedStart(e.target.value)} className="bg-[#12121a] lg:bg-transparent border border-[#27272a] lg:border-none rounded-lg px-2.5 py-1.5 lg:py-0 text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]" />
                       </div>
                       <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                          <label className="text-[10px] uppercase font-bold text-neutral-500 whitespace-nowrap text-right">Até:</label>
                          <input type="date" value={filterCompletedEnd} onChange={e => setFilterCompletedEnd(e.target.value)} className="bg-[#12121a] lg:bg-transparent border border-[#27272a] lg:border-none rounded-lg px-2.5 py-1.5 lg:py-0 text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]" />
                       </div>
                    </div>

                    {hasDateFilters && (
                       <button onClick={() => { setFilterCreatedStart(''); setFilterCreatedEnd(''); setFilterCompletedStart(''); setFilterCompletedEnd(''); setFilterDeadline('all'); }} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-bold uppercase tracking-widest transition-colors ml-auto lg:ml-0 mt-2 lg:mt-0">
                         <X size={12}/> Limpar Datas
                       </button>
                    )}
                  </div>
               </div>
             )}
          </div>

          {/* Quadro Kanban */}
          <div className="flex-1 relative min-h-0">
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden px-4 md:px-8 pb-4 md:pb-8 kp-scroll">
              <div className="flex gap-4 sm:gap-5 h-full min-w-max items-stretch">
                {COLUMNS.map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.status === col.id);
                  return (
                    <div key={col.id} className="w-[88vw] max-w-[340px] sm:w-[340px] shrink-0 glass-panel rounded-2xl flex flex-col h-full shadow-sm relative">
                      
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
                      <div 
                        className="px-3 pb-3 flex-1 overflow-y-auto overflow-x-hidden kp-scroll flex flex-col gap-3 mt-3 min-h-0"
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleRequestMove(e.dataTransfer.getData("text/plain"), null, col.id);
                        }}
                      >
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
                          
                          const todayStr = getBrasiliaDate();
                          
                          let alertBadge = null;
                          if (!isDoneOrCancelled) {
                            if (t.dueDate && t.dueDate < todayStr) {
                              alertBadge = <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-bold"><AlertTriangle size={10}/> Atrasado</span>;
                            } else if (t.dueDate === todayStr) {
                              alertBadge = <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold"><Clock size={10}/> Entregar Hoje</span>;
                            } else if (t.startDate === todayStr) {
                              alertBadge = <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold"><Play size={10}/> Iniciar Hoje</span>;
                            }
                          }

                          return (
                            <div key={t.id} className={`rounded-2xl bg-[#1c1d26] border p-4 transition-all group relative ${isDoneOrCancelled ? 'opacity-60' : ''} ${!isEditable ? 'opacity-70 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:border-[#3f3f46] shadow-md'} ${dragOverId === t.id ? 'border-indigo-500 shadow-[0_-2px_15px_rgba(99,102,241,0.3)]' : 'border-[#2d3142]'}`} draggable={isEditable} onDragStart={(e) => { if(isEditable) handleDragStart(e, t.id); }} onDragOver={(e) => { if(isEditable) { e.preventDefault(); e.stopPropagation(); setDragOverId(t.id); } }} onDragLeave={() => setDragOverId(null)} onDrop={(e) => { if(isEditable) { e.preventDefault(); e.stopPropagation(); setDragOverId(null); handleRequestMove(e.dataTransfer.getData("text/plain"), t.id, col.id); } }}>
                              
                              {/* Badges do Cartão */}
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                  {client && <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md bg-white/5 text-neutral-300 font-bold max-w-[140px] truncate border border-white/5"><Building2 size={10} /> {client.name}</span>}
                                  <span className={`flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-1 rounded-md border font-bold ${prStyle.bg} ${prStyle.text} ${prStyle.border}`}>
                                    <span className={`w-1 h-1 rounded-full ${prStyle.dot}`} /> {t.priority}
                                  </span>
                                  {alertBadge}
                                </div>
                                
                                {isEditable ? (
                                  <div className="flex items-center gap-1">
                                    {isMobile && (
                                       <div className="flex items-center bg-black/40 rounded-lg p-1 gap-1 mr-2 border border-white/5">
                                          <button onClick={(e) => { e.stopPropagation(); moveTaskHorizontal(t.id, 'left', col.id); }} className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/20"><ChevronLeft size={14}/></button>
                                          <div className="flex flex-col gap-1">
                                             <button onClick={(e) => { e.stopPropagation(); moveTaskVertical(t.id, 'up'); }} className="p-0.5 rounded text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/20"><ChevronUp size={12}/></button>
                                             <button onClick={(e) => { e.stopPropagation(); moveTaskVertical(t.id, 'down'); }} className="p-0.5 rounded text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/20"><ChevronDown size={12}/></button>
                                          </div>
                                          <button onClick={(e) => { e.stopPropagation(); moveTaskHorizontal(t.id, 'right', col.id); }} className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/20"><ChevronRight size={14}/></button>
                                       </div>
                                    )}
                                    <GripVertical size={14} className="text-neutral-600 shrink-0 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity block" />
                                  </div>
                                ) : (
                                  <Lock size={12} className="text-neutral-600 shrink-0 block" />
                                )}
                              </div>

                              <div className="mb-3">
                                <h3 className={`text-[13px] font-bold leading-relaxed mb-1.5 ${isDoneOrCancelled ? 'text-neutral-500 line-through' : 'text-white'}`}>{t.title}</h3>
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
                                        <Clock size={10} className={t.timerRunning ? "text-amber-500 animate-pulse" : "text-neutral-500"} /> {formatTime(getElapsed(t))}
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

      {/* MOBILE BOTTOM NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around pt-2.5 px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-[#12121a]/95 backdrop-blur-md border-t border-[#27272a] z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         <MobileNavBtn icon={<LayoutDashboard size={20} />} label="Board" active={activeTab === 'board' && !isClosingModal} onClick={() => {if(activeTab !== 'board') handleCloseTab()}} />
         <MobileNavBtn icon={<Clock size={20} />} label="Timer" active={activeTab === 'timer' && !isClosingModal} onClick={() => setActiveTab('timer')} />
         <MobileNavBtn icon={<Users size={20} />} label="Equipe" active={activeTab === 'responsibles' && !isClosingModal} onClick={() => setActiveTab('responsibles')} />
         <MobileNavBtn icon={<Building2 size={20} />} label="Clientes" active={activeTab === 'clients' && !isClosingModal} onClick={() => setActiveTab('clients')} alert={clientsNearLimit.length > 0} />
         <MobileNavBtn icon={<BarChart3 size={20} />} label="Relatórios" active={activeTab === 'reports' && !isClosingModal} onClick={() => setActiveTab('reports')} />
      </div>

      {/* Pop-up: Perfil do Utilizador */}
      {profileModal && <ProfileModal user={user} responsibles={responsibles} onClose={() => setProfileModal(false)} onUpdate={(u: any) => { setUser(u); localStorage.setItem("kanban_user_obj", JSON.stringify(u)); }} />}

      {/* Pop-up: Aguardando Retorno */}
      {waitingPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70] fade-in" onClick={() => setWaitingPrompt(null)}>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[90] fade-in" onClick={() => { setDonePrompt(null); setValidationError(null); }}>
          <div className="w-full max-w-sm rounded-[32px] bg-[#12121a] border border-[#27272a] shadow-2xl relative overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
            <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-[#27272a] flex items-center gap-3 text-emerald-500">
              <CheckCircle2 size={24} />
              <h3 className="font-bold text-xl text-white tracking-tight">Finalizar Demanda</h3>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] fade-in" onClick={() => setDismissedLimits(new Set([...dismissedLimits, ...pendingLimitAlerts.map(c => c.id)]))}>
          <div className="w-full max-w-md rounded-[32px] bg-[#12121a] border border-red-500/30 flex flex-col shadow-2xl overflow-hidden animate-modal-pop" onClick={e => e.stopPropagation()}>
            <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-[#27272a] flex items-center gap-3">
              <div className="p-3 bg-red-500/10 rounded-2xl shadow-inner text-red-500"><AlertTriangle size={24} /></div>
              <h3 className="font-bold text-xl text-white tracking-tight">Alerta de Limite</h3>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110] fade-in" onClick={() => setConfirmDelete(null)}>
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
                  setTasks((prev: any) => prev.filter((t: any) => t.id !== idToDelete));
                  setConfirmDelete(null);
                  if (window.supabaseClient) await window.supabaseClient.from('tasks').delete().eq('id', idToDelete.toString());
                }} 
                className="w-full sm:flex-1 py-3.5 sm:py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all text-sm shadow-lg shadow-red-600/10"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Popups Principais */}
      {closureModal && <ClosureModal tasks={tasksForClosure} clients={clients} responsibles={responsibles} onClose={() => setClosureModal(false)} onFormalize={(clientId: string | null) => { if (clientId) { setTasks((prev: any) => prev.map((t: any) => (t.status === 'done' && t.clientId === clientId) ? { ...t, status: 'formalize' } : t)); } else { setTasks((prev: any) => prev.map((t: any) => t.status === 'done' ? { ...t, status: 'formalize' } : t)); setClosureModal(false); } }} />}
      {modal && <TaskModal modal={modal} setModal={setModal} clients={visibleClients} responsibles={responsibles} closeModal={closeModal} saveModal={saveModal} validationError={validationError} setValidationError={setValidationError} user={user} />}
    </div>
  );
}
