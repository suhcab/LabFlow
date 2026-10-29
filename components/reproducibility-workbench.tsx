'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  downloadText,
  protocolSignature,
  statistics,
  type Dataset,
  type Finding,
} from '@/lib/research';
import {
  assessReproduction,
  type ReproductionEvidence,
  type ReproductionPlan,
  type ReproductionRun,
  type ReproductionState,
} from '@/lib/reproducibility';
const limits =
  '저장된 데이터와 연구자가 확인한 조건에 대한 규칙·수치 검토입니다. 독립 실험·코드를 자동 실행하지 않습니다. 허용차와 반복수는 연구자가 정한 기준이며 통계적 동등성이나 일반적인 재현 성공을 보장하지 않습니다. 계획 저장 시점은 기록하지만 데이터를 보기 전에 정한 사전등록임을 보장하지 않습니다. CV는 표본 s/|평균|×100이며 평균이 0인 측정량에는 적용할 수 없습니다.';
const evidence = (dataset: Dataset): ReproductionEvidence => {
  const stats = statistics(
    dataset.values,
    dataset.exclusions,
    dataset.resolution,
    dataset.coverage_factor,
  );
  return {
    id: dataset.id,
    name: dataset.name,
    quantity: dataset.quantity,
    unit: dataset.unit,
    n: stats.n,
    mean: stats.mean,
    sd: stats.sd,
    conditions: dataset.conditions,
    protocol: dataset.protocol_snapshot?.steps.length
      ? protocolSignature(dataset.protocol_snapshot)
      : '',
    exclusionsValid: Object.values(dataset.exclusions).every(
      (reason) => !!reason.trim(),
    ),
  };
};
function report(run: ReproductionRun) {
  return [
    `# 재현성 검토 보고서`,
    `검토일: ${run.createdAt}`,
    `계획 저장일: ${run.plan.savedAt}`,
    `결과: ${run.result.verdict}`,
    `## 재실험 계획`,
    run.plan.procedure,
    `## 기준별 근거`,
    ...run.result.checks.map(
      (check) =>
        `- ${check.title}: ${check.state}\n  근거: ${check.evidence}\n  다음 조치: ${check.action}`,
    ),
    `## 해석 범위`,
    run.limits,
    `## 저장 당시 자료 스냅샷`,
    `전체 원자료·제외 이유·프로토콜은 함께 내려받은 JSON에 포함됩니다.`,
  ].join('\n\n');
}
export function ReproducibilityWorkbench({
  datasets,
  findings,
  saved,
  saving,
  onDirty,
  onSave,
  onNavigate,
}: {
  datasets: Dataset[];
  findings: Finding[];
  saved: ReproductionState;
  saving: boolean;
  onDirty: (value: boolean) => void;
  onSave: (value: ReproductionState) => Promise<boolean>;
  onNavigate: (view: 'overview' | 'analysis' | 'protocol') => void;
}) {
  const [draft, setDraft] = useState(() => ({
    baselineId: saved.plan?.baselineId ?? datasets[0]?.id ?? '',
    repeatId: saved.plan?.repeatId ?? datasets[1]?.id ?? '',
    tolerance: saved.plan ? String(saved.plan.tolerance) : '',
    minRepeats: String(saved.plan?.minRepeats ?? 3),
    cv:
      saved.plan?.maxCvPercent === null ||
      saved.plan?.maxCvPercent === undefined
        ? ''
        : String(saved.plan.maxCvPercent),
    procedure: saved.plan?.procedure ?? '',
  }));
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [result, setResult] = useState<ReproductionRun | null>(null);
  const patch = (value: Partial<typeof draft>) => {
    setDraft((current) => ({ ...current, ...value }));
    setEdited(true);
    setConfirmed(false);
    setResult(null);
    setMessage('');
    onDirty(true);
  };
  const baseline = datasets.find((item) => item.id === draft.baselineId),
    repeat = datasets.find((item) => item.id === draft.repeatId);
  function plan(): ReproductionPlan {
    if (!baseline || !repeat || baseline.id === repeat.id)
      throw new Error('서로 다른 원본·재실험 데이터셋을 선택하세요.');
    if (
      !draft.tolerance.trim() ||
      !draft.minRepeats.trim() ||
      !draft.procedure.trim()
    )
      throw new Error('평균차 허용차, 최소 반복수와 재실험 계획을 입력하세요.');
    const value = {
      baselineId: draft.baselineId,
      repeatId: draft.repeatId,
      tolerance: Number(draft.tolerance),
      minRepeats: Number(draft.minRepeats),
      maxCvPercent: draft.cv.trim() ? Number(draft.cv) : null,
      procedure: draft.procedure.trim(),
      savedAt: new Date().toISOString(),
    };
    assessReproduction(evidence(baseline), evidence(repeat), value, false);
    return value;
  }
  async function savePlan() {
    try {
      const value = plan();
      if (await onSave({ ...saved, plan: value })) {
        setEdited(false);
        setMessage(
          '검토 계획과 기준을 저장했습니다. 아래에서 조건을 확인한 뒤 검토하세요.',
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '계획을 확인하세요.');
    }
  }
  function evaluate() {
    try {
      if (edited || !saved.plan)
        throw new Error('변경한 계획을 먼저 저장하세요.');
      if (!baseline || !repeat)
        throw new Error(
          '계획의 데이터셋이 보관됐거나 없습니다. 다시 선택하고 계획을 저장하세요.',
        );
      const outcome = assessReproduction(
        evidence(baseline),
        evidence(repeat),
        saved.plan,
        confirmed,
      );
      setResult({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        plan: structuredClone(saved.plan),
        confirmed,
        baseline: structuredClone(baseline),
        repeat: structuredClone(repeat),
        result: outcome,
        limits,
      });
      setMessage('');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '검토할 수 없습니다.',
      );
    }
  }
  const actions = findings
    .filter((item) => !item.passed)
    .sort(
      (a, b) =>
        (a.severity === '필수' ? 0 : 1) - (b.severity === '필수' ? 0 : 1),
    );
  return (
    <section className="space-y-5">
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="text-lg font-semibold">다음에 할 일</h3>
        {actions.length ? (
          actions.slice(0, 4).map((item, index) => (
            <div
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 border-t pt-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {index + 1}. {item.title} · {item.severity}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.action}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onNavigate(item.view === 'design' ? 'overview' : item.view)
                }
              >
                보완하러 이동
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm">
            기록 항목이 채워졌습니다. 독립 재실험 자료를 준비하고 아래 기준으로
            검토하세요.
          </p>
        )}
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="text-lg font-semibold">재실험 계획과 검토 기준</h3>
        <p className="text-sm text-muted-foreground">
          같은 조건으로 별도 수행한 결과를 비교합니다. 허용차를 정한 근거와 반복
          방법을 먼저 기록하세요. 파일을 복제한 것만으로 독립 재실험이 되지는
          않습니다.
        </p>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          {[
            ['baselineId', '원본 데이터셋 A'],
            ['repeatId', '재실험 데이터셋 B'],
          ].map(([key, label]) => (
            <label
              key={key}
              className="grid gap-2 text-sm"
              htmlFor={`repro-${key}`}
            >
              {label}
              <select
                id={`repro-${key}`}
                className="rounded-md border bg-background p-2"
                value={draft[key as 'baselineId' | 'repeatId']}
                onChange={(event) => patch({ [key]: event.target.value })}
              >
                <option value="">선택하세요</option>
                {datasets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.quantity} ({item.unit})
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label htmlFor="repro-tolerance" className="grid gap-2 text-sm">
            평균차 절댓값 허용차 ({baseline?.unit ?? '원본 단위'})
            <Input
              id="repro-tolerance"
              type="number"
              min="0"
              step="any"
              value={draft.tolerance}
              onChange={(event) => patch({ tolerance: event.target.value })}
            />
          </label>
          <label htmlFor="repro-repeats" className="grid gap-2 text-sm">
            각 수행의 최소 유효 반복수
            <Input
              id="repro-repeats"
              type="number"
              min="2"
              max="10000"
              step="1"
              value={draft.minRepeats}
              onChange={(event) => patch({ minRepeats: event.target.value })}
            />
          </label>
          <label htmlFor="repro-cv" className="grid gap-2 text-sm">
            수행별 CV 상한 (%) · 선택
            <Input
              id="repro-cv"
              type="number"
              min="0"
              step="any"
              placeholder="비워 두면 적용하지 않음"
              value={draft.cv}
              onChange={(event) => patch({ cv: event.target.value })}
            />
          </label>
          <label
            htmlFor="repro-procedure"
            className="grid gap-2 text-sm sm:col-span-2"
          >
            재실험 방법·통제 조건·허용차의 근거
            <Textarea
              id="repro-procedure"
              value={draft.procedure}
              onChange={(event) => patch({ procedure: event.target.value })}
              placeholder="누가·언제·어떤 장비와 조건에서 몇 회 재측정할지, 허용차를 왜 정했는지 기록하세요."
            />
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={saving || !baseline}
            onClick={() =>
              patch({
                procedure: `[연구자가 수정·확인할 계획 초안]\n1. 원본 ‘${baseline?.name ?? ''}’의 측정 당시 프로토콜과 장비·교정 상태를 확인한다.\n2. 원본 수행 조건(${baseline?.conditions || '미기록 — 먼저 보완'})을 유지하고 별도 수행에서 ${draft.minRepeats || '지정한'}회 이상 독립 반복 측정한다.\n3. 수행자·날짜·환경·장비와 원자료를 별도 데이터셋으로 기록하고 제외값은 사유를 남긴다.\n4. ${baseline?.quantity ?? '측정량'}을 원본과 동일한 ${baseline?.unit ?? '단위'}로 저장한다.\n5. 평균차 허용차 ${draft.tolerance || '[입력 필요]'} ${baseline?.unit ?? ''}의 근거를 장비 정밀도 또는 연구 목적에 맞춰 작성한다: [근거 입력]\n6. 기준을 초과하거나 조건이 다르면 원인을 조사하고 추가 수행을 계획한다. 실제 독립 수행 여부는 연구자가 확인한다.`,
              })
            }
          >
            재실험 계획 초안 만들기
          </Button>
          <Button disabled={saving} onClick={() => void savePlan()}>
            계획·기준 저장
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              if (saved.plan) {
                setDraft({
                  baselineId: saved.plan.baselineId,
                  repeatId: saved.plan.repeatId,
                  tolerance: String(saved.plan.tolerance),
                  minRepeats: String(saved.plan.minRepeats),
                  cv:
                    saved.plan.maxCvPercent === null
                      ? ''
                      : String(saved.plan.maxCvPercent),
                  procedure: saved.plan.procedure,
                });
              } else {
                setDraft({
                  baselineId: datasets[0]?.id ?? '',
                  repeatId: datasets[1]?.id ?? '',
                  tolerance: '',
                  minRepeats: '3',
                  cv: '',
                  procedure: '',
                });
              }
              setEdited(false);
              setConfirmed(false);
              setResult(null);
              onDirty(false);
              setMessage('편집 내용을 취소했습니다.');
            }}
          >
            계획 편집 취소
          </Button>
        </div>
        {saved.plan && (
          <p className="text-xs text-muted-foreground">
            마지막 계획 저장:{' '}
            {new Date(saved.plan.savedAt).toLocaleString('ko-KR')} · 사전등록을
            보장하는 시점 증명은 아닙니다.
          </p>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => {
              setConfirmed(event.target.checked);
              setResult(null);
            }}
          />
          별도의 독립 재실험이며 수행 조건·장비·환경이 비교 가능함을
          확인했습니다.
        </label>
        <Button
          variant="outline"
          disabled={saving || edited || !saved.plan}
          onClick={evaluate}
        >
          저장 기준으로 재현성 검토
        </Button>
        <output className="block text-sm" aria-live="polite">
          {message}
        </output>
      </div>
      {result && (
        <div className="rounded-xl border bg-primary/5 p-5 space-y-3">
          <h3 className="text-lg font-semibold">{result.result.verdict}</h3>
          {result.result.checks.map((check) => (
            <div key={check.title} className="border-t pt-3 text-sm">
              <p className="font-medium">
                {check.title} · {check.state}
              </p>
              <p className="mt-1 break-words">{check.evidence}</p>
              {check.state !== '충족' && (
                <p className="mt-1 text-muted-foreground">
                  다음 조치: {check.action}
                </p>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                saving ||
                saved.runs.length >= 30 ||
                saved.runs.some((run) => run.id === result.id)
              }
              onClick={async () => {
                if (await onSave({ ...saved, runs: [result, ...saved.runs] }))
                  setMessage('검토 당시 원자료·계획·판정 근거를 저장했습니다.');
              }}
            >
              검토 이력 저장
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadText(
                  '재현성검토.md',
                  report(result),
                  'text/markdown;charset=utf-8',
                )
              }
            >
              검토 보고서
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadText(
                  '재현성검토.json',
                  JSON.stringify(result, null, 2),
                  'application/json;charset=utf-8',
                )
              }
            >
              검토 원자료 JSON
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{limits}</p>
      <div className="space-y-3">
        <h3 className="font-semibold">
          저장한 검토 이력 ({saved.runs.length}/30)
        </h3>
        {saved.runs.map((run) => (
          <details key={run.id} className="rounded-xl border p-4">
            <summary className="cursor-pointer text-sm">
              {new Date(run.createdAt).toLocaleString('ko-KR')} ·{' '}
              {run.result.verdict}
            </summary>
            <p className="my-3 text-sm">
              저장 당시 자료의 판정입니다. 이후 데이터가 바뀌면 새 검토를
              실행하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  downloadText(
                    '재현성검토.md',
                    report(run),
                    'text/markdown;charset=utf-8',
                  )
                }
              >
                이력 보고서
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadText(
                    '재현성검토.json',
                    JSON.stringify(run, null, 2),
                    'application/json;charset=utf-8',
                  )
                }
              >
                이력 JSON
              </Button>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
