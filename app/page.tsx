import { Atom, BarChart3, CalendarDays, ChevronRight, ClipboardCheck, FlaskConical, Gauge, LayoutDashboard, Plus, Search, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';

const navItems = [
  { label: '대시보드', icon: LayoutDashboard, active: true },
  { label: '실험 프로토콜', icon: FlaskConical },
  { label: '연구 일정', icon: CalendarDays },
  { label: '데이터 분석', icon: BarChart3 },
  { label: '재현성 검사', icon: ClipboardCheck },
];
const steps = [
  { title: '장치 구성', detail: '스탠드에 실을 고정하고 추를 연결', status: '완료' },
  { title: '길이 측정', detail: '회전축부터 추의 질량중심까지 측정', status: '완료' },
  { title: '주기 측정', detail: '10회 왕복 시간을 5번 반복 측정', status: '진행 중' },
  { title: '결과 분석', detail: '중력가속도와 불확도 계산', status: '예정' },
];
const measurements = [['1회', '20.12 s', '2.012 s'], ['2회', '20.06 s', '2.006 s'], ['3회', '20.18 s', '2.018 s']];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 px-7">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Atom className="size-5" /></div>
          <div><p className="text-lg font-bold tracking-tight">LabFlow</p><p className="text-xs text-muted-foreground">Research workspace</p></div>
        </div>
        <nav className="space-y-1 px-4 pt-5" aria-label="주요 메뉴">
          {navItems.map(({ label, icon: Icon, active }) => (
            <a key={label} href="#" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
              <Icon className="size-4" />{label}
            </a>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-sidebar-border bg-background/70 p-4">
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">프로젝트 진행률</span><Gauge className="size-4 text-primary" /></div>
            <Progress value={38} className="gap-2"><ProgressLabel className="text-xs text-muted-foreground">단진자 운동 분석</ProgressLabel><ProgressValue className="text-xs" /></Progress>
          </div>
          <Button variant="ghost" className="mt-3 w-full justify-start text-muted-foreground"><Settings2 /> 설정</Button>
        </div>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b bg-background/90 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-3 lg:hidden"><div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Atom className="size-5" /></div><span className="font-bold">LabFlow</span></div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex"><span>내 연구</span><ChevronRight className="size-4" /><span className="font-medium text-foreground">단진자 운동 분석</span></div>
          <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="검색"><Search /></Button><Button><Plus /> 새 실험</Button></div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 md:py-10">
          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><div className="mb-3 flex items-center gap-2"><Badge className="bg-cyan-100 text-cyan-800">물리</Badge><Badge variant="outline">진행 중</Badge></div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">단진자 운동으로 중력가속도 측정</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">진자의 길이와 주기를 반복 측정하고, 중력가속도와 측정 불확도를 계산합니다.</p></div>
            <p className="text-sm text-muted-foreground">마지막 수정 · 오늘 15:42</p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-7">
              <div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Protocol</p><h2 className="mt-1 text-xl font-bold">실험 프로토콜</h2></div><Button variant="outline" size="sm">전체 보기</Button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {steps.map((step, index) => <article key={step.title} className="group rounded-xl border bg-background p-4 transition-colors hover:border-primary/40"><div className="mb-5 flex items-start justify-between"><span className="grid size-8 place-items-center rounded-lg bg-secondary font-mono text-sm font-bold text-primary">{String(index + 1).padStart(2, '0')}</span><Badge variant={step.status === '진행 중' ? 'default' : 'secondary'}>{step.status}</Badge></div><h3 className="font-semibold">{step.title}</h3><p className="mt-1 text-sm text-muted-foreground">{step.detail}</p></article>)}
              </div>
            </section>
            <aside className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary-foreground/60">Next schedule</p>
              <div className="mt-7 flex gap-5"><div className="text-center"><p className="text-xs text-primary-foreground/60">SEP</p><p className="text-4xl font-bold">07</p></div><div className="border-l border-primary-foreground/20 pl-5"><h2 className="text-lg font-bold">주기 반복 측정</h2><p className="mt-1 text-sm text-primary-foreground/65">물리 실험실 · 16:00</p></div></div>
              <div className="mt-8 rounded-xl bg-primary-foreground/10 p-4 text-sm leading-6"><p className="font-semibold">준비물 확인</p><p className="mt-1 text-primary-foreground/70">스탠드, 실, 금속 추, 줄자, 광게이트 센서</p></div>
            </aside>
          </div>

          <section className="mt-5 rounded-2xl border bg-card p-5 shadow-sm md:p-7">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Measurements</p><h2 className="mt-1 text-xl font-bold">최근 측정값</h2></div><div className="flex gap-5 text-sm"><span className="text-muted-foreground">진자 길이 <b className="ml-1 text-foreground">1.000 m</b></span><span className="text-muted-foreground">평균 주기 <b className="ml-1 text-foreground">2.012 s</b></span></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-y bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3 font-medium">측정</th><th className="px-4 py-3 font-medium">10회 왕복 시간</th><th className="px-4 py-3 font-medium">주기</th><th className="px-4 py-3 font-medium">상태</th></tr></thead><tbody>{measurements.map((row) => <tr key={row[0]} className="border-b last:border-0"><td className="px-4 py-4 font-medium">{row[0]}</td><td className="px-4 py-4 font-mono">{row[1]}</td><td className="px-4 py-4 font-mono">{row[2]}</td><td className="px-4 py-4"><Badge variant="secondary">기록 완료</Badge></td></tr>)}</tbody></table></div>
          </section>
        </div>
      </section>
    </main>
  );
}
