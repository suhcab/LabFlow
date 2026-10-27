'use client';

import {
  SubmitEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {
  Atom,
  BookOpen,
  ImagePlus,
  BarChart3,
  ClipboardCheck,
  GitCompare,
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { databaseError, type Project } from '@/lib/project';
import { ProjectRecords } from '@/components/project-records';
import { AuthGate } from '@/components/auth-gate';
import { GlobalCalendar } from '@/components/global-calendar';
import {
  ResearchWorkspace,
  type ResearchView,
} from '@/components/research-workspace';

type View = 'projects' | 'calendar' | 'protocol' | 'schedule' | ResearchView;

const projectTabs: { id: View; label: string; icon: typeof FolderKanban }[] = [
  { id: 'overview', label: '연구 현황', icon: FolderKanban },
  { id: 'protocol', label: '실험 프로토콜', icon: FlaskConical },
  { id: 'schedule', label: '일정', icon: CalendarDays },
  { id: 'analysis', label: '데이터·불확도', icon: BarChart3 },
  { id: 'comparison', label: '실험 비교', icon: GitCompare },
  { id: 'reproducibility', label: '재현성 점검', icon: ClipboardCheck },
  { id: 'references', label: '참고문헌', icon: BookOpen },
  { id: 'images', label: '사진 분석', icon: ImagePlus },
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
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

export default function Home() {
  return (
    <AuthGate>
      <ResearchHome />
    </AuthGate>
  );
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
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [pending, setPending] = useState<{
    view: View;
    project: Project | null;
  } | null>(null);
  const unsaved = useRef(false);
  const recentKey = useRef('');
  const reportDirty = useCallback((value: boolean) => {
    unsaved.current = value;
    if (!value) setNotice(null);
  }, []);
  const updateProject = useCallback((updated: Project) => {
    setProjects((current) =>
      current.map((project) => (project.id === updated.id ? updated : project)),
    );
    setSelectedProject((current) =>
      current?.id === updated.id ? updated : current,
    );
  }, []);
  function remember(project: Project) {
    const ids = [
      project.id,
      ...recentIds.filter((id) => id !== project.id),
    ].slice(0, 10);
    setRecentIds(ids);
    try {
      if (recentKey.current)
        localStorage.setItem(recentKey.current, JSON.stringify(ids));
    } catch {
      /* History is optional; research data still uses Supabase. */
    }
  }
  async function loadProjects() {
    if (!isSupabaseConfigured) {
      setNotice('Supabase 연결 정보가 설정되지 않았습니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: auth } = await supabase.auth.getSession();
    if (auth.session) {
      recentKey.current = `labflow:recent:${auth.session.user.id}`;
      try {
        const stored: unknown = JSON.parse(
          localStorage.getItem(recentKey.current) ?? '[]',
        );
        if (Array.isArray(stored))
          setRecentIds(
            stored
              .filter((id): id is string => typeof id === 'string')
              .slice(0, 10),
          );
      } catch {
        /* Ignore an invalid optional history cache. */
      }
    }
    const read = () =>
      supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });
    let result = await read();
    if (result.error?.code === '42501' && auth.session) {
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      result = await read();
    }
    if (result.error) {
      setTableMissing(
        result.error.code === 'PGRST205' || result.error.code === '42P01',
      );
      setNotice(databaseError(result.error));
    } else {
      setProjects((result.data ?? []) as Project[]);
      setTableMissing(false);
      setNotice(null);
    }
    setLoading(false);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void loadProjects(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  function applyNavigation(next: View, project: Project | null) {
    unsaved.current = false;
    setNotice(null);
    setView(next);
    setSelectedProject(project);
    if (project) remember(project);
  }
  function navigate(next: View, project: Project | null = selectedProject) {
    if (next === 'projects' || next === 'calendar') project = null;
    if (next === view && project?.id === selectedProject?.id) return;
    if (unsaved.current) {
      setPending({ view: next, project });
      return;
    }
    applyNavigation(next, project);
  }
  function openProject(project: Project, next: View = 'overview') {
    navigate(next, project);
  }
  async function createProject(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const title = text('title'),
      topic = text('topic'),
      start = text('start_date'),
      due = text('due_date');
    if (!isSupabaseConfigured) {
      setNotice('Supabase 연결 정보가 설정되지 않았습니다.');
      return;
    }
    if (!title || !topic || (start && due && start > due)) {
      setNotice('프로젝트명·연구 주제와 날짜 순서를 확인해 주세요.');
      return;
    }
    setSaving(true);
    setNotice(null);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        title,
        topic,
        field: text('field') || '기타',
        status: '계획 중',
        start_date: start || null,
        due_date: due || null,
        progress: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setNotice(databaseError(error));
      return;
    }
    const created = data as Project;
    setProjects((current) => [created, ...current]);
    setDialogOpen(false);
    applyNavigation('overview', created);
  }
  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? projects.filter((project) =>
          [project.title, project.topic, project.field].some((value) =>
            value.toLowerCase().includes(needle),
          ),
        )
      : projects;
  }, [projects, query]);
  const recentProjects = Array.from(
    new Set([...recentIds, ...projects.map((project) => project.id)]),
  )
    .map((id) => projects.find((project) => project.id === id))
    .filter((project): project is Project => !!project)
    .slice(0, 10);
  const inProject =
    selectedProject && view !== 'projects' && view !== 'calendar';
  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="h-20 justify-center border-b px-3">
          <button
            onClick={() => navigate('projects')}
            className="flex items-center gap-3 overflow-hidden px-1 text-left"
            aria-label="LabFlow 프로젝트 목록"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Atom className="size-5" />
            </span>
            <span className="group-data-[collapsible=icon]:hidden">
              <span className="block font-bold">LabFlow</span>
              <span className="block text-xs text-muted-foreground">
                Research workspace
              </span>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarNavButton
                    isActive={view === 'calendar'}
                    tooltip="전체 달력"
                    onClick={() => navigate('calendar')}
                    className="h-11"
                  >
                    <CalendarDays />
                    <span>전체 달력</span>
                  </SidebarNavButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarNavButton
                    isActive={view === 'projects'}
                    tooltip="모든 프로젝트"
                    onClick={() => navigate('projects')}
                    className="h-11"
                  >
                    <FolderKanban />
                    <span>모든 프로젝트</span>
                  </SidebarNavButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>최근 프로젝트</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recentProjects.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarNavButton
                      isActive={selectedProject?.id === project.id}
                      tooltip={project.title}
                      onClick={() => openProject(project)}
                      className="h-10"
                    >
                      <FlaskConical />
                      <span className="truncate">{project.title}</span>
                    </SidebarNavButton>
                  </SidebarMenuItem>
                ))}
                {!loading && !recentProjects.length && (
                  <p className="px-2 py-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                    새 프로젝트를 만들어 연구를 시작하세요.
                  </p>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarNavButton
                tooltip="로그아웃"
                aria-label="로그아웃"
                onClick={async () => {
                  if (unsaved.current) {
                    setNotice(
                      '변경을 저장하거나 변경 취소한 뒤 로그아웃해 주세요.',
                    );
                    return;
                  }
                  const { error } = await supabase.auth.signOut();
                  if (error)
                    setNotice('로그아웃하지 못했습니다. 다시 시도해 주세요.');
                }}
              >
                <LogOut />
                <span>로그아웃</span>
              </SidebarNavButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-8">
          <SidebarTrigger aria-label="사이드바 접기 또는 펼치기" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {inProject
                ? selectedProject.title
                : view === 'calendar'
                  ? '전체 달력'
                  : '나의 연구 프로젝트'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {inProject
                ? `${selectedProject.field} · ${selectedProject.status} · 진행률 ${selectedProject.progress}%`
                : '프로젝트별 실험·분석·재현성 기록'}
            </p>
          </div>
          <NewProjectDialog
            open={dialogOpen}
            onOpenChange={(open) => {
              if (saving) return;
              if (open && unsaved.current) {
                setNotice(
                  '현재 기록을 먼저 저장한 뒤 새 프로젝트를 만들어 주세요.',
                );
                return;
              }
              setNotice(null);
              setDialogOpen(open);
            }}
            onSubmit={createProject}
            saving={saving}
            notice={notice}
          />
        </header>
        {view !== 'projects' && notice && (
          <output className="mx-5 mt-4 block rounded-xl border bg-muted p-4 text-sm">
            {notice}
          </output>
        )}
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
            onSelect={(project) => openProject(project)}
          />
        ) : view === 'calendar' ? (
          <GlobalCalendar
            projects={projects}
            onOpen={(project) => openProject(project, 'schedule')}
          />
        ) : selectedProject ? (
          <>
            <nav
              aria-label="프로젝트 탭"
              className="flex gap-1 overflow-x-auto border-b bg-card px-4 py-3 md:px-8"
            >
              {projectTabs.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant={view === id ? 'secondary' : 'ghost'}
                  className="shrink-0"
                  aria-current={view === id ? 'page' : undefined}
                  onClick={() => navigate(id)}
                >
                  <Icon className="size-4" />
                  {label}
                </Button>
              ))}
            </nav>
            {view === 'protocol' || view === 'schedule' ? (
              <ProjectRecords
                key={`${selectedProject.id}-${view}`}
                project={selectedProject}
                view={view}
                onBack={() => navigate('projects')}
                onDirtyChange={reportDirty}
              />
            ) : (
              <ResearchWorkspace
                key={`${selectedProject.id}-${view}`}
                project={selectedProject}
                view={view as ResearchView}
                onDirtyChange={reportDirty}
                onProjectChange={updateProject}
                onNavigate={(next) => navigate(next)}
              />
            )}
          </>
        ) : (
          <div className="p-8">
            <p>왼쪽에서 프로젝트를 선택해 주세요.</p>
            <Button className="mt-4" onClick={() => navigate('projects')}>
              프로젝트 목록
            </Button>
          </div>
        )}
      </SidebarInset>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>저장하지 않은 변경이 있습니다</DialogTitle>
            <DialogDescription>
              현재 변경을 취소하고 다른 연구 화면으로 이동할까요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              계속 편집
            </Button>
            <Button
              onClick={() => {
                if (pending) {
                  applyNavigation(pending.view, pending.project);
                  setPending(null);
                }
              }}
            >
              변경 취소하고 이동
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function SidebarNavButton(props: ComponentProps<typeof SidebarMenuButton>) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuButton
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        setOpenMobile(false);
      }}
    />
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
            <DialogDescription>
              연구의 기본 정보를 입력하세요. 나중에 실험과 기록을 추가할 수
              있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <label
              htmlFor="project-title"
              className="grid gap-2 text-sm font-medium"
            >
              프로젝트명
              <Input
                id="project-title"
                name="title"
                required
                maxLength={120}
                placeholder="예: 단진자 운동을 이용한 중력가속도 측정"
              />
            </label>
            <label
              htmlFor="project-topic"
              className="grid gap-2 text-sm font-medium"
            >
              연구 주제
              <Textarea
                id="project-topic"
                name="topic"
                required
                placeholder="무엇을 알아보기 위한 연구인가요?"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label
                htmlFor="project-field"
                className="grid gap-2 text-sm font-medium"
              >
                연구 분야
                <Select name="field" defaultValue="물리">
                  <SelectTrigger id="project-field" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      '물리',
                      '화학',
                      '생명과학',
                      '지구과학',
                      '정보과학',
                      '융합',
                      '기타',
                    ].map((field) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label
                htmlFor="project-start"
                className="grid gap-2 text-sm font-medium"
              >
                시작일
                <Input id="project-start" name="start_date" type="date" />
              </label>
              <label
                htmlFor="project-due"
                className="grid gap-2 text-sm font-medium"
              >
                마감일
                <Input id="project-due" name="due_date" type="date" />
              </label>
            </div>
          </div>
          {notice && (
            <output className="mb-4 block text-sm text-destructive">
              {notice}
            </output>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '저장 중…' : '프로젝트 저장'}
            </Button>
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
          <p className="mb-2 text-sm font-semibold text-primary">
            RESEARCH LIBRARY
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            나의 연구
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            프로젝트를 선택해 실험 프로토콜과 연구 일정을 관리하세요.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 pl-9"
            placeholder="프로젝트 검색"
            aria-label="프로젝트 검색"
          />
        </div>
      </div>

      {notice && (
        <div
          className={`mb-6 flex flex-col justify-between gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center ${tableMissing ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-cyan-200 bg-cyan-50 text-cyan-950'}`}
        >
          <span>{notice}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            연결 다시 확인
          </Button>
        </div>
      )}

      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="전체 프로젝트"
          value={allProjects.length}
          detail="Supabase에 저장된 연구"
        />
        <StatCard
          label="검색 결과"
          value={projects.length}
          detail={query ? `“${query}” 검색 결과` : '현재 표시 중인 연구'}
        />
      </section>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : projects.length > 0 ? (
        <section
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          aria-label="연구 프로젝트 목록"
        >
          {projects.map((project) => (
            <button
              type="button"
              key={project.id}
              onClick={() => onSelect(project)}
              className="group rounded-2xl border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <div className="flex items-start justify-between gap-4">
                <Badge
                  className={fieldStyles[project.field] ?? fieldStyles.기타}
                >
                  {project.field}
                </Badge>
              </div>
              <h2 className="mt-6 line-clamp-2 text-xl font-bold leading-snug">
                {project.title}
              </h2>
              <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground">
                {project.topic || '연구 주제를 입력하지 않았습니다.'}
              </p>
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
            <EmptyMedia variant="icon">
              <FolderKanban />
            </EmptyMedia>
            <EmptyTitle className="text-base">
              {query ? '검색 결과가 없습니다' : '첫 연구를 시작해 보세요'}
            </EmptyTitle>
            <EmptyDescription>
              {query
                ? '다른 프로젝트명이나 분야를 검색해 보세요.'
                : '프로젝트를 만들면 실험 과정과 연구 일정을 함께 기록할 수 있습니다.'}
            </EmptyDescription>
          </EmptyHeader>
          {!query && !tableMissing && (
            <EmptyContent>
              <Button onClick={onCreate}>
                <Plus /> 새 프로젝트 만들기
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}
