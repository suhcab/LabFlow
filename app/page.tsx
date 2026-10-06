'use client';

import { SubmitEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Atom,
  BarChart3,
  Bot,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  FolderKanban,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { databaseError, type Project } from '@/lib/project';
import { ProjectRecords } from '@/components/project-records';

type View = 'projects' | 'protocol' | 'schedule' | 'analysis' | 'reproducibility';

const navItems: { id: View; label: string; icon: typeof FolderKanban }[] = [
  { id: 'projects', label: '나의 연구', icon: FolderKanban },
  { id: 'protocol', label: '실험 프로토콜', icon: FlaskConical },
  { id: 'schedule', label: '연구 일정', icon: CalendarDays },
  { id: 'analysis', label: '데이터 분석', icon: BarChart3 },
  { id: 'reproducibility', label: '재현성 에이전트', icon: ClipboardCheck },
];

const fieldStyles: Record<string, string> = {
  물리: 'bg-cyan-100 text-cyan-800',
  화학: 'bg-violet-100 text-violet-800',
  생명과학: 'bg-emerald-100 text-emerald-800',
  지구과학: 'bg-amber-100 text-amber-800',
  정보과학: 'bg-blue-100 text-blue-800',
  융합: 'bg-rose-100 text-rose-800',
  기타: 'bg-slate-100 text-slate-700',
};

function formatDate(value: string | null) {
  if (!value) return '일정 미정';
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(value));
}

