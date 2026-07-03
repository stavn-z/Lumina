import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, Pencil, Timer as TimerIcon, Trash2, X, Clock, 
  Users, Building2, BarChart3, LogOut, RotateCcw, 
  Filter, AlertTriangle, GripVertical, Download, 
  Play, Square, CheckCircle2, User, CheckSquare,
  HelpCircle, ChevronDown, LayoutDashboard, Mail, Check, Copy, ClipboardList
} from "lucide-react";

// ==========================================
// CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE)
// ==========================================
const supabaseUrl = 'https://wztalukwyzqbjcvhrunt.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dGFsdWt3eXpxYmpjdmhydW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODM2NDQsImV4cCI6MjA5ODY1OTY0NH0.pvYYtBfK1HY73UbSadb8UiZARYvDFzxfB7qDwFLNUr8'; 
// ==========================================

// --- Configurações e Dados Iniciais ---
const COLUMNS = [
  { id: "backlog", name: "Backlog", dot: "bg-indigo-500", accent: "border-indigo-500", bg: "bg-indigo-500/10", btn: "bg-indigo-600 hover:bg-indigo-500", help: "Ideias, novas demandas e solicitações que ainda não foram priorizadas ou analisadas pela equipa." },
  { id: "todo", name: "A Fazer", dot: "bg-amber-500", accent: "border-amber-500", bg: "bg-amber-500/10", btn: "bg-amber-500 hover:bg-amber-400 text-black", help: "Tarefas priorizadas, com responsável definido e prontas para serem iniciadas." },
  { id: "inprogress", name: "Em Andamento", dot: "bg-blue-500", accent: "border-blue-500", bg: "bg-blue-500/10", btn: "bg-blue-600 hover:bg-blue-500", help: "Tarefas que estão a ser executadas de forma ativa neste exato momento." },
  { id: "paused", name: "Pausado", dot: "bg-orange-500", accent: "border-orange-500", bg: "bg-orange-500/10", btn: "bg-orange-600 hover:bg-orange-500", help: "Tarefas temporariamente interrompidas a aguardar a resolução de algum bloqueio." },
  { id: "waiting", name: "Aguardando Retorno", dot: "bg-pink-500", accent: "border-pink-500", bg: "bg-pink-500/10", btn: "bg-pink-600 hover:bg-pink-500", help: "Aguardar validação, ficheiro ou resposta do Cliente ou da Equipa." },
  { id: "review", name: "Em Revisão", dot: "bg-purple-500", accent: "border-purple-500", bg: "bg-purple-500/10", btn: "bg-purple-600 hover:bg-purple-500", help: "Tarefas concluídas que aguardam aprovação ou validação do cliente/gestor." },
  { id: "done", name: "Concluído", dot: "bg-green-500", accent: "border-green-500", bg: "bg-green-500/10", btn: "bg-green-600 hover:bg-green-500", help: "Tarefas totalmente finalizadas e validadas." },
  { id: "formalize", name: "Formalizar", dot: "bg-teal-500", accent: "border-teal-500", bg: "bg-teal-500/10", btn: "bg-teal-600 hover:bg-teal-500", help: "Tarefas finalizadas que aguardam ou já tiveram o relatório enviado para o cliente." },
  { id: "cancelled", name: "Cancelado", dot: "bg-red-500", accent: "border-red-500", bg: "bg-red-500/10", btn: "bg-red-600 hover:bg-red-500", help: "Tarefas despriorizadas, descartadas ou que não serão mais executadas." },
];

const PRIORITY_STYLE = {
  Baixa: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-500" },
  Média: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" },
  Alta: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
};

// --- Funções Auxiliares ---
const nextId = () => Math.random().toString(36).substr(2, 9);

