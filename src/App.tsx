import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Timer as TimerIcon,
  Trash2,
  X,
  Clock,
  Users,
  Building2,
  BarChart3,
  LogOut,
  RotateCcw,
  Filter,
  AlertTriangle,
  GripVertical,
  Download,
  Play,
  Square,
  CheckCircle2,
  User,
  CheckSquare,
} from 'lucide-react';

// --- Configurações e Dados Iniciais ---

const COLUMNS = [
  {
    id: 'backlog',
    name: 'Backlog',
    dot: 'bg-indigo-500',
    accent: 'border-indigo-500',
    bg: 'bg-indigo-500/10',
    btn: 'bg-indigo-600 hover:bg-indigo-500',
  },
  {
    id: 'todo',
    name: 'A Fazer',
    dot: 'bg-amber-500',
    accent: 'border-amber-500',
    bg: 'bg-amber-500/10',
    btn: 'bg-amber-500 hover:bg-amber-400 text-black',
  },
  {
    id: 'inprogress',
    name: 'Em Andamento',
    dot: 'bg-blue-500',
    accent: 'border-blue-500',
    bg: 'bg-blue-500/10',
    btn: 'bg-blue-600 hover:bg-blue-500',
  },
  {
    id: 'review',
    name: 'Em Revisão',
    dot: 'bg-purple-500',
    accent: 'border-purple-500',
    bg: 'bg-purple-500/10',
    btn: 'bg-purple-600 hover:bg-purple-500',
  },
  {
    id: 'done',
    name: 'Concluído',
    dot: 'bg-green-500',
    accent: 'border-green-500',
    bg: 'bg-green-500/10',
    btn: 'bg-green-600 hover:bg-green-500',
  },
  {
    id: 'cancelled',
    name: 'Cancelado',
    dot: 'bg-red-500',
    accent: 'border-red-500',
    bg: 'bg-red-500/10',
    btn: 'bg-red-600 hover:bg-red-500',
  },
];

const PRIORITY_STYLE = {
  Baixa: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  Média: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
  },
  Alta: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
  },
};

const initialClients = [
  {
    id: 'c1',
    name: 'Mackenzie',
    contact: 'João Silva',
    email: 'joao@mackenzie.br',
  },
  { id: 'c2', name: 'UBEC', contact: '', email: '' },
  { id: 'c3', name: 'Afya', contact: '', email: '' },
  { id: 'c4', name: 'Celso Lisboa', contact: '', email: '' },
];

const initialResponsibles = [
  { id: 'r1', name: 'Othávio Campbell' },
  { id: 'r2', name: 'Bianca' },
];

const initialTasks = [
  {
    id: 101,
    title: 'RELATÓRIO DE DADOS',
    description:
      'Verificar possibilidade de adicionar o tempo de duração em cada etapa do registro nos relatórios.',
    priority: 'Média',
    clientId: 'c2',
    responsibleId: 'r1',
    status: 'backlog',
    durationMin: 120,
    dueDate: '',
    checklist: [{ id: 1, text: 'Validar com o time rubeus', done: false }],
    timerRunning: false,
    timerStart: null,
    timerElapsed: 0,
  },
  {
    id: 102,
    title: 'Erro de contratos',
    description:
      'Erro na FV de contratos e na ação de enviar a flag de contrato aceito para o Totvs RM',
    priority: 'Alta',
    clientId: 'c1',
    responsibleId: 'r1',
    status: 'cancelled',
    durationMin: 60,
    dueDate: '',
    checklist: [
      { id: 1, text: 'Analise/debug erro de contrato', done: true },
      { id: 2, text: 'Envio retroativo da flag de contrato', done: true },
      { id: 3, text: 'Envio retroativo dos contratos via FV', done: true },
    ],
    timerRunning: false,
    timerStart: null,
    timerElapsed: 0,
  },
  {
    id: 103,
    title: 'Teste de cliente',
    description: 'Testando',
    priority: 'Média',
    clientId: 'c3',
    responsibleId: 'r2',
    status: 'cancelled',
    durationMin: 30,
    dueDate: '',
    checklist: [{ id: 1, text: 'Testando', done: true }],
    timerRunning: false,
    timerStart: null,
    timerElapsed: 0,
  },
];