export default function Home() {
  const [view, setView] = useState<View>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const unsaved = useRef(false);
  const reportDirty = useCallback((value: boolean) => { unsaved.current = value; }, []);

  async function loadProjects() {
    if (!isSupabaseConfigured) {
      setNotice('Supabase 연결 정보가 설정되지 않았습니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      setTableMissing(error.code === 'PGRST205' || error.code === '42P01');
      setNotice(databaseError(error));
    } else {
      setProjects((data ?? []) as Project[]);
      setTableMissing(false);
      setNotice(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProjects(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createProject(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!isSupabaseConfigured) {
      setNotice('Supabase 연결 정보가 설정되지 않았습니다.');
      return;
    }
    const textValue = (name: string) => { const value = form.get(name); return typeof value === 'string' ? value : ''; };
    const title = textValue('title').trim();
    const topic = textValue('topic').trim();
    const startDate = textValue('start_date');
    const dueDate = textValue('due_date');
    if (!title || !topic || (startDate && dueDate && startDate > dueDate)) {
      setNotice('프로젝트명과 연구 주제를 입력하고 마감일이 시작일 이후인지 확인해 주세요.');
      return;
    }
    setSaving(true);
    setNotice(null);

    const payload = {
      title,
      topic,
      field: textValue('field') || '기타',
      status: '계획 중',
      start_date: startDate || null,
      due_date: dueDate || null,
      progress: 0,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('projects').insert(payload).select().single();
    if (error) {
      setNotice(databaseError(error));
    } else {
      const created = data as Project;
      setProjects((current) => [created, ...current]);
      setSelectedProject(created);
      setDialogOpen(false);
      setNotice('새 연구 프로젝트를 저장했습니다.');
      formElement.reset();
    }
    setSaving(false);
  }

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) =>
      [project.title, project.topic, project.field].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [projects, query]);

  const activeProjects = projects.filter((project) => project.status !== '완료').length;
  const completedProjects = projects.filter((project) => project.status === '완료').length;

  function navigate(next: View) {
    if (next === view) return;
    if (unsaved.current && !window.confirm('저장하지 않은 변경을 취소하고 이동할까요?')) return;
    unsaved.current = false;
    setView(next);
    if (next === 'projects') setSelectedProject(null);
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="h-20 justify-center border-b border-sidebar-border px-3">
          <div className="flex items-center gap-3 overflow-hidden px-1">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Atom className="size-5" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="font-bold tracking-tight">LabFlow</p>
              <p className="truncate text-xs text-muted-foreground">Research workspace</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>연구 워크스페이스</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      isActive={view === id}
                      tooltip={label}
                      onClick={() => navigate(id)}
                      className="h-10"
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="설정" className="h-10">
                <Settings2 /><span>설정</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <SidebarTrigger aria-label="사이드바 접기 또는 펼치기" />
          <div className="h-5 w-px bg-border" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {view === 'projects' ? '나의 연구' : navItems.find((item) => item.id === view)?.label}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {selectedProject?.title ?? '연구 기록을 한곳에서 관리하세요'}
            </p>
          </div>
          <NewProjectDialog open={dialogOpen} onOpenChange={(open) => {
            if (saving) return;
            if (open && unsaved.current) { setNotice('현재 기록을 먼저 저장한 뒤 새 프로젝트를 만들어 주세요.'); return; }
            setNotice(null);
            setDialogOpen(open);
          }} onSubmit={createProject} saving={saving} notice={notice} />
        </header>

        {view === 'projects' ? (
          <ProjectsView
            projects={filteredProjects}
            allProjects={projects}
            loading={loading}
            query={query}
            setQuery={setQuery}
            activeProjects={activeProjects}
            completedProjects={completedProjects}
            notice={notice}
            tableMissing={tableMissing}
            onRetry={loadProjects}
            onCreate={() => setDialogOpen(true)}
            onSelect={(project) => {
              setSelectedProject(project);
              setView('protocol');
            }}
          />
        ) : (
          <WorkspaceView key={selectedProject?.id ?? projects[0]?.id ?? 'empty'} view={view} project={selectedProject ?? projects[0] ?? null} onBack={() => navigate('projects')} onDirtyChange={reportDirty} />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

function NewProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  saving,
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  saving: boolean;
  notice: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus /> 새 프로젝트
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg">새 연구 프로젝트</DialogTitle>
            <DialogDescription>연구의 기본 정보를 입력하세요. 나중에 실험과 기록을 추가할 수 있습니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <label htmlFor="project-title" className="grid gap-2 text-sm font-medium">
              프로젝트명
              <Input id="project-title" name="title" required maxLength={120} placeholder="예: 단진자 운동을 이용한 중력가속도 측정" />
            </label>
            <label htmlFor="project-topic" className="grid gap-2 text-sm font-medium">
              연구 주제
              <Textarea id="project-topic" name="topic" required placeholder="무엇을 알아보기 위한 연구인가요?" />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label htmlFor="project-field" className="grid gap-2 text-sm font-medium">
                연구 분야
                <Select name="field" defaultValue="물리">
                  <SelectTrigger id="project-field" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['물리', '화학', '생명과학', '지구과학', '정보과학', '융합', '기타'].map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label htmlFor="project-start" className="grid gap-2 text-sm font-medium">시작일<Input id="project-start" name="start_date" type="date" /></label>
              <label htmlFor="project-due" className="grid gap-2 text-sm font-medium">마감일<Input id="project-due" name="due_date" type="date" /></label>
            </div>
          </div>
          {notice && <output className="mb-4 block text-sm text-destructive">{notice}</output>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={saving}>{saving ? '저장 중…' : '프로젝트 저장'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectsView({
  projects,
  allProjects,
  loading,
  query,
  setQuery,
  activeProjects,
  completedProjects,
  notice,
  tableMissing,
  onRetry,
  onCreate,
  onSelect,
}: {
  projects: Project[];
  allProjects: Project[];
  loading: boolean;
  query: string;
  setQuery: (value: string) => void;
  activeProjects: number;
  completedProjects: number;
  notice: string | null;
  tableMissing: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onSelect: (project: Project) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-8 md:px-9 md:py-10">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-primary">RESEARCH LIBRARY</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">나의 연구</h1>
          <p className="mt-2 text-base text-muted-foreground">진행 중인 프로젝트와 이전 연구 기록을 확인하세요.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="프로젝트 검색" aria-label="프로젝트 검색" />
        </div>
      </div>

      {notice && (
        <div className={`mb-6 flex flex-col justify-between gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center ${tableMissing ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-cyan-200 bg-cyan-50 text-cyan-950'}`}>
          <span>{notice}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>연결 다시 확인</Button>
        </div>
      )}

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="전체 프로젝트" value={allProjects.length} detail="Supabase에 저장된 연구" />
        <StatCard label="진행 중" value={activeProjects} detail="계획 중인 연구 포함" />
        <StatCard label="완료" value={completedProjects} detail="보관된 연구 기록" />
      </section>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-64 rounded-2xl" />)}
        </div>
      ) : projects.length > 0 ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="연구 프로젝트 목록">
          {projects.map((project) => (
            <button
              type="button"
              key={project.id}
              onClick={() => onSelect(project)}
              className="group rounded-2xl border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <div className="flex items-start justify-between gap-4">
                <Badge className={fieldStyles[project.field] ?? fieldStyles.기타}>{project.field}</Badge>
                <Badge variant="outline">{project.status}</Badge>
              </div>
              <h2 className="mt-6 line-clamp-2 text-xl font-bold leading-snug">{project.title}</h2>
              <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground">{project.topic || '연구 주제를 입력하지 않았습니다.'}</p>
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">진행률</span><strong>{project.progress}%</strong></div>
                <Progress value={project.progress} />
              </div>
              <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                <span>마감 {formatDate(project.due_date)}</span>
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </section>
      ) : (
        <Empty className="min-h-80 border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FolderKanban /></EmptyMedia>
            <EmptyTitle className="text-base">{query ? '검색 결과가 없습니다' : '첫 연구를 시작해 보세요'}</EmptyTitle>
            <EmptyDescription>{query ? '다른 프로젝트명이나 분야를 검색해 보세요.' : '프로젝트를 만들면 일정, 실험 과정과 측정값을 함께 기록할 수 있습니다.'}</EmptyDescription>
          </EmptyHeader>
          {!query && !tableMissing && <EmptyContent><Button onClick={onCreate}><Plus /> 새 프로젝트 만들기</Button></EmptyContent>}
        </Empty>
      )}
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function WorkspaceView({ view, project, onBack, onDirtyChange }: { view: View; project: Project | null; onBack: () => void; onDirtyChange: (value: boolean) => void }) {
  if (!project) {
    return (
      <div className="grid min-h-[calc(100vh-5rem)] place-items-center p-5">
        <Empty className="max-w-xl border bg-card">
          <EmptyHeader><EmptyMedia variant="icon"><FolderKanban /></EmptyMedia><EmptyTitle>선택된 연구가 없습니다</EmptyTitle><EmptyDescription>먼저 연구 프로젝트를 만든 뒤 기록 기능을 사용할 수 있습니다.</EmptyDescription></EmptyHeader>
          <EmptyContent><Button onClick={onBack}>나의 연구로 이동</Button></EmptyContent>
        </Empty>
      </div>
    );
  }

  if (view === 'reproducibility') return <AgentChat project={project} onBack={onBack} />;
  if (view === 'protocol' || view === 'schedule') return <ProjectRecords key={`${project.id}-${view}`} project={project} view={view} onBack={onBack} onDirtyChange={onDirtyChange} />;

  const content = {
    protocol: { eyebrow: 'EXPERIMENT NOTES', title: '실험 프로토콜', body: '실험 단계를 순서대로 기록하고 각 단계의 조건과 준비물을 정리합니다.', icon: FlaskConical },
    schedule: { eyebrow: 'SCHEDULE', title: '연구 일정', body: '실험일, 분석일과 제출 마감일을 한곳에서 관리합니다.', icon: CalendarDays },
    analysis: { eyebrow: 'MEASUREMENTS', title: '데이터 분석', body: '반복 측정값을 입력하고 평균, 표준편차와 불확도를 계산합니다.', icon: BarChart3 },
  }[view as Exclude<View, 'projects' | 'reproducibility'>];
  const Icon = content.icon;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-9">
      <Button variant="ghost" onClick={onBack} className="mb-6">← 나의 연구</Button>
      <Badge className={fieldStyles[project.field] ?? fieldStyles.기타}>{project.field}</Badge>
      <p className="mt-8 text-sm font-semibold text-primary">{content.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold">{content.title}</h1>
      <p className="mt-2 text-base text-muted-foreground">{project.title}</p>
      <div className="mt-8 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="grid size-12 place-items-center rounded-xl bg-secondary text-primary"><Icon /></div>
        <h2 className="mt-6 text-xl font-bold">기록 준비 완료</h2>
        <p className="mt-2 max-w-xl leading-7 text-muted-foreground">{content.body}</p>
        <Button className="mt-6"><Plus /> 첫 기록 추가</Button>
      </div>
    </div>
  );
}

function AgentChat({ project, onBack }: { project: Project; onBack: () => void }) {
  const [messages, setMessages] = useState([
    { role: 'agent', text: `“${project.title}” 연구 기록을 검토할 준비가 됐어요. 빠진 조건이나 재현성을 함께 확인해 볼까요?` },
  ]);
  const [message, setMessage] = useState('');

  function sendMessage(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { role: 'user', text },
      { role: 'agent', text: '현재는 대화 화면을 검증하는 베타 단계입니다. 다음 연결 단계에서 프로젝트의 프로토콜과 측정 조건을 바탕으로 실제 AI 검토를 제공할 예정이에요.' },
    ]);
    setMessage('');
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-5 py-8 md:px-9">
      <Button variant="ghost" onClick={onBack} className="mb-4 w-fit">← 나의 연구</Button>
      <div className="mb-6 flex items-center gap-4">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Bot /></div>
        <div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold">재현성 에이전트</h1><Badge variant="secondary"><Sparkles /> 베타</Badge></div><p className="mt-1 text-sm text-muted-foreground">{project.title}</p></div>
      </div>
      <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 md:p-7" aria-live="polite">
          {messages.map((item, index) => (
            <div key={index} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>{item.text}</div>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 border-t p-4">
          <Input value={message} onChange={(event) => setMessage(event.target.value)} className="h-10" placeholder="예: 이 실험에서 빠진 조건이 있어?" aria-label="재현성 에이전트에게 보낼 메시지" />
          <Button type="submit" size="icon" aria-label="메시지 보내기"><Send /></Button>
        </form>
      </section>
    </div>
  );
}