function formatTime(totalSeconds) {
  const s = Math.floor(totalSeconds);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function downloadCSV(dataArray, filename) {
  const csvContent = "data:text/csv;charset=utf-8," + dataArray.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- Componente de Login ---
function LoginScreen({ onLogin }) {
  const [name, setName] = useState('');
  
  return (
    <div className="min-h-screen bg-[#0f1015] flex items-center justify-center p-4">
      <div className="bg-[#161821] p-8 rounded-2xl border border-[#2a2d3d] w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <BarChart3 size={24} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Kanban Pro</h1>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">Nome de Utilizador</label>
            <input 
              autoFocus
              className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-colors" 
              placeholder="Digite o seu nome" 
              value={name} 
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name && onLogin(name)}
            />
          </div>
          <button 
            disabled={!name.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 font-medium transition-colors" 
            onClick={() => onLogin(name)}
          >
            Aceder ao Painel
          </button>
        </div>
      </div>
    </div>
  );
}


// --- Componente Principal ---
export default function App() {
  const [supabaseReady, setSupabaseReady] = useState(!!window.supabaseClient);

  useEffect(() => {
    if (window.supabase) {
      if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      }
      setSupabaseReady(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'supabase-script';
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
       window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
       setSupabaseReady(true);
    };
    document.body.appendChild(script);
  }, []);

  const [user, setUser] = useState(() => localStorage.getItem("kanban_user") || null);

  const handleLogin = (name) => {
    localStorage.setItem("kanban_user", name);
    setUser(name);
  };

  const handleLogout = () => {
    localStorage.removeItem("kanban_user");
    setUser(null);
  };

  if (!supabaseReady) {
    return (
      <div className="min-h-screen bg-[#0f1015] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 mb-6 animate-pulse">
            <BarChart3 size={24} className="text-indigo-400" />
        </div>
        <div className="text-indigo-400 font-medium animate-pulse text-sm">A conectar aos servidores da nuvem...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <KanbanMain user={user} onLogout={handleLogout} />;
}

function KanbanMain({ user, onLogout }) {
  const [tasks, setTasks] = useState(() => { const saved = localStorage.getItem("kanban_tasks"); return saved ? JSON.parse(saved) : []; });
  const [clients, setClients] = useState(() => { const saved = localStorage.getItem("kanban_clients"); return saved ? JSON.parse(saved) : []; });
  const [responsibles, setResponsibles] = useState(() => { const saved = localStorage.getItem("kanban_responsibles"); return saved ? JSON.parse(saved) : []; });
  
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  // 1. Busca todos os dados do Supabase ao iniciar a aplicação
  useEffect(() => {
    async function fetchCloudData() {
      try {
        const [resTasks, resClients, resResp] = await Promise.all([
          window.supabaseClient.from('tasks').select('*'),
          window.supabaseClient.from('clients').select('*'),
          window.supabaseClient.from('responsibles').select('*')
        ]);

        // Se houver dados na nuvem, substitui os locais (isso resolve o problema do navegador vazio)
        if (resTasks.data && resTasks.data.length > 0) setTasks(resTasks.data);
        if (resClients.data && resClients.data.length > 0) setClients(resClients.data);
        if (resResp.data && resResp.data.length > 0) setResponsibles(resResp.data);

      } catch (error) {
        console.error("Erro ao buscar dados do Supabase:", error);
      } finally {
        setIsCloudSynced(true);
      }
    }
    fetchCloudData();
  }, []);

  // 2. Sempre que os dados mudam localmente, guarda-os também no Supabase
  useEffect(() => {
    localStorage.setItem("kanban_tasks", JSON.stringify(tasks));
    if (isCloudSynced && tasks.length > 0) window.supabaseClient.from('tasks').upsert(tasks).then();
  }, [tasks, isCloudSynced]);

  useEffect(() => {
    localStorage.setItem("kanban_clients", JSON.stringify(clients));
    if (isCloudSynced && clients.length > 0) window.supabaseClient.from('clients').upsert(clients).then();
  }, [clients, isCloudSynced]);

  useEffect(() => {
    localStorage.setItem("kanban_responsibles", JSON.stringify(responsibles));
    if (isCloudSynced && responsibles.length > 0) window.supabaseClient.from('responsibles').upsert(responsibles).then();
  }, [responsibles, isCloudSynced]);

  const [activeTab, setActiveTab] = useState('board'); 
  const [filterClient, setFilterClient] = useState("all");
  const [filterResp, setFilterResp] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  
  const [modal, setModal] = useState(null); 
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [validationError, setValidationError] = useState(null);
  
  const [waitingPrompt, setWaitingPrompt] = useState(null);
  const [donePrompt, setDonePrompt] = useState(null);
  const [closureModal, setClosureModal] = useState(false);
  const [dragOverId, setDragOverId] = useState(null);
  
  const [now, setNow] = useState(Date.now());

  // Relógio do cronómetro
  useEffect(() => {
    const anyRunning = tasks.some((t) => t.timerRunning);
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [tasks]);

  const getElapsed = (t) => {
    if (t.timerRunning) return t.timerElapsed + (now - t.timerStart) / 1000;
    return t.timerElapsed;
  };

  // Filtros
  const filteredTasks = tasks.filter(
    (t) =>
      (filterClient === "all" || t.clientId === filterClient) &&
      (filterResp === "all" || t.responsibleId === filterResp) &&
      (filterPriority === "all" || t.priority === filterPriority)
  );

  const activeTasksCount = tasks.filter((t) => t.status !== "cancelled").length;
  const doneCount = tasks.filter((t) => t.status === "done" || t.status === "formalize").length;
  const overallProgress = activeTasksCount ? Math.round((doneCount / activeTasksCount) * 100) : 0;
  const doneTasks = tasks.filter(t => t.status === 'done');

  // Modais Principais
  const emptyForm = { title: "", description: "", priority: "Média", durationMin: "", clientId: "", responsibleId: "", dueDate: "", status: "", waitingFor: "", checklist: [] };

  function openAddModal(status) {
    setValidationError(null);
    setModal({ mode: "add", status, form: { ...emptyForm, status, responsibleId: responsibles[0]?.id || "" } });
  }
  function openEditModal(task) {
    setValidationError(null);
    setModal({ mode: "edit", task, form: { ...task, checklist: task.checklist.map((c) => ({ ...c })) } });
  }
  function closeModal() {
    setModal(null);
    setValidationError(null);
  }

  function saveModal() {
    const f = modal.form;
    const missing = [];
    if (!f.title.trim()) missing.push("Título");
    if (!f.responsibleId) missing.push("Responsável");
    if (f.status === 'waiting' && !f.waitingFor) missing.push("Aguardando Retorno De");
    
    if (missing.length > 0) {
      setValidationError(missing);
      return;
    }

    if (modal.mode === "add") {
      const newTask = {
        id: nextId(),
        ...f,
        title: f.title.trim(),
        description: f.description.trim(),
        status: f.status || modal.status,
        checklist: f.checklist.filter((c) => c.text.trim()),
        timerRunning: false,
        timerStart: null,
        timerElapsed: 0,
      };
      setTasks((prev) => [...prev, newTask]);
    } else {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== modal.task.id) return t;
          
          let timerRunning = t.timerRunning;
          let timerElapsed = t.timerElapsed;
          let timerStart = t.timerStart;

          if ((f.status === 'done' || f.status === 'cancelled' || f.status === 'formalize') && timerRunning) {
            timerRunning = false;
            timerElapsed += (Date.now() - timerStart) / 1000;
            timerStart = null;
          }

          if (!timerRunning && (f.status === 'done' || f.status === 'formalize' || f.status === 'cancelled')) {
            timerElapsed = (parseInt(f.durationMin) || 0) * 60;
          }

          return { 
            ...t, ...f, 
            title: f.title.trim(), 
            description: f.description.trim(), 
            checklist: f.checklist.filter((c) => c.text.trim()),
            status: f.status,
            timerRunning, timerElapsed, timerStart
          };
        })
      );
    }
    closeModal();
  }

  function toggleTimer(id) {
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

  const handleRequestMove = (taskId, targetId, newStatus) => {
    const task = tasks.find(t => t.id.toString() === taskId.toString());
    if (!task) return;

    if (newStatus === 'done' && task.status !== 'done') {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;

      setDonePrompt({
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

      const newTasks = [...prev];
      newTasks.splice(fromIndex, 1);

      if (donePrompt.targetId) {
        const toIndex = newTasks.findIndex(t => t.id.toString() === donePrompt.targetId.toString());
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

  const moveTask = (draggedId, targetId, newStatus) => {
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
      
      const newTasks = [...prev];
      newTasks.splice(fromIndex, 1); 
      
      if (targetId) {
        const toIndex = newTasks.findIndex(t => t.id.toString() === targetId.toString());
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

  const toggleChecklistItem = (taskId, itemId) => {
    setTasks(prev => {
      const newTasks = prev.map(t => {
        if (t.id !== taskId) return t;
        const newChecklist = t.checklist.map(c => c.id === itemId ? { ...c, done: !c.done } : c);
        return { ...t, checklist: newChecklist };
      });

      const updatedTask = newTasks.find(t => t.id === taskId);
      const allDone = updatedTask.checklist.length > 0 && updatedTask.checklist.every(c => c.done);

      if (allDone && updatedTask.status !== 'done' && updatedTask.status !== 'cancelled' && updatedTask.status !== 'formalize') {
        setTimeout(() => handleRequestMove(taskId, null, 'done'), 0);
      }

      return newTasks;
    });
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  return (
    <div className="h-screen w-full bg-[#0f1015] text-neutral-100 flex flex-col overflow-hidden font-sans">
      <style>{`
        .kp-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .kp-scroll::-webkit-scrollbar-thumb { background: #2a2d3d; border-radius: 6px; }
        .kp-scroll::-webkit-scrollbar-thumb:hover { background: #3f4359; }
        .kp-scroll::-webkit-scrollbar-track { background: transparent; }
        
        .fade-in { animation: fadeIn 0.2s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        
        /* Remove as setinhas dos campos numéricos (Chrome, Safari, Edge, Opera) */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        /* Remove as setinhas no Firefox */
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Header Fixo */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#2a2d3d] bg-[#161821] z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2a2d3d] flex items-center justify-center">
            <BarChart3 size={16} className="text-neutral-300" />
          </div>
          <span className="font-semibold text-lg">Kanban Pro</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 ml-2">
            Olá, {user}!
          </span>
          {isCloudSynced && <span className="ml-2 text-[10px] text-green-500 flex items-center gap-1"><Cloud size={12}/> Nuvem Ativa</span>}
        </div>
        <div className="flex items-center gap-2">
          <HeaderBtn icon={<LayoutDashboard size={14} />} label="Quadro Inicial" active={activeTab === 'board'} onClick={() => setActiveTab('board')} color="indigo" />
          <HeaderBtn icon={<Clock size={14} />} label="Cronómetro" active={activeTab === 'timer'} onClick={() => setActiveTab('timer')} color="amber" />
          <HeaderBtn icon={<Users size={14} />} label="Responsáveis" active={activeTab === 'responsibles'} onClick={() => setActiveTab('responsibles')} color="indigo" />
          <HeaderBtn icon={<Building2 size={14} />} label="Clientes" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} color="purple" />
          <HeaderBtn icon={<BarChart3 size={14} />} label="Relatórios" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} color="blue" />
          <div className="w-px h-6 bg-[#2a2d3d] mx-1"></div>
          <HeaderBtn icon={<LogOut size={14} />} label="Sair" onClick={onLogout} />
        </div>
      </div>

      {/* Área Dinâmica de Painéis */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden kp-scroll flex flex-col">
        
        {/* Painéis Expansíveis */}
        {activeTab === 'timer' && (
          <TimerPanel tasks={tasks} now={now} getElapsed={getElapsed} onToggleTimer={toggleTimer} />
        )}
        
        {activeTab === 'responsibles' && (
          <ResponsiblesPanel responsibles={responsibles} setResponsibles={setResponsibles} tasks={tasks} setTasks={setTasks} />
        )}

        {activeTab === 'clients' && (
          <ClientsPanel clients={clients} setClients={setClients} tasks={tasks} setTasks={setTasks} />
        )}

        {activeTab === 'reports' && (
          <ReportsPanel tasks={tasks} clients={clients} responsibles={responsibles} now={now} getElapsed={getElapsed} />
        )}

        {/* Estatísticas (Sempre visível no Board) */}
        <div className={`shrink-0 px-5 pt-5 pb-3 ${activeTab !== 'board' ? 'hidden' : ''}`}>
          <div className="w-full rounded-xl bg-[#161821] border border-[#2a2d3d] px-5 py-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-2.5">
              <span className="font-medium">Progresso Geral</span>
              <span className="text-green-400 font-bold">{overallProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#0f1015] overflow-hidden border border-[#2a2d3d]">
              <div className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        </div>

        {/* Filtros e Botões Globais */}
        <div className={`shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 pb-4 ${activeTab !== 'board' ? 'hidden' : ''}`}>
          <div className="flex items-center gap-3">
            <Filter size={16} className="text-neutral-500 shrink-0" />
            <FilterSelect value={filterClient} onChange={setFilterClient} options={clients} defaultLabel="Todos os clientes" />
            <FilterSelect value={filterResp} onChange={setFilterResp} options={responsibles} defaultLabel="Todos os responsáveis" />
            <FilterSelect value={filterPriority} onChange={setFilterPriority} options={[{id: 'Baixa', name: 'Baixa'}, {id: 'Média', name: 'Média'}, {id: 'Alta', name: 'Alta'}]} defaultLabel="Todas as prioridades" />
          </div>
          
          {/* Botão de Fechamento Semanal */}
          {doneTasks.length > 0 && (
            <button 
              onClick={() => setClosureModal(true)} 
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/10 text-purple-400 border border-purple-500/30 hover:bg-purple-600/20 rounded-lg text-xs font-semibold transition-colors animate-fade-in"
            >
              <Mail size={14}/> Fechamento Semanal
            </button>
          )}
        </div>

        {/* Quadro Kanban (Scroll Horizontal) */}
        <div className={`flex-1 overflow-x-auto px-5 pb-5 kp-scroll ${activeTab !== 'board' ? 'hidden' : ''}`}>
          <div className="flex gap-4 items-start h-full min-w-max pb-2">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <div 
                  key={col.id} 
                  className={`w-[320px] shrink-0 rounded-xl bg-[#161821] border-t-[3px] ${col.accent} border-[#2a2d3d] border-x border-b flex flex-col max-h-full shadow-sm`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleRequestMove(e.dataTransfer.getData("taskId"), null, col.id);
                  }}
                >
                  {/* Header Coluna com Tooltip de Ajuda */}
                  <div className="px-3.5 pt-3.5 pb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold relative group cursor-default">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dot} shadow-sm shrink-0`} />
                      {col.name}
                      <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 transition-colors" />
                      
                      {/* Tooltip Hover */}
                      <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-[#1c1e29] border border-[#3f4359] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                        <div className="text-xs font-bold mb-1.5 text-white flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${col.dot}`} /> {col.name}
                        </div>
                        <div className="text-[11px] text-neutral-400 leading-relaxed font-normal">{col.help}</div>
                      </div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#0f1015] text-neutral-400 border border-[#2a2d3d] font-medium">
                      {colTasks.length}
                    </span>
                  </div>
                  
                  {/* Botão Nova Tarefa */}
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => openAddModal(col.id)}
                      className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2 transition-colors ${col.btn}`}
                    >
                      <Plus size={14} /> Nova Tarefa
                    </button>
                  </div>
                  
                  {/* Lista de Cards */}
                  <div className="px-3 pb-3 flex-1 overflow-y-auto kp-scroll flex flex-col gap-2.5">
                    {colTasks.length === 0 && (
                      <div className="text-center text-xs text-neutral-600 py-6 select-none border border-dashed border-[#2a2d3d] rounded-lg pointer-events-none">
                        Arraste cards para cá
                      </div>
                    )}
                    {colTasks.map((t) => {
                      const total = t.checklist.length;
                      const done = t.checklist.filter((c) => c.done).length;
                      const pct = total ? Math.round((done / total) * 100) : 0;
                      const client = clients.find(c => c.id === t.clientId);
                      const resp = responsibles.find(r => r.id === t.responsibleId);
                      const prStyle = PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.Média;
                      const isDoneOrCancelled = t.status === "done" || t.status === "cancelled" || t.status === "formalize";

                      return (
                        <div 
                          key={t.id} 
                          className={`rounded-xl bg-[#1c1e29] border p-3.5 transition-all cursor-grab active:cursor-grabbing group 
                            ${isDoneOrCancelled ? 'opacity-80 hover:opacity-100 hover:border-[#3f4359]' : 'hover:border-[#3f4359]'}
                            ${dragOverId === t.id ? 'border-indigo-500 shadow-[0_-2px_0_#6366f1]' : 'border-[#2a2d3d]'}
                          `}
                          draggable
                          onDragStart={(e) => handleDragStart(e, t.id)}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(t.id); }}
                          onDragLeave={() => setDragOverId(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverId(null);
                            handleRequestMove(e.dataTransfer.getData("taskId"), t.id, col.id);
                          }}
                        >
                          <div className="flex gap-2 items-start mb-2">
                            <GripVertical size={14} className="text-neutral-600 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex-1">
                              <div className={`text-sm font-semibold mb-1 leading-snug ${isDoneOrCancelled ? 'text-neutral-400 line-through' : 'text-neutral-200'}`}>{t.title}</div>
                              {t.description && (
                                <div className="text-[11px] text-neutral-400 mb-2 line-clamp-2">{t.description}</div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-3 pl-5">
                            <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border font-medium ${prStyle.bg} ${prStyle.text} ${prStyle.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${prStyle.dot}`} /> {t.priority}
                            </span>
                            {client && (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium max-w-[120px] truncate">
                                <Building2 size={10} /> {client.name}
                              </span>
                            )}
                            {resp && (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-[#2a2d3d] text-neutral-300 border border-[#3f4359] font-medium max-w-[120px] truncate">
                                <User size={10} /> {resp.name}
                              </span>
                            )}
                          </div>

                          {t.status === 'waiting' && t.waitingFor && (
                            <div className="flex items-center gap-1.5 text-[10px] mb-3 pl-5 font-medium w-fit bg-pink-500/10 border border-pink-500/20 px-2 py-1 rounded-md text-pink-400">
                              <Clock size={12} />
                              Aguardando: {t.waitingFor}
                            </div>
                          )}

                          {total > 0 && (
                            <div className="mb-3 pl-5">
                              <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1.5 font-medium">
                                <span className="flex items-center gap-1"><CheckSquare size={10}/> {done}/{total}</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-[#0f1015] overflow-hidden mb-2 border border-[#2a2d3d]">
                                <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                {t.checklist.map((c) => (
                                  <label key={c.id} className="flex items-start gap-2 text-[11px] text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={c.done}
                                      onChange={() => toggleChecklistItem(t.id, c.id)}
                                      className="accent-indigo-500 w-3 h-3 mt-0.5 rounded-sm shrink-0 bg-[#0f1015] border-[#2a2d3d]"
                                    />
                                    <span className={`leading-snug ${c.done ? "line-through text-neutral-600" : ""}`}>{c.text}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Timer Dinâmico */}
                          {(t.timerRunning || t.timerElapsed > 0) && !isDoneOrCancelled && (
                            <div className="flex items-center gap-1.5 text-[11px] mb-3 pl-5 font-mono font-medium w-fit bg-[#0f1015] border border-[#2a2d3d] px-2 py-1 rounded-md text-neutral-400">
                              <Clock size={12} className={t.timerRunning ? "text-amber-500 animate-pulse" : "text-neutral-500"} />
                              {formatTime(getElapsed(t))}
                            </div>
                          )}

                          {/* Timer Fixo */}
                          {isDoneOrCancelled && (t.timerElapsed > 0 || t.durationMin) && (
                            <div className="flex flex-col gap-1.5 mb-3 pl-5 bg-[#0f1015]/50 border border-[#2a2d3d]/50 p-2 rounded-lg w-fit">
                              {t.timerElapsed > 0 && (
                                <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400">
                                  <CheckCircle2 size={12} className="text-green-500" />
                                  Tempo Gasto: {formatTime(t.timerElapsed)}
                                </div>
                              )}
                              {t.durationMin && (
                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                                  <TimerIcon size={12} />
                                  Estimado: {t.durationMin} min
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 pl-5 pt-2 border-t border-[#2a2d3d]/50">
                            <SmallBtn onClick={() => openEditModal(t)} icon={<Pencil size={12} />} label="Editar" />
                            
                            {!isDoneOrCancelled && (
                              <SmallBtn onClick={() => toggleTimer(t.id)} icon={t.timerRunning ? <Square size={12}/> : <Play size={12} />} label={t.timerRunning ? "Parar" : "Timer"} active={t.timerRunning} tone="amber" />
                            )}
                            
                            {t.status !== "cancelled" ? (
                              <SmallBtn onClick={() => handleRequestMove(t.id, null, 'cancelled')} icon={<X size={12} />} label="Cancelar" tone="red" />
                            ) : (
                              <>
                                <SmallBtn onClick={() => handleRequestMove(t.id, null, 'backlog')} icon={<RotateCcw size={12} />} label="Restaurar" tone="green" />
                                <SmallBtn onClick={() => setConfirmDelete(t.id)} icon={<Trash2 size={12} />} label="" tone="red" />
                              </>
                            )}
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

      {/* Pop-up: Aguardando Retorno */}
      {waitingPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70] fade-in">
          <div className="w-full max-w-sm rounded-xl bg-[#161821] border border-[#2a2d3d] p-6 shadow-2xl relative">
            <button onClick={() => setWaitingPrompt(null)} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-4 text-pink-500">
              <div className="p-2 bg-pink-500/10 rounded-lg"><HelpCircle size={20} /></div>
              <h3 className="font-semibold text-base">Aguardando Retorno</h3>
            </div>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              O card foi movido para <b>Aguardando Retorno</b>. De quem está a aguardar uma resposta ou ação?
            </p>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setTasks(prev => prev.map(t => t.id === waitingPrompt ? { ...t, waitingFor: 'Cliente' } : t));
                  setWaitingPrompt(null);
                }}
                className="flex-1 py-2.5 rounded-lg border border-[#2a2d3d] hover:border-[#3f4359] hover:bg-[#2a2d3d] text-white font-medium transition-colors text-sm"
              >
                Cliente
              </button>
              <button 
                onClick={() => {
                  setTasks(prev => prev.map(t => t.id === waitingPrompt ? { ...t, waitingFor: 'Equipa Interna' } : t));
                  setWaitingPrompt(null);
                }}
                className="flex-1 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium transition-colors text-sm"
              >
                Equipa Interna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Obrigatório: Conclusão da Demanda (Data e Tempo) */}
      {donePrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[90] fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#161821] border border-[#2a2d3d] shadow-2xl relative overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2a2d3d] bg-[#1a1c24] flex items-center gap-3 text-green-500">
              <CheckCircle2 size={20} />
              <h3 className="font-semibold text-base text-white">Concluir Demanda</h3>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              {validationError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={14} /> {validationError[0]}
                </div>
              )}
              <div>
                <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">Data de Entrega *</label>
                <input 
                  type="date" 
                  value={donePrompt.date} 
                  onChange={e => { setDonePrompt({...donePrompt, date: e.target.value}); setValidationError(null); }} 
                  className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-green-500 [color-scheme:dark]" 
                />
              </div>
              <div>
                <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">Tempo Final de Execução (Minutos) *</label>
                <input 
                  type="number" 
                  value={donePrompt.durationMin} 
                  onChange={e => { setDonePrompt({...donePrompt, durationMin: e.target.value}); setValidationError(null); }} 
                  className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-green-500" 
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#2a2d3d] bg-[#1a1c24] flex items-center justify-end gap-3">
              <button onClick={() => { setDonePrompt(null); setValidationError(null); }} className="text-sm px-4 py-2 rounded-lg text-neutral-400 hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDoneMove} className="text-sm px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Fechamento Semanal (Automação de E-mails e Notion) */}
      {closureModal && (
        <ClosureModal 
          tasks={doneTasks}
          clients={clients}
          responsibles={responsibles}
          onClose={() => setClosureModal(false)}
          onFormalize={(clientId) => {
            if (clientId) {
              setTasks(prev => prev.map(t => (t.status === 'done' && t.clientId === clientId) ? { ...t, status: 'formalize' } : t));
            } else {
              setTasks(prev => prev.map(t => t.status === 'done' ? { ...t, status: 'formalize' } : t));
              setClosureModal(false);
            }
          }}
        />
      )}

      {/* Modal Adicionar/Editar */}
      {modal && (
        <TaskModal 
          modal={modal} 
          setModal={setModal} 
          clients={clients} 
          responsibles={responsibles} 
          closeModal={closeModal} 
          saveModal={saveModal} 
          validationError={validationError}
          setValidationError={setValidationError}
        />
      )}

      {/* Confirmação Apagar */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="w-full max-w-sm rounded-xl bg-[#161821] border border-[#2a2d3d] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <div className="p-2 bg-red-500/10 rounded-lg"><Trash2 size={20} /></div>
              <h3 className="font-semibold text-base">Apagar permanentemente</h3>
            </div>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              Esta ação não poderá ser desfeita. Deseja realmente excluir este card do sistema?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="text-sm px-4 py-2 rounded-lg text-neutral-400 hover:text-white transition-colors">
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const idToDelete = confirmDelete;
                  setTasks(prev => prev.filter((t) => t.id !== idToDelete));
                  setConfirmDelete(null);
                  if (window.supabaseClient) {
                    await window.supabaseClient.from('tasks').delete().eq('id', idToDelete.toString());
                  }
                }} 
                className="text-sm px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
              >
                Apagar Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-Componentes UI ---

function HeaderBtn({ icon, label, active, onClick, color = "neutral" }) {
  const colors = {
    amber: "bg-amber-500 text-amber-950 hover:bg-amber-400",
    indigo: "bg-indigo-500 text-white hover:bg-indigo-400",
    purple: "bg-purple-500 text-white hover:bg-purple-400",
    blue: "bg-blue-500 text-white hover:bg-blue-400",
    neutral: "bg-[#2a2d3d] text-white hover:bg-[#3f4359]"
  };
  
  const activeClass = active ? colors[color] : "bg-[#0f1015] border border-[#2a2d3d] text-neutral-300 hover:bg-[#2a2d3d]";
  
  return (
    <button onClick={onClick} className={`flex items-center gap-2 text-xs px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeClass}`}>
      {icon}
      {label}
    </button>
  );
}

function SmallBtn({ icon, label, onClick, tone, active }) {
  const tones = {
    red: "border-red-500/30 text-red-400 hover:bg-red-500/10",
    amber: "border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
    green: "border-green-500/30 text-green-400 hover:bg-green-500/10",
    neutral: "border-[#3f4359] text-neutral-300 hover:bg-[#2a2d3d]"
  };
  
  const baseClass = "flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-md border font-medium transition-colors";
  const activeClass = "bg-amber-500/15 border-amber-500/30 text-amber-400";
  
  return (
    <button onClick={onClick} className={`${baseClass} ${active ? activeClass : tones[tone || 'neutral']}`}>
      {icon} {label}
    </button>
  );
}

function FilterSelect({ value, onChange, options, defaultLabel }) {
  return (
    <div className="relative flex items-center">
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="appearance-none text-[11px] bg-[#0f1015] border border-[#2a2d3d] rounded-lg pl-3 pr-8 py-2 text-neutral-300 outline-none focus:border-indigo-500 cursor-pointer transition-colors hover:border-[#3f4359]"
      >
        <option value="all">{defaultLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 text-neutral-500 pointer-events-none" />
    </div>
  );
}

function CustomSelect({ label, value, onChange, options, hasError, required }) {
  return (
    <div>
      <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative flex items-center">
        <select
          value={value}
          onChange={onChange}
          className={`appearance-none w-full bg-[#0f1015] border rounded-lg pl-4 pr-10 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer ${hasError ? 'border-red-500' : 'border-[#2a2d3d]'}`}
        >
          {options}
        </select>
        <ChevronDown size={16} className="absolute right-3 text-neutral-500 pointer-events-none" />
      </div>
    </div>
  );
}

// --- Componente: Fechamento Semanal (Automação de E-mails) ---
function ClosureModal({ tasks, clients, responsibles, onClose, onFormalize }) {
  const [copiedId, setCopiedId] = useState(null);
  const [copiedNotionId, setCopiedNotionId] = useState(null);
  const [meetingData, setMeetingData] = useState({});

  const tasksByClient = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const cId = task.clientId || 'no_client';
      if (!acc[cId]) acc[cId] = [];
      acc[cId].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const generateEmailText = (clientTasks, mData) => {
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
      if (mData?.link) body += `🔗 Acesso à reunião gravada: ${mData.link}\n\n`;
    } else {
      body += `Segue o resumo semanal com os principais pontos e o estado das demandas:\n\n`;
    }

    clientTasks.forEach(t => {
      body += `${t.title}\n`;
      if (t.description) body += `${t.description}\n`;
      body += `\n`;
    });

    body += `Em caso de dúvidas, continuo à disposição.\n\nCom os melhores cumprimentos,`;
    return body;
  };

  const generateEmailLink = (clientTasks, clientData, mData) => {
    const emails = clientData?.emails || (clientData?.email ? [clientData.email] : []);
    const emailTo = emails.join(',');
    const subject = `Atualização Semanal de Demandas - ${clientData ? clientData.name : 'Cliente'}`;
    const body = generateEmailText(clientTasks, mData);
    
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${emailTo}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleCopyText = (clientTasks, clientId, mData) => {
    const text = generateEmailText(clientTasks, mData);
    navigator.clipboard.writeText(text);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyNotion = (clientTasks, clientId) => {
    let text = "";
    clientTasks.forEach(t => {
      const timeMin = t.timerElapsed > 0 ? Math.round(t.timerElapsed / 60) : (t.durationMin || 0);
      const dateStr = t.dueDate ? t.dueDate.split('-').reverse().join('/') : 'Sem data';
      text += `• ${t.title}\n  Tempo: ${timeMin} min\n  Data: ${dateStr}\n\n`;
    });
    navigator.clipboard.writeText(text);
    setCopiedNotionId(clientId);
    setTimeout(() => setCopiedNotionId(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[80] fade-in">
      <div className="w-full max-w-3xl rounded-2xl bg-[#161821] border border-[#2a2d3d] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        
        <div className="px-6 py-5 border-b border-[#2a2d3d] flex items-center justify-between bg-[#1a1c24]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><Mail size={20} /></div>
            <div>
              <h3 className="font-bold text-base text-white">Fechamento Semanal</h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">Dispare os e-mails e copie os relatórios para o Notion.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-[#2a2d3d] transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto kp-scroll flex flex-col gap-6 flex-1">
          {Object.entries(tasksByClient).length === 0 && (
             <div className="text-center text-sm text-neutral-500 py-8 border border-dashed border-[#2a2d3d] rounded-xl">
               Nenhuma demanda pendente para formalizar.
             </div>
          )}

          {Object.entries(tasksByClient).map(([clientId, clientTasks]) => {
            const clientData = clients.find(c => c.id === clientId);
            const clientName = clientData ? clientData.name : 'Sem Cliente Atribuído';
            const mData = meetingData[clientId] || { date: '', link: '' };
            
            return (
              <div key={clientId} className="bg-[#0f1015] border border-[#2a2d3d] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 border-b border-[#2a2d3d] pb-3">
                  <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                    <Building2 size={14} className="text-purple-400" /> {clientName}
                  </h4>
                  <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-md">{clientTasks.length} tarefas concluídas</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 mt-2">
                   <div>
                      <label className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 block">Data da Reunião (Opcional)</label>
                      <input 
                         type="date" 
                         value={mData.date} 
                         onChange={e => setMeetingData({...meetingData, [clientId]: {...mData, date: e.target.value}})} 
                         className="w-full bg-[#161821] border border-[#2a2d3d] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500 [color-scheme:dark]" 
                      />
                   </div>
                   <div>
                      <label className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 block">Link da Gravação (Opcional)</label>
                      <input 
                         type="text" 
                         value={mData.link} 
                         onChange={e => setMeetingData({...meetingData, [clientId]: {...mData, link: e.target.value}})} 
                         className="w-full bg-[#161821] border border-[#2a2d3d] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500" 
                         placeholder="Ex: meet.google.com/..." 
                      />
                   </div>
                </div>

                <div className="text-xs text-neutral-400 mb-4 max-h-32 overflow-y-auto pr-2 kp-scroll font-mono">
                  {clientTasks.map(t => (
                    <div key={t.id} className="mb-2">
                      <div className="text-neutral-200 font-medium">• {t.title}</div>
                      {t.description && <div className="pl-3 opacity-70 truncate">{t.description}</div>}
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2a2d3d] pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <a 
                      href={generateEmailLink(clientTasks, clientData, mData)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2d3d] hover:bg-[#3f4359] text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <Mail size={14} /> E-mail (Gmail)
                    </a>
                    
                    <button 
                      onClick={() => handleCopyText(clientTasks, clientId, mData)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-lg text-xs font-medium transition-colors"
                    >
                      {copiedId === clientId ? <Check size={14} /> : <Copy size={14} />} 
                      {copiedId === clientId ? "Copiado!" : "Copiar (E-mail)"}
                    </button>

                    <button 
                      onClick={() => handleCopyNotion(clientTasks, clientId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      {copiedNotionId === clientId ? <Check size={14} /> : <ClipboardList size={14} />} 
                      {copiedNotionId === clientId ? "Copiado!" : "Copiar (Notion)"}
                    </button>
                  </div>

                  <button 
                    onClick={() => onFormalize(clientId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[#2a2d3d] text-neutral-400 hover:text-white hover:bg-[#2a2d3d] rounded-lg text-[11px] font-medium transition-colors"
                  >
                    <CheckCircle2 size={12} /> Formalizar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="px-6 py-4 border-t border-[#2a2d3d] flex items-center justify-between bg-[#1a1c24]">
          <span className="text-xs text-neutral-400">Total: {tasks.length} tarefas prontas para formalização.</span>
          <button 
            onClick={() => onFormalize(null)} 
            className="flex items-center gap-2 text-sm px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors"
          >
            <Check size={16} /> Mover todos para Formalizar
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Demais Painéis ---

function TimerPanel({ tasks, now, getElapsed, onToggleTimer }) {
  const activeTasks = tasks.filter(t => t.timerRunning || t.timerElapsed > 0).sort((a,b) => b.timerRunning - a.timerRunning);
  
  return (
    <div className="p-6 border-b border-[#2a2d3d] bg-[#1a1c24] fade-in shadow-inner">
      <div className="flex items-center gap-2 mb-2 text-amber-500">
        <Clock size={20} />
        <h2 className="text-lg font-semibold">Cronómetro</h2>
      </div>
      <p className="text-xs text-neutral-400 mb-6">Selecione uma tarefa para registar tempo de execução.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeTasks.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-neutral-500 border border-dashed border-[#2a2d3d] rounded-xl">
            Nenhuma tarefa com tempo registado. Inicie o temporizador nalgum cartão no quadro.
          </div>
        )}
        {activeTasks.map(t => {
          const isDoneOrCancelled = t.status === "done" || t.status === "cancelled" || t.status === "formalize";
          return (
            <div key={t.id} className="bg-[#161821] border border-[#2a2d3d] rounded-xl p-5 flex flex-col items-center text-center relative overflow-hidden group hover:border-[#3f4359] transition-colors">
              {t.timerRunning && <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 animate-pulse" />}
              
              <div className="text-[10px] px-2 py-0.5 rounded-full bg-[#0f1015] border border-[#2a2d3d] text-neutral-400 mb-3 truncate w-full">
                {COLUMNS.find(c=>c.id === t.status)?.name}
              </div>
              <h3 className={`font-semibold text-sm mb-4 truncate w-full ${isDoneOrCancelled ? 'text-neutral-500 line-through' : 'text-neutral-200'}`} title={t.title}>{t.title}</h3>
              
              <div className={`text-4xl font-mono font-light mb-6 tracking-wider ${t.timerRunning ? 'text-amber-400' : 'text-white'}`}>
                {formatTime(getElapsed(t))}
              </div>
              
              {!isDoneOrCancelled ? (
                <button
                  onClick={() => onToggleTimer(t.id)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-xs transition-colors ${
                    t.timerRunning 
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20' 
                    : 'bg-[#2a2d3d] text-neutral-300 hover:bg-[#3f4359]'
                  }`}
                >
                  {t.timerRunning ? <><Square size={14}/> Parar</> : <><Play size={14}/> Iniciar</>}
                </button>
              ) : (
                <div className="w-full flex items-center justify-center py-2.5 rounded-lg font-medium text-xs bg-[#0f1015] border border-[#2a2d3d] text-neutral-500">
                  Timer Desativado
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}

function ResponsiblesPanel({ responsibles, setResponsibles, tasks, setTasks }) {
  const [name, setName] = useState('');
  const add = () => { if (!name.trim()) return; setResponsibles([...responsibles, { id: 'r'+Date.now(), name: name.trim() }]); setName(''); };
  const remove = async (id) => { 
    setResponsibles(prev => prev.filter(r => r.id !== id)); 
    setTasks(prev => prev.map(t => t.responsibleId === id ? { ...t, responsibleId: '' } : t)); 
    if (window.supabaseClient) {
      await window.supabaseClient.from('responsibles').delete().eq('id', id.toString());
    }
  };

  return (
    <div className="p-6 border-b border-[#2a2d3d] bg-[#1a1c24] fade-in shadow-inner">
      <div className="flex items-center gap-2 mb-6 text-indigo-400">
        <Users size={20} />
        <h2 className="text-lg font-semibold text-white">Responsáveis</h2>
      </div>
      <div className="bg-[#161821] p-4 rounded-xl border border-[#2a2d3d] mb-6 flex gap-3 max-w-xl items-end">
        <div className="flex-1">
          <label className="text-xs text-neutral-400 mb-1.5 block uppercase tracking-wider">Nome do responsável</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key === 'Enter' && add()} className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" placeholder="Ex: João da Silva" />
        </div>
        <button onClick={add} className="h-[38px] px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Plus size={16}/> Adicionar</button>
      </div>
      <div className="flex flex-wrap gap-3">
        {responsibles.map(r => {
          const count = tasks.filter(t => t.responsibleId === r.id).length;
          return (
            <div key={r.id} className="flex items-center gap-3 bg-[#161821] border border-[#2a2d3d] rounded-lg pl-3 pr-1 py-1.5 group">
              <User size={14} className="text-indigo-400" />
              <span className="text-sm font-medium text-neutral-200">{r.name}</span>
              <span className="text-[10px] bg-[#0f1015] border border-[#2a2d3d] px-2 py-0.5 rounded-md text-neutral-400">{count}</span>
              <button onClick={() => remove(r.id)} className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"><X size={14}/></button>
            </div>
          )
        })}
      </div>
    </div>
  );
}

// --- Componentes Reestruturados para o Modal de Clientes ---

function ClientModal({ modal, setModal, setClients }) {
  const [form, setForm] = useState(modal.form);
  const [newEmail, setNewEmail] = useState("");
  const [validationError, setValidationError] = useState(null);

  const handleAddEmail = () => {
    if (!newEmail.trim()) return;
    if (!newEmail.includes("@")) {
      setValidationError("Insira um e-mail válido.");
      return;
    }
    setForm(prev => ({ ...prev, emails: [...prev.emails, newEmail.trim()] }));
    setNewEmail("");
    setValidationError(null);
  };

  const handleRemoveEmail = (index) => {
    setForm(prev => ({ ...prev, emails: prev.emails.filter((_, i) => i !== index) }));
  };

  const saveClient = () => {
    if (!form.name.trim()) {
      setValidationError("O nome do cliente é obrigatório.");
      return;
    }

    if (modal.mode === "add") {
      setClients(prev => [...prev, { ...form, id: 'c' + Date.now() }]);
    } else {
      setClients(prev => prev.map(c => c.id === form.id ? form : c));
    }
    setModal(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70] fade-in">
      <div className="w-full max-w-md rounded-2xl bg-[#161821] border border-[#2a2d3d] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2d3d] flex items-center justify-between bg-[#1a1c24]">
          <h3 className="font-bold text-base text-white">{modal.mode === "add" ? "Novo Cliente" : "Editar Cliente"}</h3>
          <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-[#2a2d3d] transition-colors"><X size={18} /></button>
        </div>
        
        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">Nome do Cliente *</label>
            <input 
              autoFocus 
              value={form.name} 
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationError(null); }} 
              className={`w-full bg-[#0f1015] border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 transition-colors ${validationError?.includes("nome") ? "border-red-500" : "border-[#2a2d3d]"}`} 
              placeholder="Ex: Acme Corp" 
            />
          </div>
          
          <div>
            <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">E-mails (Contactos do Cliente)</label>
            <div className="flex items-center gap-2 mb-3">
              <input 
                value={newEmail} 
                onChange={e => setNewEmail(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAddEmail()}
                className="flex-1 bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 transition-colors" 
                placeholder="Ex: gestor@empresa.com" 
              />
              <button 
                onClick={handleAddEmail} 
                className="px-4 py-2.5 bg-[#2a2d3d] hover:bg-[#3f4359] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Plus size={16}/> Adicionar
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto kp-scroll pr-1">
              {form.emails.length === 0 && (
                <div className="text-center text-xs text-neutral-500 py-3 border border-dashed border-[#2a2d3d] rounded-lg">
                  Nenhum e-mail adicionado ainda.
                </div>
              )}
              {form.emails.map((email, index) => (
                <div key={index} className="flex items-center justify-between bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-neutral-300">
                    <Mail size={14} className="text-purple-400" /> {email}
                  </div>
                  <button onClick={() => handleRemoveEmail(index)} className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-[#2a2d3d] flex items-center justify-end gap-3 bg-[#1a1c24]">
          <button onClick={() => setModal(null)} className="text-sm px-4 py-2 rounded-lg text-neutral-400 hover:text-white transition-colors">Cancelar</button>
          <button onClick={saveClient} className="text-sm px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors">Salvar Cliente</button>
        </div>
      </div>
      
      {validationError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 fade-in z-[80] font-medium text-sm">
          <AlertTriangle size={16} /> {validationError}
        </div>
      )}
    </div>
  );
}

function ClientsPanel({ clients, setClients, tasks, setTasks }) {
  const [clientModal, setClientModal] = useState(null);

  const openAdd = () => setClientModal({ mode: 'add', form: { name: '', emails: [] } });
  
  const openEdit = (client) => {
    const emailsArray = client.emails ? client.emails : (client.email ? client.email.split(',').map(e => e.trim()) : []);
    setClientModal({ mode: 'edit', form: { ...client, emails: emailsArray } });
  };

  const remove = async (id) => { 
    setClients(prev => prev.filter(c => c.id !== id)); 
    setTasks(prev => prev.map(t => t.clientId === id ? { ...t, clientId: '' } : t)); 
    if (window.supabaseClient) {
      await window.supabaseClient.from('clients').delete().eq('id', id.toString());
    }
  };

  return (
    <div className="p-6 border-b border-[#2a2d3d] bg-[#1a1c24] fade-in shadow-inner">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-purple-400">
          <Building2 size={20} />
          <h2 className="text-lg font-semibold text-white">Clientes</h2>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <Plus size={16}/> Novo Cliente
        </button>
      </div>
      
      <div className="flex flex-col gap-2 max-w-4xl">
        {clients.length === 0 && (
          <div className="text-center text-sm text-neutral-500 py-8 border border-dashed border-[#2a2d3d] rounded-xl">
            Nenhum cliente cadastrado.
          </div>
        )}
        {clients.map(c => {
          const count = tasks.filter(t => t.clientId === c.id).length;
          const emailsArray = c.emails ? c.emails : (c.email ? c.email.split(',').map(e => e.trim()) : []);
          
          return (
            <div 
              key={c.id} 
              onClick={() => openEdit(c)}
              className="flex items-center justify-between bg-[#161821] border border-[#2a2d3d] rounded-lg p-3 hover:border-purple-500/50 hover:bg-[#1a1c24] transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[#0f1015] rounded-md border border-[#2a2d3d]"><Building2 size={16} className="text-purple-400" /></div>
                <div>
                  <div className="text-sm font-semibold text-neutral-200">{c.name}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {emailsArray.length === 0 ? "Sem e-mails registados" : `${emailsArray.length} e-mail(s) registado(s)`}
                  </div>
                </div>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md ml-2">{count} tarefas</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); remove(c.id); }} 
                className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16}/>
              </button>
            </div>
          )
        })}
      </div>

      {clientModal && (
        <ClientModal modal={clientModal} setModal={setClientModal} setClients={setClients} />
      )}
    </div>
  );
}

function ReportsPanel({ tasks, clients, responsibles, now, getElapsed }) {
  const exportTasksCSV = () => {
    const headers = ["ID", "Título", "Status", "Prioridade", "Cliente", "Responsável", "Duração Estimada (min)", "Tempo Gasto (h)"];
    const rows = tasks.map(t => {
      const clientName = clients.find(c => c.id === t.clientId)?.name || '-';
      const respName = responsibles.find(r => r.id === t.responsibleId)?.name || '-';
      const statusName = COLUMNS.find(c => c.id === t.status)?.name || t.status;
      const elapsedH = (getElapsed(t, now) / 3600).toFixed(2);
      return [t.id, `"${t.title.replace(/"/g, '""')}"`, statusName, t.priority, `"${clientName}"`, `"${respName}"`, t.durationMin || 0, elapsedH].join(',');
    });
    downloadCSV([headers.join(','), ...rows], 'tarefas.csv');
  };
  const exportHoursCSV = () => {
    const headers = ["Responsável", "Tarefas", "Horas Totais"];
    const rows = responsibles.map(r => {
      const rTasks = tasks.filter(t => t.responsibleId === r.id);
      const hours = rTasks.reduce((acc, t) => acc + (getElapsed(t, now) / 3600), 0).toFixed(2);
      return [`"${r.name}"`, rTasks.length, hours].join(',');
    });
    downloadCSV([headers.join(','), ...rows], 'horas.csv');
  };
  const exportClientsCSV = () => {
    const headers = ["Cliente", "E-mails", "Total Tarefas"];
    const rows = clients.map(c => {
      const count = tasks.filter(t => t.clientId === c.id).length;
      const emailsStr = c.emails ? c.emails.join('; ') : (c.email || '');
      return [`"${c.name}"`, `"${emailsStr}"`, count].join(',');
    });
    downloadCSV([headers.join(','), ...rows], 'clientes.csv');
  };

  return (
    <div className="p-6 border-b border-[#2a2d3d] bg-[#1a1c24] fade-in shadow-inner">
      <div className="flex items-center gap-2 mb-6 text-blue-400">
        <BarChart3 size={20} />
        <h2 className="text-lg font-semibold text-white">Relatórios</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div>
          <h3 className="text-[11px] text-neutral-400 mb-3 uppercase tracking-wider font-semibold">Por Status</h3>
          <div className="flex flex-col gap-2">
            {COLUMNS.map(col => {
              const count = tasks.filter(t => t.status === col.id).length;
              return (
                <div key={col.id} className="flex justify-between items-center bg-[#161821] border border-[#2a2d3d] p-3 rounded-lg">
                  <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${col.dot}`} /><span className="text-sm text-neutral-300 font-medium">{col.name}</span></div>
                  <span className="text-sm font-bold text-white">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div>
          <h3 className="text-[11px] text-neutral-400 mb-3 uppercase tracking-wider font-semibold">Por Responsável</h3>
          <div className="flex flex-col gap-2">
            {responsibles.map(r => {
              const rTasks = tasks.filter(t => t.responsibleId === r.id);
              const hours = rTasks.reduce((acc, t) => acc + (getElapsed(t, now) / 3600), 0);
              return (
                <div key={r.id} className="bg-[#161821] border border-[#2a2d3d] p-3 rounded-lg">
                  <div className="text-sm text-neutral-200 font-semibold mb-1">{r.name}</div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-medium"><span>{rTasks.length} tarefas</span><span>{hours.toFixed(1)}h totais</span></div>
                </div>
              )
            })}
          </div>
        </div>
        <div>
          <h3 className="text-[11px] text-neutral-400 mb-3 uppercase tracking-wider font-semibold">Por Cliente</h3>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto kp-scroll pr-2">
            {clients.map(c => {
              const cTasks = tasks.filter(t => t.clientId === c.id);
              if (cTasks.length === 0) return null;
              const hours = cTasks.reduce((acc, t) => acc + (getElapsed(t, now) / 3600), 0);
              return (
                <div key={c.id} className="bg-[#161821] border border-[#2a2d3d] p-3 rounded-lg">
                  <div className="text-sm text-neutral-200 font-semibold mb-1">{c.name}</div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-medium"><span>{cTasks.length} tarefas</span><span>{hours.toFixed(1)}h totais</span></div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 pt-6 border-t border-[#2a2d3d]">
        <button onClick={exportTasksCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600/10 text-green-400 border border-green-500/30 hover:bg-green-600/20 rounded-lg text-xs font-semibold transition-colors"><Download size={14}/> Exportar Tarefas (CSV)</button>
        <button onClick={exportHoursCSV} className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/30 hover:bg-blue-600/20 rounded-lg text-xs font-semibold transition-colors"><Download size={14}/> Exportar Horas (CSV)</button>
        <button onClick={exportClientsCSV} className="flex items-center gap-2 px-4 py-2 bg-purple-600/10 text-purple-400 border border-purple-500/30 hover:bg-purple-600/20 rounded-lg text-xs font-semibold transition-colors"><Download size={14}/> Exportar Clientes (CSV)</button>
      </div>
    </div>
  );
}

function TaskModal({ modal, setModal, clients, responsibles, closeModal, saveModal, validationError, setValidationError }) {
  const updateForm = (patch) => { setModal(m => ({ ...m, form: { ...m.form, ...patch } })); if (validationError) setValidationError(null); };
  const addChecklistRow = () => { setModal(m => ({ ...m, form: { ...m.form, checklist: [...m.form.checklist, { id: nextId(), text: "", done: false }] } })); };
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[85] fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-[#161821] border border-[#2a2d3d] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2d3d] flex items-center justify-between bg-[#1a1c24]">
          <h3 className="font-bold text-base text-white">{modal.mode === "add" ? "Nova Tarefa" : "Editar Tarefa"}</h3>
          <button onClick={closeModal} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-[#2a2d3d] transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto kp-scroll flex flex-col gap-5">
          <div>
            <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">Título *</label>
            <input autoFocus value={modal.form.title} onChange={(e) => updateForm({ title: e.target.value })} className={`w-full bg-[#0f1015] border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors ${validationError?.includes("Título") ? "border-red-500" : "border-[#2a2d3d]"}`} placeholder="Nome da tarefa" />
          </div>
          <div>
            <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">Descrição</label>
            <textarea value={modal.form.description} onChange={(e) => updateForm({ description: e.target.value })} rows={3} className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 resize-none transition-colors" placeholder="Detalhes opcionais" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CustomSelect label="Prioridade" value={modal.form.priority} onChange={(e) => updateForm({ priority: e.target.value })} options={<><option value="Baixa">Baixa</option><option value="Média">Média</option><option value="Alta">Alta</option></>} />
            <div>
              <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">Duração Estimada (Min)</label>
              <input type="number" value={modal.form.durationMin} onChange={(e) => updateForm({ durationMin: e.target.value })} className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500" placeholder="Ex: 120" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CustomSelect label="Responsável" required hasError={validationError?.includes("Responsável")} value={modal.form.responsibleId} onChange={(e) => updateForm({ responsibleId: e.target.value })} options={<><option value="">Selecione...</option>{responsibles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</>} />
            <CustomSelect label="Cliente" value={modal.form.clientId} onChange={(e) => updateForm({ clientId: e.target.value })} options={<><option value="">Nenhum</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</>} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">Data de Entrega</label>
              <input type="date" value={modal.form.dueDate} onChange={(e) => updateForm({ dueDate: e.target.value })} className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
            </div>
            <CustomSelect label="Etapa / Status" value={modal.form.status} onChange={(e) => updateForm({ status: e.target.value, waitingFor: e.target.value === 'waiting' ? modal.form.waitingFor : "" })} options={COLUMNS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)} />
          </div>
          {modal.form.status === 'waiting' && (
            <div className="animate-fade-in">
              <CustomSelect label="Aguardando Retorno De" required hasError={validationError?.includes("Aguardando Retorno")} value={modal.form.waitingFor || ""} onChange={(e) => updateForm({ waitingFor: e.target.value })} options={<><option value="">Selecione a pendência...</option><option value="Cliente">Cliente</option><option value="Equipa Interna">Equipa Interna</option></>} />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-neutral-400 uppercase font-medium">Checklist</label>
              <button onClick={addChecklistRow} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"><Plus size={12}/> Adicionar item</button>
            </div>
            <div className="flex flex-col gap-2">
              {modal.form.checklist.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <button onClick={() => { setModal(m => ({ ...m, form: { ...m.form, checklist: m.form.checklist.map(ci => ci.id === c.id ? { ...ci, done: !ci.done } : ci) } })); }} className={`p-1.5 border rounded-md transition-colors shrink-0 ${c.done ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-[#0f1015] border-[#2a2d3d] text-neutral-600 hover:text-neutral-400'}`}><CheckCircle2 size={14}/></button>
                  <input value={c.text} onChange={(e) => { setModal(m => ({ ...m, form: { ...m.form, checklist: m.form.checklist.map(ci => ci.id === c.id ? { ...ci, text: e.target.value } : ci) } })); }} className="flex-1 bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors" placeholder="Item do checklist" />
                  <button onClick={() => setModal(m => ({ ...m, form: { ...m.form, checklist: m.form.checklist.filter(ci => ci.id !== c.id) } }))} className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"><X size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#2a2d3d] flex items-center justify-end gap-3 bg-[#1a1c24]">
          <button onClick={closeModal} className="text-sm px-4 py-2 rounded-lg text-neutral-400 hover:text-white transition-colors">Cancelar</button>
          <button onClick={saveModal} className="text-sm px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">{modal.mode === "add" ? "Criar Tarefa" : "Salvar Alterações"}</button>
        </div>
      </div>
      {validationError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 fade-in z-[90] font-medium text-sm"><AlertTriangle size={16} />Preencha: {validationError.join(", ")}</div>
      )}
    </div>
  );
}
