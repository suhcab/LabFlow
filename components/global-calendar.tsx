'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { databaseError, type Project } from '@/lib/project';

type CalendarEvent = {
  id: string;
  project_id: string;
  title: string;
  event_date: string;
  event_time: string;
  completed: boolean;
  kind: string;
};
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function GlobalCalendar({
  projects,
  onOpen,
}: {
  projects: Project[];
  onOpen: (project: Project) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState(() => localDate(new Date()));
  const [filter, setFilter] = useState('all');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const start = localDate(month);
  const end = localDate(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setNotice('');
      const { data, error } = await supabase
        .from('research_events')
        .select('id,project_id,title,event_date,event_time,completed,kind')
        .gte('event_date', start)
        .lt('event_date', end)
        .order('event_date')
        .order('event_time');
      if (!active) return;
      if (error) setNotice(databaseError(error));
      else setEvents((data ?? []) as CalendarEvent[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [start, end, revision]);
  const visible = useMemo(
    () =>
      [
        ...events,
        ...projects
          .filter(
            (project) =>
              project.due_date &&
              project.due_date >= start &&
              project.due_date < end,
          )
          .map((project) => ({
            id: `deadline-${project.id}`,
            project_id: project.id,
            title: `${project.title} 마감`,
            event_date: project.due_date!,
            event_time: '',
            completed: project.status === '완료',
            kind: '프로젝트 마감',
          })),
      ].filter(
        (event) =>
          projects.some((project) => project.id === event.project_id) &&
          (filter === 'all' || event.project_id === filter),
      ),
    [events, projects, filter, start, end],
  );
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const selectedEvents = visible.filter(
    (event) => event.event_date === selected,
  );
  function changeMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelected(localDate(next));
  }
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-5 md:p-9">
      <div>
        <p className="text-sm font-semibold text-primary">ALL PROJECTS</p>
        <h1 className="mt-2 text-3xl font-bold">전체 달력</h1>
        <p className="mt-2 text-muted-foreground">
          모든 연구 일정을 한눈에 확인하고 프로젝트로 이동하세요.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="이전 달"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft />
          </Button>
          <h2 className="min-w-36 text-center text-lg font-semibold">
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </h2>
          <Button
            variant="outline"
            size="icon"
            aria-label="다음 달"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelected(localDate(now));
            }}
          >
            오늘
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          프로젝트 필터
          <select
            aria-label="달력 프로젝트 필터"
            className="max-w-56 rounded-md border bg-background p-2"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">모든 프로젝트</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <output className="block rounded-xl border p-4">
          {notice}
          <Button
            className="ml-3"
            variant="outline"
            onClick={() => setRevision((value) => value + 1)}
          >
            다시 불러오기
          </Button>
        </output>
      )}
      {loading && <output>일정 불러오는 중…</output>}
      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-7 bg-muted text-center text-sm">
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
            <div key={day} className="p-2 font-medium">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: month.getDay() }, (_, index) => (
            <div
              key={`blank-${index}`}
              className="min-h-24 border-b border-r bg-muted/30"
            />
          ))}
          {Array.from({ length: days }, (_, index) => {
            const date = `${start.slice(0, 8)}${String(index + 1).padStart(2, '0')}`;
            const dayEvents = visible.filter(
              (event) => event.event_date === date,
            );
            return (
              <button
                key={date}
                aria-label={`${date} 일정 ${dayEvents.length}개`}
                aria-pressed={selected === date}
                onClick={() => setSelected(date)}
                className={`min-h-24 min-w-0 border-b border-r p-2 text-left align-top transition hover:bg-accent ${selected === date ? 'bg-primary/10 ring-2 ring-inset ring-primary' : ''}`}
              >
                <span className="text-sm font-medium">{index + 1}</span>
                {dayEvents.slice(0, 2).map((event) => (
                  <span
                    key={event.id}
                    className={`mt-1 block truncate rounded bg-secondary px-1 text-xs ${event.completed ? 'line-through opacity-60' : ''}`}
                  >
                    {event.title}
                  </span>
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-xs">+{dayEvents.length - 2}개</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">{selected} 일정</h2>
        {!loading && !selectedEvents.length && (
          <p className="mt-4 text-sm text-muted-foreground">
            등록된 일정이 없습니다. 프로젝트의 일정 탭에서 추가할 수 있습니다.
          </p>
        )}
        <ul className="divide-y">
          {selectedEvents.map((event) => {
            const project = projects.find(
              (item) => item.id === event.project_id,
            );
            return (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p
                    className={event.completed ? 'line-through' : 'font-medium'}
                  >
                    {event.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project?.title ?? '연구 프로젝트'} ·{' '}
                    {event.event_time || '시간 미지정'} · {event.kind} ·{' '}
                    {event.completed ? '완료' : '예정'}
                  </p>
                </div>
                {project && (
                  <Button variant="outline" onClick={() => onOpen(project)}>
                    프로젝트 일정 열기
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
