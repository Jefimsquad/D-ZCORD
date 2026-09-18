import { useState } from 'react';
import type { ProjectTask, UserProfile } from '../types';
import { CheckCircle2, Clock, Circle, Plus, Trash2, CheckSquare, Users } from 'lucide-react';

interface ProjectTaskBoardProps {
  projectId: string;
  projectName: string;
  tasks: ProjectTask[];
  currentUser: UserProfile;
  onCreateTask: (task: Omit<ProjectTask, 'id' | 'created_at'>) => void;
  onUpdateTaskStatus: (taskId: string, status: 'todo' | 'in_progress' | 'done') => void;
  onDeleteTask: (taskId: string) => void;
  showMemberList?: boolean;
  onToggleMemberList?: () => void;
}

export const ProjectTaskBoard = ({
  projectId,
  projectName,
  tasks,
  currentUser,
  onCreateTask,
  onUpdateTaskStatus,
  onDeleteTask,
  showMemberList,
  onToggleMemberList,
}: ProjectTaskBoardProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const projectTasks = tasks.filter((t) => t.project_id === projectId);

  const todoTasks = projectTasks.filter((t) => t.status === 'todo');
  const inProgressTasks = projectTasks.filter((t) => t.status === 'in_progress');
  const doneTasks = projectTasks.filter((t) => t.status === 'done');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onCreateTask({
        project_id: projectId,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        status: 'todo',
        priority: newPriority,
        assigned_to: currentUser,
      });
      setNewTitle('');
      setNewDesc('');
      setIsAdding(false);
    }
  };

  const getPriorityBadge = (p: 'low' | 'medium' | 'high') => {
    switch (p) {
      case 'high':
        return <span className="bg-[#f23f43]/20 text-[#f23f43] text-[10px] px-1.5 py-0.5 rounded font-bold">ALTA</span>;
      case 'medium':
        return <span className="bg-[#f0b232]/20 text-[#f0b232] text-[10px] px-1.5 py-0.5 rounded font-bold">MÉDIA</span>;
      default:
        return <span className="bg-[#3ecf8e]/20 text-[#3ecf8e] text-[10px] px-1.5 py-0.5 rounded font-bold">BAIXA</span>;
    }
  };

  return (
    <div className="flex-1 bg-[#313338] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-[#1f2023] flex items-center justify-between shadow-sm bg-[#313338]">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <CheckSquare size={20} className="text-[#5865f2]" />
          <span>Quadro de Tarefas — {projectName}</span>
          <span className="text-xs font-normal text-[#949ba4] bg-[#1e1f22] px-2 py-0.5 rounded-full">
            {projectTasks.length} tarefas
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-3 py-1.5 rounded transition shadow"
          >
            <Plus size={16} />
            <span>Nova Tarefa</span>
          </button>

          {onToggleMemberList && (
            <button
              onClick={onToggleMemberList}
              title={showMemberList ? 'Ocultar Lista de Usuários' : 'Exibir Lista de Usuários'}
              className={`p-1.5 rounded transition ${
                showMemberList ? 'text-white bg-[#404249]' : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-white'
              }`}
            >
              <Users size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Task Columns */}
      <div className="flex-1 p-6 overflow-x-auto flex gap-6">
        {/* TODO COLUMN */}
        <div className="w-80 shrink-0 bg-[#2b2d31] rounded-xl flex flex-col max-h-full border border-[#35373c]">
          <div className="p-3 border-b border-[#35373c] flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-[#949ba4]">
              <Circle size={14} className="text-[#949ba4]" />
              <span>A Fazer ({todoTasks.length})</span>
            </div>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {/* Add Task Input Card */}
            {isAdding && (
              <form onSubmit={handleCreate} className="bg-[#1e1f22] p-3 rounded-lg border border-[#5865f2] space-y-2 animate-scale-up">
                <input
                  type="text"
                  placeholder="Título da tarefa..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#2b2d31] text-xs text-white p-2 rounded focus:outline-none"
                  autoFocus
                />
                <textarea
                  placeholder="Descrição opcional..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-[#2b2d31] text-xs text-white p-2 rounded focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between pt-1">
                  <select
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                    className="bg-[#2b2d31] text-xs text-[#dbdee1] rounded p-1"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="text-xs text-[#949ba4] px-2 py-1"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!newTitle.trim()}
                      className="bg-[#23a55a] text-xs font-semibold text-white px-3 py-1 rounded disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </form>
            )}

            {todoTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onMove={(s) => onUpdateTaskStatus(t.id, s)}
                onDelete={() => onDeleteTask(t.id)}
                getPriorityBadge={getPriorityBadge}
              />
            ))}
          </div>
        </div>

        {/* IN PROGRESS COLUMN */}
        <div className="w-80 shrink-0 bg-[#2b2d31] rounded-xl flex flex-col max-h-full border border-[#35373c]">
          <div className="p-3 border-b border-[#35373c] flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-[#f0b232]">
              <Clock size={14} className="text-[#f0b232]" />
              <span>Em Andamento ({inProgressTasks.length})</span>
            </div>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {inProgressTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onMove={(s) => onUpdateTaskStatus(t.id, s)}
                onDelete={() => onDeleteTask(t.id)}
                getPriorityBadge={getPriorityBadge}
              />
            ))}
          </div>
        </div>

        {/* DONE COLUMN */}
        <div className="w-80 shrink-0 bg-[#2b2d31] rounded-xl flex flex-col max-h-full border border-[#35373c]">
          <div className="p-3 border-b border-[#35373c] flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-[#23a55a]">
              <CheckCircle2 size={14} className="text-[#23a55a]" />
              <span>Concluído ({doneTasks.length})</span>
            </div>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {doneTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onMove={(s) => onUpdateTaskStatus(t.id, s)}
                onDelete={() => onDeleteTask(t.id)}
                getPriorityBadge={getPriorityBadge}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function TaskCard({
  task,
  onMove,
  onDelete,
  getPriorityBadge,
}: {
  task: ProjectTask;
  onMove: (status: 'todo' | 'in_progress' | 'done') => void;
  onDelete: () => void;
  getPriorityBadge: (p: 'low' | 'medium' | 'high') => React.ReactNode;
}) {
  return (
    <div className="bg-[#1e1f22] p-3 rounded-lg border border-[#35373c] hover:border-[#5865f2] transition group">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-white leading-snug">{task.title}</div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-[#949ba4] hover:text-[#f23f43] transition p-0.5"
          title="Excluir"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-[#949ba4] mt-1.5 leading-relaxed">{task.description}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2b2d31]">
        <div>{getPriorityBadge(task.priority)}</div>

        {/* Quick status transition dropdown/buttons */}
        <div className="flex items-center gap-1">
          {task.status !== 'todo' && (
            <button
              onClick={() => onMove('todo')}
              className="text-[10px] bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white px-1.5 py-0.5 rounded transition"
              title="Mover para A Fazer"
            >
              ← A Fazer
            </button>
          )}
          {task.status !== 'in_progress' && (
            <button
              onClick={() => onMove('in_progress')}
              className="text-[10px] bg-[#2b2d31] hover:bg-[#35373c] text-[#f0b232] px-1.5 py-0.5 rounded transition"
              title="Mover para Em Andamento"
            >
              {task.status === 'todo' ? 'Iniciar →' : '← Andamento'}
            </button>
          )}
          {task.status !== 'done' && (
            <button
              onClick={() => onMove('done')}
              className="text-[10px] bg-[#23a55a]/20 hover:bg-[#23a55a] text-[#23a55a] hover:text-white px-1.5 py-0.5 rounded transition font-semibold"
              title="Concluir Tarefa"
            >
              Concluir ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