// --- Funções Auxiliares ---
const nextId = () => Math.random().toString(36).substr(2, 9);

function formatTime(totalSeconds) {
  const s = Math.floor(totalSeconds);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function downloadCSV(dataArray, filename) {
  const csvContent = 'data:text/csv;charset=utf-8,' + dataArray.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
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
            <label className="text-xs text-neutral-400 mb-1.5 block">
              Nome de Usuário
            </label>
            <input
              autoFocus
              className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
              placeholder="Digite seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name && onLogin(name)}
            />
          </div>
          <button
            disabled={!name.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 font-medium transition-colors"
            onClick={() => onLogin(name)}
          >
            Acessar Painel
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Componente Principal ---
export default function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return <KanbanMain user={user} onLogout={() => setUser(null)} />;
}

function KanbanMain({ user, onLogout }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [clients, setClients] = useState(initialClients);
  const [responsibles, setResponsibles] = useState(initialResponsibles);

  const [activeTab, setActiveTab] = useState('board'); // board, timer, responsibles, clients, reports
  const [filterClient, setFilterClient] = useState('all');
  const [filterResp, setFilterResp] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', status?, task?, form }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Relógio do cronômetro
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

  const toggleTab = (tab) =>
    setActiveTab((prev) => (prev === tab ? 'board' : tab));

  // Filtros
  const filteredTasks = tasks.filter(
    (t) =>
      (filterClient === 'all' || t.clientId === filterClient) &&
      (filterResp === 'all' || t.responsibleId === filterResp) &&
      (filterPriority === 'all' || t.priority === filterPriority)
  );

  const activeTasksCount = tasks.filter((t) => t.status !== 'cancelled').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const overallProgress = activeTasksCount
    ? Math.round((doneCount / activeTasksCount) * 100)
    : 0;

  // Modais e Ações
  const emptyForm = {
    title: '',
    description: '',
    priority: 'Média',
    durationMin: '',
    clientId: '',
    responsibleId: '',
    dueDate: '',
    checklist: [],
  };

  function openAddModal(status) {
    setValidationError(null);
    setModal({
      mode: 'add',
      status,
      form: { ...emptyForm, responsibleId: responsibles[0]?.id || '' },
    });
  }
  function openEditModal(task) {
    setValidationError(null);
    setModal({
      mode: 'edit',
      task,
      form: { ...task, checklist: task.checklist.map((c) => ({ ...c })) },
    });
  }
  function closeModal() {
    setModal(null);
    setValidationError(null);
  }

  function saveModal() {
    const f = modal.form;
    const missing = [];
    if (!f.title.trim()) missing.push('Título');
    if (!f.responsibleId) missing.push('Responsável');

    if (missing.length > 0) {
      setValidationError(missing);
      return;
    }

    if (modal.mode === 'add') {
      const newTask = {
        id: nextId(),
        ...f,
        title: f.title.trim(),
        description: f.description.trim(),
        status: modal.status,
        checklist: f.checklist.filter((c) => c.text.trim()),
        timerRunning: false,
        timerStart: null,
        timerElapsed: 0,
      };
      setTasks((prev) => [...prev, newTask]);
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === modal.task.id
            ? {
                ...t,
                ...f,
                title: f.title.trim(),
                description: f.description.trim(),
                checklist: f.checklist.filter((c) => c.text.trim()),
              }
            : t
        )
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
          return {
            ...t,
            timerRunning: false,
            timerStart: null,
            timerElapsed: elapsed,
          };
        }
        return { ...t, timerRunning: true, timerStart: Date.now() };
      })
    );
  }

  function updateTaskStatus(id, newStatus) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id.toString() === id.toString() ? { ...t, status: newStatus } : t
      )
    );
  }

  // HTML5 Drag and Drop
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  const handleDrop = (e, status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) updateTaskStatus(taskId, status);
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
        </div>
        <div className="flex items-center gap-2">
          <HeaderBtn
            icon={<Clock size={14} />}
            label="Cronômetro"
            active={activeTab === 'timer'}
            onClick={() => toggleTab('timer')}
            color="amber"
          />
          <HeaderBtn
            icon={<Users size={14} />}
            label="Responsáveis"
            active={activeTab === 'responsibles'}
            onClick={() => toggleTab('responsibles')}
            color="indigo"
          />
          <HeaderBtn
            icon={<Building2 size={14} />}
            label="Clientes"
            active={activeTab === 'clients'}
            onClick={() => toggleTab('clients')}
            color="purple"
          />
          <HeaderBtn
            icon={<BarChart3 size={14} />}
            label="Relatórios"
            active={activeTab === 'reports'}
            onClick={() => toggleTab('reports')}
            color="blue"
          />
          <div className="w-px h-6 bg-[#2a2d3d] mx-1"></div>
          <HeaderBtn
            icon={<LogOut size={14} />}
            label="Sair"
            onClick={onLogout}
          />
        </div>
      </div>

      {/* Área Dinâmica de Painéis */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden kp-scroll flex flex-col">
        {/* Painéis Expansíveis */}
        {activeTab === 'timer' && (
          <TimerPanel
            tasks={tasks}
            now={now}
            getElapsed={getElapsed}
            onToggleTimer={toggleTimer}
          />
        )}

        {activeTab === 'responsibles' && (
          <ResponsiblesPanel
            responsibles={responsibles}
            setResponsibles={setResponsibles}
            tasks={tasks}
            setTasks={setTasks}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsPanel
            clients={clients}
            setClients={setClients}
            tasks={tasks}
            setTasks={setTasks}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsPanel
            tasks={tasks}
            clients={clients}
            responsibles={responsibles}
            now={now}
            getElapsed={getElapsed}
          />
        )}

        {/* Estatísticas (Sempre visível abaixo dos painéis) */}
        <div className="shrink-0 px-5 pt-5 pb-3">
          <div className="w-full rounded-xl bg-[#161821] border border-[#2a2d3d] px-5 py-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-2.5">
              <span className="font-medium">Progresso Geral</span>
              <span className="text-green-400 font-bold">
                {overallProgress}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#0f1015] overflow-hidden border border-[#2a2d3d]">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="shrink-0 flex flex-wrap items-center gap-3 px-5 pb-4">
          <Filter size={16} className="text-neutral-500 shrink-0" />
          <FilterSelect
            value={filterClient}
            onChange={setFilterClient}
            options={clients}
            defaultLabel="Todos os clientes"
          />
          <FilterSelect
            value={filterResp}
            onChange={setFilterResp}
            options={responsibles}
            defaultLabel="Todos os responsáveis"
          />
          <FilterSelect
            value={filterPriority}
            onChange={setFilterPriority}
            options={[
              { id: 'Baixa', name: 'Baixa' },
              { id: 'Média', name: 'Média' },
              { id: 'Alta', name: 'Alta' },
            ]}
            defaultLabel="Todas as prioridades"
          />
        </div>

        {/* Quadro Kanban (Scroll Horizontal) */}
        <div className="flex-1 overflow-x-auto px-5 pb-5 kp-scroll">
          <div className="flex gap-4 items-start h-full min-w-max pb-2">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className={`w-[320px] shrink-0 rounded-xl bg-[#161821] border-t-[3px] ${col.accent} border-[#2a2d3d] border-x border-b flex flex-col max-h-full shadow-sm`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  {/* Header Coluna */}
                  <div className="px-3.5 pt-3.5 pb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${col.dot} shadow-sm`}
                      />
                      {col.name}
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
                      <div className="text-center text-xs text-neutral-600 py-6 select-none border border-dashed border-[#2a2d3d] rounded-lg">
                        Arraste cards para cá
                      </div>
                    )}
                    {colTasks.map((t) => {
                      const total = t.checklist.length;
                      const done = t.checklist.filter((c) => c.done).length;
                      const pct = total ? Math.round((done / total) * 100) : 0;
                      const client = clients.find((c) => c.id === t.clientId);
                      const resp = responsibles.find(
                        (r) => r.id === t.responsibleId
                      );
                      const prStyle =
                        PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.Média;

                      return (
                        <div
                          key={t.id}
                          className="rounded-xl bg-[#1c1e29] border border-[#2a2d3d] p-3.5 hover:border-[#3f4359] transition-colors cursor-grab active:cursor-grabbing group"
                          draggable
                          onDragStart={(e) => handleDragStart(e, t.id)}
                        >
                          <div className="flex gap-2 items-start mb-2">
                            <GripVertical
                              size={14}
                              className="text-neutral-600 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-semibold mb-1 leading-snug text-neutral-200">
                                {t.title}
                              </div>
                              {t.description && (
                                <div className="text-[11px] text-neutral-400 mb-2 line-clamp-2">
                                  {t.description}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-3 pl-5">
                            <span
                              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border font-medium ${prStyle.bg} ${prStyle.text} ${prStyle.border}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${prStyle.dot}`}
                              />{' '}
                              {t.priority}
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

                          {total > 0 && (
                            <div className="mb-3 pl-5">
                              <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1.5 font-medium">
                                <span className="flex items-center gap-1">
                                  <CheckSquare size={10} /> {done}/{total}
                                </span>
                                <span>{pct}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-[#0f1015] overflow-hidden mb-2 border border-[#2a2d3d]">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    pct === 100 ? 'bg-green-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                {t.checklist.map((c) => (
                                  <label
                                    key={c.id}
                                    className="flex items-start gap-2 text-[11px] text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={c.done}
                                      onChange={() => {
                                        setTasks((prev) =>
                                          prev.map((pt) =>
                                            pt.id === t.id
                                              ? {
                                                  ...pt,
                                                  checklist: pt.checklist.map(
                                                    (pc) =>
                                                      pc.id === c.id
                                                        ? {
                                                            ...pc,
                                                            done: !pc.done,
                                                          }
                                                        : pc
                                                  ),
                                                }
                                              : pt
                                          )
                                        );
                                      }}
                                      className="accent-indigo-500 w-3 h-3 mt-0.5 rounded-sm shrink-0 bg-[#0f1015] border-[#2a2d3d]"
                                    />
                                    <span
                                      className={`leading-snug ${
                                        c.done
                                          ? 'line-through text-neutral-600'
                                          : ''
                                      }`}
                                    >
                                      {c.text}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {(t.timerRunning || t.timerElapsed > 0) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-500/90 mb-3 pl-5 font-mono font-medium bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 w-fit">
                              <Clock
                                size={12}
                                className={
                                  t.timerRunning ? 'animate-pulse' : ''
                                }
                              />
                              {formatTime(getElapsed(t))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 pl-5 pt-2 border-t border-[#2a2d3d]/50">
                            <SmallBtn
                              onClick={() => openEditModal(t)}
                              icon={<Pencil size={12} />}
                              label="Editar"
                            />
                            <SmallBtn
                              onClick={() => toggleTimer(t.id)}
                              icon={
                                t.timerRunning ? (
                                  <Square size={12} />
                                ) : (
                                  <Play size={12} />
                                )
                              }
                              label={t.timerRunning ? 'Parar' : 'Timer'}
                              active={t.timerRunning}
                              tone="amber"
                            />

                            {t.status !== 'cancelled' ? (
                              <SmallBtn
                                onClick={() =>
                                  updateTaskStatus(t.id, 'cancelled')
                                }
                                icon={<X size={12} />}
                                label="Cancelar"
                                tone="red"
                              />
                            ) : (
                              <>
                                <SmallBtn
                                  onClick={() =>
                                    updateTaskStatus(t.id, 'backlog')
                                  }
                                  icon={<RotateCcw size={12} />}
                                  label="Restaurar"
                                  tone="green"
                                />
                                <SmallBtn
                                  onClick={() => setConfirmDelete(t.id)}
                                  icon={<Trash2 size={12} />}
                                  label=""
                                  tone="red"
                                />
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
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Trash2 size={20} />
              </div>
              <h3 className="font-semibold text-base">
                Apagar permanentemente
              </h3>
            </div>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              Esta ação não poderá ser desfeita. Deseja realmente excluir este
              card do sistema?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="text-sm px-4 py-2 rounded-lg text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setTasks((prev) =>
                    prev.filter((t) => t.id !== confirmDelete)
                  );
                  setConfirmDelete(null);
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

function HeaderBtn({ icon, label, active, onClick, color = 'neutral' }) {
  const colors = {
    amber: 'bg-amber-500 text-amber-950 hover:bg-amber-400',
    indigo: 'bg-indigo-500 text-white hover:bg-indigo-400',
    purple: 'bg-purple-500 text-white hover:bg-purple-400',
    blue: 'bg-blue-500 text-white hover:bg-blue-400',
    neutral: 'bg-[#2a2d3d] text-white hover:bg-[#3f4359]',
  };

  const activeClass = active
    ? colors[color]
    : 'bg-[#0f1015] border border-[#2a2d3d] text-neutral-300 hover:bg-[#2a2d3d]';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 text-xs px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeClass}`}
    >
      {icon}
      {label}
    </button>
  );
}

function SmallBtn({ icon, label, onClick, tone, active }) {
  const tones = {
    red: 'border-red-500/30 text-red-400 hover:bg-red-500/10',
    amber: 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10',
    green: 'border-green-500/30 text-green-400 hover:bg-green-500/10',
    neutral: 'border-[#3f4359] text-neutral-300 hover:bg-[#2a2d3d]',
  };

  const baseClass =
    'flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-md border font-medium transition-colors';
  const activeClass = 'bg-amber-500/15 border-amber-500/30 text-amber-400';

  return (
    <button
      onClick={onClick}
      className={`${baseClass} ${
        active ? activeClass : tones[tone || 'neutral']
      }`}
    >
      {icon} {label}
    </button>
  );
}

function FilterSelect({ value, onChange, options, defaultLabel }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[11px] bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-3 py-2 text-neutral-300 outline-none focus:border-indigo-500 cursor-pointer"
    >
      <option value="all">{defaultLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

// --- Painéis Expansíveis ---

function TimerPanel({ tasks, now, getElapsed, onToggleTimer }) {
  const activeTasks = tasks
    .filter((t) => t.timerRunning || t.timerElapsed > 0)
    .sort((a, b) => b.timerRunning - a.timerRunning);

  return (
    <div className="p-6 border-b border-[#2a2d3d] bg-[#1a1c24] fade-in shadow-inner">
      <div className="flex items-center gap-2 mb-2 text-amber-500">
        <Clock size={20} />
        <h2 className="text-lg font-semibold">Cronômetro</h2>
      </div>
      <p className="text-xs text-neutral-400 mb-6">
        Selecione uma tarefa para registrar tempo de execução.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeTasks.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-neutral-500 border border-dashed border-[#2a2d3d] rounded-xl">
            Nenhuma tarefa com tempo registrado. Inicie o timer em algum card no
            quadro.
          </div>
        )}
        {activeTasks.map((t) => (
          <div
            key={t.id}
            className="bg-[#161821] border border-[#2a2d3d] rounded-xl p-5 flex flex-col items-center text-center relative overflow-hidden group hover:border-[#3f4359] transition-colors"
          >
            {t.timerRunning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 animate-pulse" />
            )}

            <div className="text-[10px] px-2 py-0.5 rounded-full bg-[#0f1015] border border-[#2a2d3d] text-neutral-400 mb-3 truncate w-full">
              {COLUMNS.find((c) => c.id === t.status)?.name}
            </div>
            <h3
              className="font-semibold text-sm mb-4 truncate w-full text-neutral-200"
              title={t.title}
            >
              {t.title}
            </h3>

            <div
              className={`text-4xl font-mono font-light mb-6 tracking-wider ${
                t.timerRunning ? 'text-amber-400' : 'text-white'
              }`}
            >
              {formatTime(getElapsed(t))}
            </div>

            <button
              onClick={() => onToggleTimer(t.id)}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-xs transition-colors ${
                t.timerRunning
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
                  : 'bg-[#2a2d3d] text-neutral-300 hover:bg-[#3f4359]'
              }`}
            >
              {t.timerRunning ? (
                <>
                  <Square size={14} /> Parar
                </>
              ) : (
                <>
                  <Play size={14} /> Iniciar
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponsiblesPanel({ responsibles, setResponsibles, tasks, setTasks }) {
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim()) return;
    setResponsibles([
      ...responsibles,
      { id: 'r' + Date.now(), name: name.trim() },
    ]);
    setName('');
  };

  const remove = (id) => {
    setResponsibles((prev) => prev.filter((r) => r.id !== id));
    setTasks((prev) =>
      prev.map((t) =>
        t.responsibleId === id ? { ...t, responsibleId: '' } : t
      )
    );
  };

  return (
    <div className="p-6 border-b border-[#2a2d3d] bg-[#1a1c24] fade-in shadow-inner">
      <div className="flex items-center gap-2 mb-6 text-indigo-400">
        <Users size={20} />
        <h2 className="text-lg font-semibold text-white">Responsáveis</h2>
      </div>

      <div className="bg-[#161821] p-4 rounded-xl border border-[#2a2d3d] mb-6 flex gap-3 max-w-xl items-end">
        <div className="flex-1">
          <label className="text-xs text-neutral-400 mb-1.5 block uppercase tracking-wider">
            Nome do responsável
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            placeholder="Ex: João da Silva"
          />
        </div>
        <button
          onClick={add}
          className="h-[38px] px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Adicionar
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        {responsibles.map((r) => {
          const count = tasks.filter((t) => t.responsibleId === r.id).length;
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 bg-[#161821] border border-[#2a2d3d] rounded-lg pl-3 pr-1 py-1.5 group"
            >
              <User size={14} className="text-indigo-400" />
              <span className="text-sm font-medium text-neutral-200">
                {r.name}
              </span>
              <span className="text-[10px] bg-[#0f1015] border border-[#2a2d3d] px-2 py-0.5 rounded-md text-neutral-400">
                {count}
              </span>
              <button
                onClick={() => remove(r.id)}
                className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClientsPanel({ clients, setClients, tasks, setTasks }) {
  const [form, setForm] = useState({ name: '', contact: '', email: '' });

  const add = () => {
    if (!form.name.trim()) return;
    setClients([...clients, { id: 'c' + Date.now(), ...form }]);
    setForm({ name: '', contact: '', email: '' });
  };

  const remove = (id) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    setTasks((prev) =>
      prev.map((t) => (t.clientId === id ? { ...t, clientId: '' } : t))
    );
  };

  return (
    <div className="p-6 border-b border-[#2a2d3d] bg-[#1a1c24] fade-in shadow-inner">
      <div className="flex items-center gap-2 mb-6 text-purple-400">
        <Building2 size={20} />
        <h2 className="text-lg font-semibold text-white">Clientes</h2>
      </div>

      <div className="bg-[#161821] p-5 rounded-xl border border-[#2a2d3d] mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase tracking-wider font-medium">
              Nome *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              placeholder="Ex: Acme Corp"
            />
          </div>
          <div>
            <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase tracking-wider font-medium">
              Contato
            </label>
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              placeholder="Ex: João Silva"
            />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase tracking-wider font-medium">
                E-mail
              </label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                placeholder="Ex: joao@acme.com"
              />
            </div>
            <button
              onClick={add}
              className="h-[38px] px-5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 max-w-4xl">
        {clients.map((c) => {
          const count = tasks.filter((t) => t.clientId === c.id).length;
          return (
            <div
              key={c.id}
              className="flex items-center justify-between bg-[#161821] border border-[#2a2d3d] rounded-lg p-3 hover:border-[#3f4359] transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[#0f1015] rounded-md border border-[#2a2d3d]">
                  <Building2 size={16} className="text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-200">
                    {c.name}
                  </div>
                  {(c.contact || c.email) && (
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {c.contact} {c.contact && c.email && '•'} {c.email}
                    </div>
                  )}
                </div>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md ml-2">
                  {count} tarefas
                </span>
              </div>
              <button
                onClick={() => remove(c.id)}
                className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportsPanel({ tasks, clients, responsibles, now, getElapsed }) {
  const exportTasksCSV = () => {
    const headers = [
      'ID',
      'Título',
      'Status',
      'Prioridade',
      'Cliente',
      'Responsável',
      'Duração Estimada (min)',
      'Tempo Gasto (h)',
    ];
    const rows = tasks.map((t) => {
      const clientName = clients.find((c) => c.id === t.clientId)?.name || '-';
      const respName =
        responsibles.find((r) => r.id === t.responsibleId)?.name || '-';
      const statusName =
        COLUMNS.find((c) => c.id === t.status)?.name || t.status;
      const elapsedH = (getElapsed(t, now) / 3600).toFixed(2);
      return [
        t.id,
        `"${t.title.replace(/"/g, '""')}"`,
        statusName,
        t.priority,
        `"${clientName}"`,
        `"${respName}"`,
        t.durationMin || 0,
        elapsedH,
      ].join(',');
    });
    downloadCSV([headers.join(','), ...rows], 'tarefas.csv');
  };

  const exportHoursCSV = () => {
    const headers = ['Responsável', 'Tarefas', 'Horas Totais'];
    const rows = responsibles.map((r) => {
      const rTasks = tasks.filter((t) => t.responsibleId === r.id);
      const hours = rTasks
        .reduce((acc, t) => acc + getElapsed(t, now) / 3600, 0)
        .toFixed(2);
      return [`"${r.name}"`, rTasks.length, hours].join(',');
    });
    downloadCSV([headers.join(','), ...rows], 'horas.csv');
  };

  const exportClientsCSV = () => {
    const headers = ['Cliente', 'Contato', 'E-mail', 'Total Tarefas'];
    const rows = clients.map((c) => {
      const count = tasks.filter((t) => t.clientId === c.id).length;
      return [`"${c.name}"`, `"${c.contact}"`, `"${c.email}"`, count].join(',');
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
        {/* POR STATUS */}
        <div>
          <h3 className="text-[11px] text-neutral-400 mb-3 uppercase tracking-wider font-semibold">
            Por Status
          </h3>
          <div className="flex flex-col gap-2">
            {COLUMNS.map((col) => {
              const count = tasks.filter((t) => t.status === col.id).length;
              return (
                <div
                  key={col.id}
                  className="flex justify-between items-center bg-[#161821] border border-[#2a2d3d] p-3 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm text-neutral-300 font-medium">
                      {col.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* POR RESPONSÁVEL */}
        <div>
          <h3 className="text-[11px] text-neutral-400 mb-3 uppercase tracking-wider font-semibold">
            Por Responsável
          </h3>
          <div className="flex flex-col gap-2">
            {responsibles.map((r) => {
              const rTasks = tasks.filter((t) => t.responsibleId === r.id);
              const hours = rTasks.reduce(
                (acc, t) => acc + getElapsed(t, now) / 3600,
                0
              );
              return (
                <div
                  key={r.id}
                  className="bg-[#161821] border border-[#2a2d3d] p-3 rounded-lg"
                >
                  <div className="text-sm text-neutral-200 font-semibold mb-1">
                    {r.name}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-medium">
                    <span>{rTasks.length} tarefas</span>
                    <span>{hours.toFixed(1)}h totais</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* POR CLIENTE */}
        <div>
          <h3 className="text-[11px] text-neutral-400 mb-3 uppercase tracking-wider font-semibold">
            Por Cliente
          </h3>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto kp-scroll pr-2">
            {clients.map((c) => {
              const cTasks = tasks.filter((t) => t.clientId === c.id);
              if (cTasks.length === 0) return null;
              const hours = cTasks.reduce(
                (acc, t) => acc + getElapsed(t, now) / 3600,
                0
              );
              return (
                <div
                  key={c.id}
                  className="bg-[#161821] border border-[#2a2d3d] p-3 rounded-lg"
                >
                  <div className="text-sm text-neutral-200 font-semibold mb-1">
                    {c.name}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-medium">
                    <span>{cTasks.length} tarefas</span>
                    <span>{hours.toFixed(1)}h totais</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-6 border-t border-[#2a2d3d]">
        <button
          onClick={exportTasksCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600/10 text-green-400 border border-green-500/30 hover:bg-green-600/20 rounded-lg text-xs font-semibold transition-colors"
        >
          <Download size={14} /> Exportar Tarefas (CSV)
        </button>
        <button
          onClick={exportHoursCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/30 hover:bg-blue-600/20 rounded-lg text-xs font-semibold transition-colors"
        >
          <Download size={14} /> Exportar Horas (CSV)
        </button>
        <button
          onClick={exportClientsCSV}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600/10 text-purple-400 border border-purple-500/30 hover:bg-purple-600/20 rounded-lg text-xs font-semibold transition-colors"
        >
          <Download size={14} /> Exportar Clientes (CSV)
        </button>
      </div>
    </div>
  );
}

// --- Modal de Tarefa ---

function TaskModal({
  modal,
  setModal,
  clients,
  responsibles,
  closeModal,
  saveModal,
  validationError,
  setValidationError,
}) {
  const updateForm = (patch) => {
    setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));
    if (validationError) setValidationError(null);
  };

  const addChecklistRow = () => {
    setModal((m) => ({
      ...m,
      form: {
        ...m.form,
        checklist: [
          ...m.form.checklist,
          { id: nextId(), text: '', done: false },
        ],
      },
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-[#161821] border border-[#2a2d3d] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-[#2a2d3d] flex items-center justify-between bg-[#1a1c24]">
          <h3 className="font-bold text-base text-white">
            {modal.mode === 'add' ? 'Nova Tarefa' : 'Editar Tarefa'}
          </h3>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-[#2a2d3d] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-6 overflow-y-auto kp-scroll flex flex-col gap-5">
          <div>
            <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">
              Título *
            </label>
            <input
              autoFocus
              value={modal.form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              className={`w-full bg-[#0f1015] border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors ${
                validationError?.includes('Título')
                  ? 'border-red-500'
                  : 'border-[#2a2d3d]'
              }`}
              placeholder="Nome da tarefa"
            />
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">
              Descrição
            </label>
            <textarea
              value={modal.form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              rows={3}
              className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 resize-none transition-colors"
              placeholder="Detalhes opcionais"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">
                Prioridade
              </label>
              <select
                value={modal.form.priority}
                onChange={(e) => updateForm({ priority: e.target.value })}
                className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">
                Duração (Min)
              </label>
              <input
                type="number"
                value={modal.form.durationMin}
                onChange={(e) => updateForm({ durationMin: e.target.value })}
                className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                placeholder="Ex: 120"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">
                Responsável *
              </label>
              <select
                value={modal.form.responsibleId}
                onChange={(e) => updateForm({ responsibleId: e.target.value })}
                className={`w-full bg-[#0f1015] border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 ${
                  validationError?.includes('Responsável')
                    ? 'border-red-500'
                    : 'border-[#2a2d3d]'
                }`}
              >
                <option value="">Selecione...</option>
                {responsibles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">
                Cliente
              </label>
              <select
                value={modal.form.clientId}
                onChange={(e) => updateForm({ clientId: e.target.value })}
                className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              >
                <option value="">Nenhum</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-neutral-400 mb-1.5 block uppercase font-medium">
                Data de Entrega
              </label>
              <input
                type="date"
                value={modal.form.dueDate}
                onChange={(e) => updateForm({ dueDate: e.target.value })}
                className="w-full bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-neutral-400 uppercase font-medium">
                Checklist
              </label>
              <button
                onClick={addChecklistRow}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <Plus size={12} /> Adicionar item
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {modal.form.checklist.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#0f1015] border border-[#2a2d3d] rounded-md">
                    <CheckCircle2 size={14} className="text-neutral-600" />
                  </div>
                  <input
                    value={c.text}
                    onChange={(e) => {
                      setModal((m) => ({
                        ...m,
                        form: {
                          ...m.form,
                          checklist: m.form.checklist.map((ci) =>
                            ci.id === c.id
                              ? { ...ci, text: e.target.value }
                              : ci
                          ),
                        },
                      }));
                    }}
                    className="flex-1 bg-[#0f1015] border border-[#2a2d3d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Item do checklist"
                  />
                  <button
                    onClick={() =>
                      setModal((m) => ({
                        ...m,
                        form: {
                          ...m.form,
                          checklist: m.form.checklist.filter(
                            (ci) => ci.id !== c.id
                          ),
                        },
                      }))
                    }
                    className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-4 border-t border-[#2a2d3d] flex items-center justify-end gap-3 bg-[#1a1c24]">
          <button
            onClick={closeModal}
            className="text-sm px-4 py-2 rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={saveModal}
            className="text-sm px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          >
            {modal.mode === 'add' ? 'Criar Tarefa' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Alerta de Validação sobreposto */}
      {validationError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 fade-in z-[60] font-medium text-sm">
          <AlertTriangle size={16} />
          Preencha: {validationError.join(', ')}
        </div>
      )}
    </div>
  );
}
