'use client';

import { SubmitEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowDown, ArrowUp, Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { databaseError, type Project } from '@/lib/project';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type Step = { id: string; title: string; materials: string; equipment: string; conditions: string; notes: string };
type Protocol = { purpose: string; steps: Step[] };
type ResearchEvent = { id: string; project_id: string; title: string; event_date: string; event_time: string; kind: string; notes: string; completed: boolean };
type EventDraft = Omit<ResearchEvent, 'id' | 'project_id'>;
const newStep = (): Step => ({ id: crypto.randomUUID(), title: '', materials: '', equipment: '', conditions: '', notes: '' });
const newEvent = (): EventDraft => ({ title: '', event_date: '', event_time: '', kind: '실험', notes: '', completed: false });

export function ProjectRecords({ project, view, onBack, onDirtyChange }: { project: Project; view: 'protocol' | 'schedule'; onBack: () => void; onDirtyChange: (value: boolean) => void }) {
  const [protocol, setProtocol] = useState<Protocol>({ purpose: '', steps: [] });
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [draft, setDraft] = useState<EventDraft>(newEvent);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setReady(false);
      if (!isSupabaseConfigured) {
        setNotice('Supabase 연결 정보가 설정되지 않았습니다.');
        setLoading(false);
        return;
      }
      const result = view === 'protocol'
        ? await supabase.from('protocols').select('purpose, steps').eq('project_id', project.id).maybeSingle()
        : await supabase.from('research_events').select('*').eq('project_id', project.id).order('event_date').order('event_time');
      if (!active) return;
      if (result.error) setNotice(databaseError(result.error));
      else {
        if (view === 'protocol') setProtocol((result.data as Protocol | null) ?? { purpose: '', steps: [] });
        else setEvents((result.data ?? []) as ResearchEvent[]);
        setReady(true);
        setNotice('');
        setDirty(false);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [project.id, view, revision]);

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function changeProtocol(next: Protocol) {
    setProtocol(next);
    setDirty(true);
    setNotice('');
  }

  function updateStep(id: string, field: keyof Omit<Step, 'id'>, value: string) {
    changeProtocol({ ...protocol, steps: protocol.steps.map((step) => step.id === id ? { ...step, [field]: value } : step) });
  }

  function moveStep(index: number, offset: number) {
    const steps = [...protocol.steps];
    [steps[index], steps[index + offset]] = [steps[index + offset], steps[index]];
    changeProtocol({ ...protocol, steps });
  }

  async function saveProtocol(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || saving) return;
    if (protocol.steps.some((step) => !step.title.trim())) {
      setNotice('모든 단계의 제목을 입력해 주세요.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('protocols').upsert({
      project_id: project.id, ...protocol, updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id' });
    setNotice(error ? databaseError(error) : '프로토콜을 저장했습니다.');
    if (!error) setDirty(false);
    setSaving(false);
  }

  async function saveEvent(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || saving) return;
    if (!draft.title.trim()) { setNotice('일정 제목을 입력해 주세요.'); return; }
    setSaving(true);
    const payload = { ...draft, title: draft.title.trim(), project_id: project.id, updated_at: new Date().toISOString() };
    const query = editingId
      ? supabase.from('research_events').update(payload).eq('id', editingId).eq('project_id', project.id)
      : supabase.from('research_events').insert(payload);
    const { data, error } = await query.select().single();
    if (error) setNotice(databaseError(error));
    else {
      const saved = data as ResearchEvent;
      setEvents((current) => [...current.filter((item) => item.id !== saved.id), saved]);
      setDraft(newEvent());
      setEditingId(null);
      setFormOpen(false);
      setDirty(false);
      setNotice('일정을 저장했습니다.');
    }
    setSaving(false);
  }

  async function toggleEvent(item: ResearchEvent) {
    setSaving(true);
    const { data, error } = await supabase.from('research_events').update({ completed: !item.completed, updated_at: new Date().toISOString() })
      .eq('id', item.id).eq('project_id', project.id).select().single();
    if (error) setNotice(databaseError(error));
    else { setEvents((current) => current.map((entry) => entry.id === item.id ? data as ResearchEvent : entry)); setNotice('일정 상태를 저장했습니다.'); }
    setSaving(false);
  }

  async function deleteEvent(item: ResearchEvent) {
    if (!window.confirm(`“${item.title}” 일정을 삭제할까요?`)) return;
    setSaving(true);
    const { data, error } = await supabase.from('research_events').delete().eq('id', item.id).eq('project_id', project.id).select('id').single();
    if (error) setNotice(databaseError(error));
    else if (data) { setEvents((current) => current.filter((entry) => entry.id !== item.id)); setNotice('일정을 삭제했습니다.'); }
    setSaving(false);
  }

  function discardDraft() {
    if (dirty && !window.confirm('저장하지 않은 변경을 취소할까요?')) return;
    setFormOpen(false); setEditingId(null); setDraft(newEvent()); setDirty(false);
  }

  const today = new Intl.DateTimeFormat('sv-SE').format(new Date());
  const orderedEvents = [...events].sort((a, b) => `${a.event_date} ${a.event_time}`.localeCompare(`${b.event_date} ${b.event_time}`));

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-9">
      <Button variant="ghost" onClick={onBack} className="mb-6"><ArrowLeft /> 나의 연구</Button>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div className="min-w-0"><h1 className="text-2xl font-bold">{view === 'protocol' ? '실험 프로토콜' : '연구 일정'}</h1><p className="mt-2 break-words text-sm text-muted-foreground">{project.title}</p></div>
        {view === 'schedule' && <Button disabled={!ready || saving || formOpen} onClick={() => { setDraft(newEvent()); setEditingId(null); setFormOpen(true); }}><Plus /> 일정 추가</Button>}
      </div>
      {notice && <div className="my-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-primary bg-muted p-4 text-sm"><output className="min-w-0 break-words">{notice}</output>{!ready && <Button variant="outline" disabled={loading} onClick={() => setRevision((n) => n + 1)}>다시 연결</Button>}</div>}
      {loading ? <output className="block py-12 text-sm text-muted-foreground">기록을 불러오는 중…</output> : !ready ? null : view === 'protocol' ? (
        <form onSubmit={saveProtocol} className="space-y-6 py-6">
          <fieldset disabled={saving} className="space-y-6">
            <div className="grid gap-2 text-sm font-medium"><label htmlFor="protocol-purpose">실험 목적</label><Textarea id="protocol-purpose" value={protocol.purpose} onChange={(event) => changeProtocol({ ...protocol, purpose: event.target.value })} maxLength={5000} /></div>
            {protocol.steps.map((step, index) => (
              <section key={step.id} className="border-t pt-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">단계 {index + 1}</h2>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" title="단계 위로 이동" aria-label="단계 위로 이동" disabled={index === 0} onClick={() => moveStep(index, -1)}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon" title="단계 아래로 이동" aria-label="단계 아래로 이동" disabled={index === protocol.steps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon" title="단계 삭제" aria-label="단계 삭제" onClick={() => { if (window.confirm('이 단계를 삭제할까요?')) changeProtocol({ ...protocol, steps: protocol.steps.filter((entry) => entry.id !== step.id) }); }}><Trash2 /></Button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label htmlFor={`${step.id}-title`} className="grid gap-2 text-sm sm:col-span-2">제목<Input id={`${step.id}-title`} required maxLength={120} value={step.title} onChange={(event) => updateStep(step.id, 'title', event.target.value)} /></label>
                  <label htmlFor={`${step.id}-materials`} className="grid gap-2 text-sm">준비물<Input id={`${step.id}-materials`} maxLength={1000} value={step.materials} onChange={(event) => updateStep(step.id, 'materials', event.target.value)} /></label>
                  <label htmlFor={`${step.id}-equipment`} className="grid gap-2 text-sm">측정 장비·단위<Input id={`${step.id}-equipment`} maxLength={1000} value={step.equipment} onChange={(event) => updateStep(step.id, 'equipment', event.target.value)} /></label>
                  <div className="grid gap-2 text-sm"><label htmlFor={`${step.id}-conditions`}>실험 조건</label><Textarea id={`${step.id}-conditions`} maxLength={5000} value={step.conditions} onChange={(event) => updateStep(step.id, 'conditions', event.target.value)} /></div>
                  <div className="grid gap-2 text-sm"><label htmlFor={`${step.id}-notes`}>절차·주의 사항</label><Textarea id={`${step.id}-notes`} maxLength={5000} value={step.notes} onChange={(event) => updateStep(step.id, 'notes', event.target.value)} /></div>
                </div>
              </section>
            ))}
            <Button type="button" variant="outline" onClick={() => changeProtocol({ ...protocol, steps: [...protocol.steps, newStep()] })}><Plus /> 단계 추가</Button>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3 border-t pt-5"><Button disabled={saving || !dirty} type="submit"><Save /> {saving ? '저장 중…' : '프로토콜 저장'}</Button><span className="text-xs text-muted-foreground">{dirty ? '저장하지 않은 변경' : '변경 사항 없음'}</span></div>
        </form>
      ) : (
        <div className="py-6">
          <p className="mb-5 text-sm text-muted-foreground">예정 {events.filter((item) => !item.completed).length} · 완료 {events.filter((item) => item.completed).length}{project.due_date && ` · 프로젝트 마감 ${project.due_date}`}</p>
          {formOpen && <form onSubmit={saveEvent} className="mb-6 border-y py-5">
            <h2 className="mb-4 text-base font-semibold">{editingId ? '일정 수정' : '새 일정'}</h2>
            <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2" onChange={() => setDirty(true)}>
              <label htmlFor="event-title" className="grid gap-2 text-sm sm:col-span-2">일정 제목<Input id="event-title" required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <label htmlFor="event-date" className="grid gap-2 text-sm">날짜<Input id="event-date" required type="date" value={draft.event_date} onChange={(event) => setDraft({ ...draft, event_date: event.target.value })} /></label>
              <label htmlFor="event-time" className="grid gap-2 text-sm">시간<Input id="event-time" type="time" value={draft.event_time} onChange={(event) => setDraft({ ...draft, event_time: event.target.value })} /></label>
              <label className="grid gap-2 text-sm">구분<select className="h-9 rounded-md border bg-background px-3 text-sm" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}>{['실험', '분석', '제출', '기타'].map((kind) => <option key={kind}>{kind}</option>)}</select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.completed} onChange={(event) => setDraft({ ...draft, completed: event.target.checked })} />완료</label>
              <div className="grid gap-2 text-sm sm:col-span-2"><label htmlFor="event-notes">메모</label><Textarea id="event-notes" maxLength={5000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></div>
            </fieldset>
            <div className="mt-4 flex gap-2"><Button disabled={saving} type="submit"><Save /> {saving ? '저장 중…' : '일정 저장'}</Button><Button disabled={saving} type="button" variant="outline" onClick={discardDraft}><X /> 취소</Button></div>
          </form>}
          {orderedEvents.length === 0 ? <p className="border-y py-12 text-center text-sm text-muted-foreground">등록된 일정이 없습니다.</p> : <ul className="divide-y border-y">
            {orderedEvents.map((item) => <li key={item.id} className="flex items-start gap-3 py-5">
              <Button variant={item.completed ? 'secondary' : 'outline'} size="icon" disabled={saving} title={item.completed ? '미완료로 변경' : '완료로 변경'} aria-label={`${item.title} ${item.completed ? '미완료로 변경' : '완료로 변경'}`} onClick={() => void toggleEvent(item)} className="shrink-0"><Check className={item.completed ? '' : 'opacity-30'} /></Button>
              <div className="min-w-0 flex-1"><p className={`break-words text-sm font-semibold ${item.completed ? 'text-muted-foreground line-through' : ''}`}>{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.event_date} {item.event_time} · {item.kind}{!item.completed && item.event_date < today && <span className="ml-2 text-destructive">기한 지남</span>}</p>{item.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.notes}</p>}</div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row"><Button variant="ghost" size="icon" disabled={saving || formOpen} title="일정 수정" aria-label={`${item.title} 수정`} onClick={() => { setEditingId(item.id); setDraft({ title: item.title, event_date: item.event_date, event_time: item.event_time, kind: item.kind, notes: item.notes, completed: item.completed }); setFormOpen(true); }}><Pencil /></Button><Button variant="ghost" size="icon" disabled={saving || formOpen} title="일정 삭제" aria-label={`${item.title} 삭제`} onClick={() => void deleteEvent(item)}><Trash2 /></Button></div>
            </li>)}
          </ul>}
        </div>
      )}
    </main>
  );
}
