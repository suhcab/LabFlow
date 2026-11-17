'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { saveVersioned } from '@/lib/collaboration';
import { databaseError, type Project } from '@/lib/project';
import { downloadText } from '@/lib/research';
type Entry = {
  id: string;
  date: string;
  done: string;
  problem: string;
  next: string;
};
const blank = (): Entry => ({
  id: crypto.randomUUID(),
  date: new Intl.DateTimeFormat('sv-SE').format(new Date()),
  done: '',
  problem: '',
  next: '',
});
export function ResearchJournal({
  project,
  onDirtyChange,
}: {
  project: Project;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [design, setDesign] = useState<Record<string, unknown>>({});
  const [version, setVersion] = useState<number | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<Entry>(blank);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await supabase
        .from('research_designs')
        .select('design,revision')
        .eq('project_id', project.id)
        .maybeSingle();
      if (!active) return;
      if (result.error) setNotice(databaseError(result.error));
      else {
        const value = result.data?.design ?? {};
        const saved = (value.journal_entries ?? []) as Entry[];
        setDesign(value);
        setVersion(result.data?.revision ?? null);
        setEntries(saved);
        const fresh = blank();
        setDraft(saved.find((entry) => entry.date === fresh.date) ?? fresh);
        setReady(true);
      }
    })();
    return () => {
      active = false;
      onDirtyChange(false);
    };
  }, [project.id, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(value: Partial<Entry>) {
    setDraft((current) => ({ ...current, ...value }));
    setDirty(true);
    onDirtyChange(true);
    setNotice('');
  }
  function open(entry: Entry) {
    if (dirty) {
      setNotice(
        '작성 중인 일지를 저장하거나 변경 취소한 뒤 다른 날짜를 여세요.',
      );
      return;
    }
    setDraft(entry);
    setNotice('');
  }
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready) return;
    if (!draft.date || !draft.done.trim()) {
      setNotice('날짜와 오늘 한 일을 입력하세요.');
      return;
    }
    if (
      entries.some(
        (entry) => entry.date === draft.date && entry.id !== draft.id,
      )
    ) {
      setNotice(
        '이 날짜의 일지가 이미 있습니다. 변경 취소 후 아래 목록에서 해당 일지를 열어 수정하세요.',
      );
      return;
    }
    setBusy(true);
    try {
      const next = [
        ...entries.filter((entry) => entry.id !== draft.id),
        {
          ...draft,
          done: draft.done.trim(),
          problem: draft.problem.trim(),
          next: draft.next.trim(),
        },
      ].sort((a, b) => b.date.localeCompare(a.date));
      const value = { ...design, journal_entries: next };
      const result = await saveVersioned(
        'research_designs',
        { project_id: project.id, design: value },
        version,
      );
      if (result.error) setNotice(databaseError(result.error));
      else {
        setDesign(value);
        setVersion(result.data.revision);
        setEntries(next);
        setDirty(false);
        onDirtyChange(false);
        setNotice('연구 일지를 저장했습니다. 수정 이력에도 기록됩니다.');
      }
    } catch {
      setNotice(
        '저장소에 연결하지 못했습니다. 작성 내용은 유지됩니다. 다시 시도하세요.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-5 md:p-9">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">연구 일지</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            실험한 날짜마다 한 편씩, 짧게 기록하세요. 팀원과 함께 수정하며 변경
            전후는 수정 이력에서 확인할 수 있습니다.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!entries.length || busy}
          onClick={() =>
            downloadText(
              `${project.title}-연구일지.md`,
              `# ${project.title} 연구 일지\n\n` +
                [...entries]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(
                    (entry) =>
                      `## ${entry.date}\n\n### 오늘 한 일\n${entry.done}\n\n### 생긴 문제\n${entry.problem || '기록 없음'}\n\n### 다음에 할 일\n${entry.next || '기록 없음'}`,
                  )
                  .join('\n\n'),
              'text/markdown;charset=utf-8',
            )
          }
        >
          일지 내보내기
        </Button>
      </div>
      <output className="block text-sm" aria-live="polite">
        {notice || (!ready ? '연구 일지 불러오는 중…' : '')}
      </output>
      <form onSubmit={save} className="rounded-xl border bg-card p-5 space-y-4">
        <fieldset disabled={!ready || busy} className="space-y-4">
          <label className="grid max-w-xs gap-2 text-sm" htmlFor="journal-date">
            실험 날짜
            <Input
              id="journal-date"
              type="date"
              required
              value={draft.date}
              onChange={(event) => change({ date: event.target.value })}
            />
          </label>
          {(
            [
              {
                key: 'done',
                label: '오늘 한 일',
                placeholder: '예: 진자 길이 0.50 m에서 주기를 5회 측정했다.',
              },
              {
                key: 'problem',
                label: '생긴 문제',
                placeholder:
                  '예: 시작 버튼을 누르는 시점이 달라 값이 흔들렸다. 없으면 “없음”.',
              },
              {
                key: 'next',
                label: '다음에 할 일',
                placeholder: '예: 같은 기준점을 정하고 팀원과 다시 측정한다.',
              },
            ] as const
          ).map((field) => (
            <label
              key={field.key}
              htmlFor={`journal-${field.key}`}
              className="grid gap-2 text-sm"
            >
              {field.label}
              <Textarea
                id={`journal-${field.key}`}
                required={field.key === 'done'}
                maxLength={2000}
                value={draft[field.key]}
                onChange={(event) =>
                  change({ [field.key]: event.target.value })
                }
                placeholder={field.placeholder}
              />
              <span className="text-xs text-muted-foreground">
                {draft[field.key].length}/2000
              </span>
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!dirty}>
              {busy ? '저장 중…' : '일지 저장'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(
                  entries.find((entry) => entry.id === draft.id) ?? blank(),
                );
                setDirty(false);
                onDirtyChange(false);
                setNotice('변경을 취소했습니다.');
              }}
            >
              변경 취소
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={dirty}
              onClick={() => open(blank())}
            >
              새 날짜 기록
            </Button>
          </div>
        </fieldset>
      </form>
      <section className="space-y-3">
        <h2 className="font-semibold">저장한 일지 · {entries.length}편</h2>
        {ready && !entries.length && (
          <p className="text-sm text-muted-foreground">
            아직 일지가 없습니다. 첫 실험을 기록해 보세요.
          </p>
        )}
        {[...entries]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((entry) => (
            <article className="rounded-xl border p-5 space-y-3" key={entry.id}>
              <div className="flex justify-between gap-2">
                <h3 className="font-semibold">{entry.date}</h3>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => open(entry)}
                >
                  일지 열기
                </Button>
              </div>
              {(
                [
                  { key: 'done', label: '오늘 한 일' },
                  { key: 'problem', label: '생긴 문제' },
                  { key: 'next', label: '다음에 할 일' },
                ] as const
              ).map((field) => (
                <div key={field.key}>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {field.label}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {entry[field.key] || '기록 없음'}
                  </p>
                </div>
              ))}
            </article>
          ))}
      </section>
    </main>
  );
}
