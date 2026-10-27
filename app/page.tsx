'use client';

import { SubmitEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Atom,
  CalendarDays,
  ChevronRight,
  FlaskConical,
  FolderKanban,
  LogOut,
  Plus,
  Search,
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
import { AuthGate } from '@/components/auth-gate';

type View = 'projects' | 'protocol' | 'schedule';

const navItems: { id: View; label: string; icon: typeof FolderKanban }[] = [
  { id: 'projects', label: '나의 연구', icon: FolderKanban },
  { id: 'protocol', label: '실험 프로토콜', icon: FlaskConical },
  { id: 'schedule', label: '연구 일정', icon: CalendarDays },
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
  return <AuthGate><ResearchHome /></AuthGate>;
}

function ResearchHome() {
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
    if (saving) return;
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
              <SidebarMenuButton tooltip="로그아웃" aria-label="로그아웃" onClick={async () => {
                if (unsaved.current && !window.confirm('저장하지 않은 변경을 취소하고 로그아웃할까요?')) return;
                const { error } = await supabase.auth.signOut();
                if (error) setNotice('로그아웃하지 못했습니다. 다시 시도해 주세요.');
              }}><LogOut /><span>로그아웃</span></SidebarMenuButton>
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
          <p className="mt-2 text-base text-muted-foreground">프로젝트를 선택해 실험 프로토콜과 연구 일정을 관리하세요.</p>
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

      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard label="전체 프로젝트" value={allProjects.length} detail="Supabase에 저장된 연구" />
        <StatCard label="검색 결과" value={projects.length} detail={query ? `“${query}” 검색 결과` : '현재 표시 중인 연구'} />
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
              </div>
              <h2 className="mt-6 line-clamp-2 text-xl font-bold leading-snug">{project.title}</h2>
              <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground">{project.topic || '연구 주제를 입력하지 않았습니다.'}</p>
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
            <EmptyDescription>{query ? '다른 프로젝트명이나 분야를 검색해 보세요.' : '프로젝트를 만들면 실험 과정과 연구 일정을 함께 기록할 수 있습니다.'}</EmptyDescription>
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

  return <ProjectRecords key={`${project.id}-${view}`} project={project} view={view === 'schedule' ? 'schedule' : 'protocol'} onBack={onBack} onDirtyChange={onDirtyChange} />;
}
