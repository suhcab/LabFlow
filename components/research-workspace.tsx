'use client';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SubmitEvent,
} from 'react';
import { Archive, Download, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { ReferenceLibrary } from '@/components/reference-library';
import { ImageWorkspace } from '@/components/image-workspace';
import { ReproducibilityWorkbench } from '@/components/reproducibility-workbench';
import type { ReproductionState } from '@/lib/reproducibility';
import type { ImageAnalysisRecord } from '@/lib/image-analysis';
import { appendCitation, type Reference } from '@/lib/references';
import { databaseError, type Project } from '@/lib/project';
import {
  compareDatasets,
  csvColumn,
  datasetCsv,
  downloadText,
  emptyDesign,
  formatNumber,
  parseCsv,
  parseValues,
  reviewResearch,
  statistics,
  type Dataset,
  type ProtocolRecord,
  type ResearchDesign,
} from '@/lib/research';

export type ResearchView =
  | 'overview'
  | 'analysis'
  | 'comparison'
  | 'references'
  | 'images'
  | 'reproducibility';
type Props = {
  project: Project;
  view: ResearchView;
  onDirtyChange: (dirty: boolean) => void;
  onProjectChange: (project: Project) => void;
  onNavigate: (view: ResearchView | 'protocol' | 'schedule') => void;
};
const today = () => new Intl.DateTimeFormat('sv-SE').format(new Date());
const designFields: {
  key: Exclude<
    keyof ResearchDesign,
    'research_type' | 'image_analyses' | 'reproduction'
  >;
  label: string;
  hint: string;
}[] = [
  { key: 'question', label: '연구 질문', hint: '무엇을 확인하고 싶은가요?' },
  {
    key: 'hypothesis',
    label: '가설·예상 결과',
    hint: '예상하는 관계와 근거 또는 탐색 연구임을 기록하세요.',
  },
  {
    key: 'independent_variable',
    label: '조작·관찰 변수',
    hint: '예: 진자 길이(m), 학습률, 로봇 지형 조건',
  },
  {
    key: 'dependent_variable',
    label: '결과 측정량',
    hint: '예: 주기(s), 에피소드 보상, 보행 성공률(1)',
  },
  {
    key: 'controls',
    label: '통제 조건',
    hint: '반복 수행 동안 유지하는 조건과 수치·단위',
  },
  {
    key: 'environment',
    label: '실험·실행 환경',
    hint: '온도·장소 또는 OS, Python, 시뮬레이터·라이브러리 버전',
  },
  {
    key: 'code_version',
    label: '코드·모델 버전',
    hint: '저장소 URL, Git 커밋, 설정 파일, 모델 체크포인트',
  },
  {
    key: 'random_seed',
    label: '난수 시드·결정성 설정',
    hint: '예: seed 42, 43, 44. 실행별 시드는 데이터셋 수행 조건에도 기록',
  },
  {
    key: 'data_source',
    label: '원자료·참고 자료 출처',
    hint: '파일 경로·데이터셋 URL·참고 문헌. 앱에 올리지 않은 원자료 위치도 기록',
  },
  {
    key: 'analysis_plan',
    label: '분석·제외·판단 기준',
    hint: '비교할 지표, 제외 기준, 반복 횟수와 가설 판단 방법',
  },
  {
    key: 'calibration',
    label: '장비 교정·영점 확인',
    hint: '장비명, 분해능, 교정 날짜·방법. 해당하지 않으면 이유 기록',
  },
];

export function ResearchWorkspace({
  project,
  view,
  onDirtyChange,
  onProjectChange,
  onNavigate,
}: Props) {
  const [design, setDesign] = useState<ResearchDesign>({ ...emptyDesign });
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [protocol, setProtocol] = useState<ProtocolRecord>({
    purpose: '',
    steps: [],
  });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState('new');
  const [showArchived, setShowArchived] = useState(false);
  const markDirty = useCallback(
    (value: boolean) => {
      setDirty(value);
      if (value) setNotice('');
      onDirtyChange(value);
    },
    [onDirtyChange],
  );
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setReady(false);
      setNotice('');
      const results = await Promise.all([
        supabase
          .from('research_designs')
          .select('design')
          .eq('project_id', project.id)
          .maybeSingle(),
        supabase
          .from('research_datasets')
          .select('*')
          .eq('project_id', project.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('protocols')
          .select('purpose,steps')
          .eq('project_id', project.id)
          .maybeSingle(),
      ]);
      if (!active) return;
      const error = results.find((result) => result.error)?.error;
      if (error)
        setNotice(
          error.code === 'PGRST205' || error.code === '42P01'
            ? '연구 도구 DB 준비가 필요합니다. 관리자에게 research_tools 마이그레이션 적용을 요청해 주세요.'
            : databaseError(error),
        );
      else {
        setDesign({ ...emptyDesign, ...results[0].data?.design });
        setDatasets((results[1].data ?? []) as Dataset[]);
        setProtocol(
          (results[2].data ?? { purpose: '', steps: [] }) as ProtocolRecord,
        );
        setReady(true);
        markDirty(false);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [project.id, revision, markDirty]);

  async function saveDesign(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice('');
    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const progress = Number(text('progress'));
    const title = text('title');
    const topic = text('topic');
    const start = text('start_date');
    const due = text('due_date');
    if (
      !title ||
      !topic ||
      !Number.isInteger(progress) ||
      progress < 0 ||
      progress > 100 ||
      (start && due && start > due)
    ) {
      setNotice('프로젝트명·주제·진행률(0~100)과 날짜 순서를 확인해 주세요.');
      setSaving(false);
      return;
    }
    const { data, error } = await supabase
      .from('projects')
      .update({
        title,
        topic,
        status: text('status'),
        progress,
        start_date: start || null,
        due_date: due || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id)
      .select()
      .single();
    if (error) {
      setNotice(databaseError(error));
      setSaving(false);
      return;
    }
    onProjectChange(data as Project);
    const saved = await supabase.from('research_designs').upsert({
      project_id: project.id,
      design,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (saved.error) {
      setNotice(
        `프로젝트 기본 정보는 저장됐지만 연구 설계는 저장되지 않았습니다. 다시 저장해 주세요. ${databaseError(saved.error)}`,
      );
      return;
    }
    markDirty(false);
    setNotice('연구 현황과 설계를 저장했습니다.');
  }
  async function saveReproduction(reproduction: ReproductionState) {
    if (saving) return false;
    setSaving(true);
    setNotice('');
    const next = { ...design, reproduction };
    try {
      const result = await supabase
        .from('research_designs')
        .upsert({
          project_id: project.id,
          design: next,
          updated_at: new Date().toISOString(),
        });
      if (result.error) {
        setNotice(databaseError(result.error));
        return false;
      }
      setDesign(next);
      markDirty(false);
      setNotice('재현성 검토 계획·이력을 저장했습니다.');
      return true;
    } catch {
      setNotice(
        '재현성 검토를 저장하지 못했습니다. 연결을 확인하고 다시 시도하세요.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function saveImageAnalysis(record: ImageAnalysisRecord) {
    if (saving || (design.image_analyses?.length ?? 0) >= 30) return false;
    setSaving(true);
    setNotice('');
    const next = {
      ...design,
      image_analyses: [record, ...(design.image_analyses ?? [])],
    };
    try {
      const result = await supabase.from('research_designs').upsert({
        project_id: project.id,
        design: next,
        updated_at: new Date().toISOString(),
      });
      if (result.error) {
        setNotice(databaseError(result.error));
        return false;
      }
      setDesign(next);
      markDirty(false);
      setNotice(
        '사진 분석 수치·좌표·측정 조건을 저장했습니다. 원본 사진은 기기에 별도로 보관하세요.',
      );
      return true;
    } catch {
      setNotice(
        '사진 분석을 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function addReference(ref: Reference) {
    if (saving || dirty) return;
    setSaving(true);
    setNotice('');
    const next = {
      ...design,
      data_source: appendCitation(design.data_source, ref),
    };
    try {
      const result = await supabase.from('research_designs').upsert({
        project_id: project.id,
        design: next,
        updated_at: new Date().toISOString(),
      });
      if (result.error) setNotice(databaseError(result.error));
      else {
        setDesign(next);
        setNotice(
          '참고문헌을 프로젝트에 저장했습니다. 연구 현황과 보고서에도 포함됩니다.',
        );
      }
    } catch {
      setNotice(
        '참고문헌을 저장하지 못했습니다. 연결을 확인하고 다시 시도하세요.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveDataset(dataset: Dataset) {
    setSaving(true);
    setNotice('');
    const { data, error } = await supabase
      .from('research_datasets')
      .upsert({ ...dataset, updated_at: new Date().toISOString() })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setNotice(databaseError(error));
      return false;
    }
    const saved = data as Dataset;
    setDatasets((current) => [
      saved,
      ...current.filter((item) => item.id !== saved.id),
    ]);
    setSelectedId(saved.id);
    markDirty(false);
    setNotice('데이터셋과 측정 당시 프로토콜을 저장했습니다.');
    return true;
  }
  async function archiveDataset(dataset: Dataset) {
    if (dirty) {
      setNotice(
        '편집 중인 내용을 저장하거나 변경 취소한 뒤 보관 상태를 바꿔 주세요.',
      );
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('research_datasets')
      .update({
        archived_at: dataset.archived_at ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', dataset.id)
      .eq('project_id', project.id)
      .select()
      .single();
    setSaving(false);
    if (error) setNotice(databaseError(error));
    else {
      setDatasets((current) =>
        current.map((item) =>
          item.id === dataset.id ? (data as Dataset) : item,
        ),
      );
      setSelectedId('new');
      setNotice(
        dataset.archived_at
          ? '데이터셋을 복원했습니다.'
          : '데이터셋을 보관했습니다. 보관함에서 복원할 수 있습니다.',
      );
    }
  }
  const findings = useMemo(
    () => reviewResearch(design, protocol, datasets),
    [design, protocol, datasets],
  );
  const activeDatasets = datasets.filter((dataset) => !dataset.archived_at);
  function exportResearch() {
    const pack = {
      format: 'LabFlow research package v1',
      exported_at: new Date().toISOString(),
      project,
      design,
      protocol,
      datasets,
      review: findings,
      calculation_assumptions:
        '동일 조건의 독립 반복값. s는 표본 표준편차, uA=s/sqrt(n), 분해능 d의 반올림 오차를 균등분포로 가정한 uB=d/sqrt(12), 독립 성분 RSS, U=k*uc. 분해능 외 불확도 미포함. k=2가 항상 95% 신뢰수준을 뜻하지 않음.',
    };
    downloadText(
      `${project.title}_연구기록.json`,
      JSON.stringify(pack, null, 2),
      'application/json;charset=utf-8',
    );
  }
  function exportReport() {
    const text = [
      `# ${project.title}`,
      `작성: ${new Date().toLocaleString('ko-KR')}`,
      `연구 주제: ${project.topic}`,
      '## 연구 설계',
      ...designFields.map(
        (field) => `### ${field.label}\n${design[field.key] || '미기록'}`,
      ),
      '## 실험 프로토콜',
      protocol.purpose,
      ...protocol.steps.map(
        (step, index) =>
          `### ${index + 1}. ${step.title}\n준비물: ${step.materials}\n장비: ${step.equipment}\n조건: ${step.conditions}\n절차·주의: ${step.notes}`,
      ),
      '## 데이터셋 분석',
      ...activeDatasets.map((dataset) => {
        const stats = statistics(
          dataset.values,
          dataset.exclusions,
          dataset.resolution,
          dataset.coverage_factor,
        );
        return `### ${dataset.name}\n측정량: ${dataset.quantity} (${dataset.unit})\n날짜: ${dataset.run_date}\n조건: ${dataset.conditions}\nn=${stats.n}, 평균=${formatNumber(stats.mean)}, 표본 s=${formatNumber(stats.sd)}, uA=${formatNumber(stats.sem)}, 분해능 uB=${formatNumber(stats.typeB)}, uc=${formatNumber(stats.combined)}, U=${formatNumber(stats.expanded)} (k=${dataset.coverage_factor})\n제외 사유: ${JSON.stringify(dataset.exclusions)}\n원자료: ${dataset.values.join(', ')}\n메모: ${dataset.notes}`;
      }),
      '## 사진 수치 분석',
      ...(design.image_analyses ?? []).map(
        (record) =>
          `### ${record.title}\n파일: ${record.filename}, ${record.width}×${record.height}px\nSHA-256: ${record.sha256}\n영역 A 평균 밝기: ${record.a.mean.brightness}, 기준 이상 면적: ${record.a.abovePercent}%\n${record.b ? `영역 B 평균 밝기: ${record.b.mean.brightness}, 기준 이상 면적: ${record.b.abovePercent}%` : '영역 B 미지정'}\n측정: ${record.measurement ? `${record.measurement.length ?? record.measurement.pixels} ${record.measurement.unit}` : '미기록'}\n조건: ${record.notes}\n계산 방법: ${record.method}\n사진 원본은 별도로 보관해야 합니다. 전체 수치·좌표는 연구 기록 JSON에 포함됩니다.`,
      ),
      '## 기록 기반 재현성 점검',
      ...(design.reproduction?.runs ?? []).map(
        (run) =>
          `검토일: ${run.createdAt} · ${run.result.verdict}\n${run.result.checks.map((check) => `${check.title}: ${check.state} (${check.evidence})`).join('\n')}\n해석 범위: ${run.limits}`,
      ),
      '이 결과는 기록 누락 점검이며 실제 재실험 성공이나 과학적 타당성을 보장하지 않습니다.',
      ...findings.map(
        (finding) =>
          `- [${finding.passed ? 'x' : ' '}] ${finding.title} (${finding.severity})\n  근거: ${finding.evidence}\n  보완: ${finding.action}`,
      ),
      '## 계산 가정',
      '동일 조건의 독립 반복값에 대해 표본 표준편차와 평균의 표준불확도를 계산했습니다. 분해능 d의 반올림 범위 ±d/2를 균등분포로 가정합니다. 분해능 외 교정·환경·상관 등의 불확도는 이 계산에 자동 포함되지 않습니다. 포함인자 k=2는 항상 95% 신뢰수준을 뜻하지 않습니다.',
      '근거: https://physics.nist.gov/cuu/Uncertainty/typeb.html / https://www.iso.org/sites/JCGM/GUM/JCGM100/C045315e-html/C045315e_FILES/MAIN_C045315e/04_e.html',
    ].join('\n\n');
    downloadText(
      `${project.title}_연구보고서.md`,
      text,
      'text/markdown;charset=utf-8',
    );
  }
  if (loading)
    return <output className="block p-8">연구 기록 불러오는 중…</output>;
  if (!ready)
    return (
      <div className="p-6">
        <output>{notice}</output>
        <Button
          className="ml-3"
          onClick={() => setRevision((value) => value + 1)}
        >
          다시 연결
        </Button>
      </div>
    );
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-5 md:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">
          {
            {
              overview: '연구 현황·설계',
              analysis: '데이터·불확도 분석',
              comparison: '실험 간 비교',
              references: '참고문헌 추천',
              images: '사진 수치 분석',
              reproducibility: '재현성 점검',
            }[view]
          }
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" disabled={dirty} onClick={exportReport}>
            <Download />
            보고서
          </Button>
          <Button variant="outline" disabled={dirty} onClick={exportResearch}>
            원자료·설계 JSON
          </Button>
        </div>
      </div>
      {notice && (
        <output className="block rounded-xl border bg-muted p-4 text-sm">
          {notice}
        </output>
      )}
      {view === 'references' && (
        <ReferenceLibrary
          key={project.id}
          field={project.field}
          context={[
            project.title,
            project.topic,
            design.question,
            design.independent_variable,
            design.dependent_variable,
          ].join(' ')}
          source={design.data_source}
          saving={saving || dirty}
          onAdd={addReference}
        />
      )}
      {view === 'images' && (
        <ImageWorkspace
          key={project.id}
          records={design.image_analyses ?? []}
          dirty={dirty}
          saving={saving}
          onDirty={markDirty}
          onSave={saveImageAnalysis}
        />
      )}
      {view === 'overview' && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['진행률', `${project.progress}%`],
            ['프로토콜', `${protocol.steps.length}단계`],
            ['데이터셋', `${activeDatasets.length}개`],
            [
              '기록 점검',
              `${findings.filter((finding) => finding.passed).length}/${findings.length}`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}
      {view === 'overview' && (
        <form
          key={project.id}
          onSubmit={saveDesign}
          className="space-y-6"
          onInput={() => markDirty(true)}
          onChange={() => markDirty(true)}
        >
          <fieldset
            disabled={saving}
            className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"
          >
            <legend className="px-2 font-semibold">프로젝트 현황</legend>
            <label htmlFor="overview-title" className="grid gap-2 text-sm">
              프로젝트명
              <Input
                id="overview-title"
                name="title"
                defaultValue={project.title}
                required
                maxLength={120}
              />
            </label>
            <label className="grid gap-2 text-sm">
              상태
              <select
                name="status"
                defaultValue={project.status}
                className="h-9 rounded-md border bg-background px-3"
              >
                {['계획 중', '진행 중', '완료'].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label
              htmlFor="overview-topic"
              className="grid gap-2 text-sm sm:col-span-2"
            >
              연구 주제
              <Textarea
                id="overview-topic"
                name="topic"
                defaultValue={project.topic}
                required
              />
            </label>
            <label htmlFor="overview-progress" className="grid gap-2 text-sm">
              진행률 (%)
              <Input
                id="overview-progress"
                name="progress"
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={project.progress}
                required
              />
            </label>
            <div />
            <label htmlFor="overview-start" className="grid gap-2 text-sm">
              시작일
              <Input
                id="overview-start"
                name="start_date"
                type="date"
                defaultValue={project.start_date ?? ''}
              />
            </label>
            <label htmlFor="overview-due" className="grid gap-2 text-sm">
              마감일
              <Input
                id="overview-due"
                name="due_date"
                type="date"
                defaultValue={project.due_date ?? ''}
              />
            </label>
          </fieldset>
          <fieldset
            disabled={saving}
            className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"
          >
            <legend className="px-2 font-semibold">
              다시 수행할 수 있는 연구 설계
            </legend>
            <label className="grid gap-2 text-sm sm:col-span-2">
              연구 방식
              <select
                value={design.research_type}
                onChange={(event) =>
                  setDesign((current) => ({
                    ...current,
                    research_type: event.target
                      .value as ResearchDesign['research_type'],
                  }))
                }
                className="h-9 rounded-md border bg-background px-3"
              >
                <option value="experiment">물리·화학·생명 등 실험</option>
                <option value="simulation">정보·시뮬레이션·모델 학습</option>
                <option value="observational">관찰·조사 연구</option>
              </select>
            </label>
            {designFields.map((field) => (
              <label
                key={field.key}
                htmlFor={`design-${field.key}`}
                className="grid gap-2 text-sm"
              >
                {field.label}
                <Textarea
                  id={`design-${field.key}`}
                  value={design[field.key]}
                  maxLength={10000}
                  placeholder={field.hint}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDesign((current) => ({
                      ...current,
                      [field.key]: value,
                    }));
                  }}
                />
              </label>
            ))}
          </fieldset>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving || !dirty}>
              <Save />
              {saving ? '저장 중…' : '현황·연구 설계 저장'}
            </Button>
            <span className="text-sm text-muted-foreground">
              {dirty ? '저장하지 않은 변경' : '저장된 내용'}
            </span>
          </div>
        </form>
      )}
      {view === 'analysis' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-sm">
              데이터셋
              <select
                aria-label="데이터셋 선택"
                value={selectedId}
                onChange={(event) => {
                  if (dirty) {
                    setNotice(
                      '현재 변경을 저장하거나 변경 취소한 뒤 데이터셋을 바꿔 주세요.',
                    );
                    return;
                  }
                  setSelectedId(event.target.value);
                  setNotice('');
                }}
                className="min-w-0 flex-1 rounded-md border bg-background p-2"
              >
                <option value="new">새 반복 측정 데이터셋</option>
                {activeDatasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name} · {dataset.quantity} ({dataset.unit})
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              disabled={dirty}
              onClick={() => setSelectedId('new')}
            >
              <Plus />새 데이터셋
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowArchived(!showArchived)}
            >
              보관함 ({datasets.length - activeDatasets.length})
            </Button>
          </div>
          {showArchived && (
            <div className="rounded-xl border p-4">
              {datasets
                .filter((dataset) => dataset.archived_at)
                .map((dataset) => (
                  <div
                    key={dataset.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span>{dataset.name}</span>
                    <Button
                      disabled={saving || dirty}
                      variant="outline"
                      onClick={() => void archiveDataset(dataset)}
                    >
                      복원
                    </Button>
                  </div>
                ))}
              {!datasets.some((dataset) => dataset.archived_at) && (
                <p>보관된 데이터셋이 없습니다.</p>
              )}
            </div>
          )}
          <DatasetEditor
            key={selectedId}
            projectId={project.id}
            initial={
              datasets.find((dataset) => dataset.id === selectedId) ?? null
            }
            protocol={protocol}
            saving={saving}
            onDirtyChange={markDirty}
            onSave={saveDataset}
          />
          {selectedId !== 'new' &&
            datasets.find((dataset) => dataset.id === selectedId) && (
              <Button
                disabled={saving || dirty}
                variant="outline"
                onClick={() =>
                  void archiveDataset(
                    datasets.find((dataset) => dataset.id === selectedId)!,
                  )
                }
              >
                <Archive />
                현재 데이터셋 보관 (복원 가능)
              </Button>
            )}
        </>
      )}
      {view === 'comparison' && <DatasetComparison datasets={activeDatasets} />}
      {view === 'reproducibility' && (
        <>
          <ReproducibilityWorkbench
            datasets={activeDatasets}
            findings={findings}
            saved={design.reproduction ?? { plan: null, runs: [] }}
            saving={saving}
            onDirty={markDirty}
            onSave={saveReproduction}
            onNavigate={onNavigate}
          />
          <div className="rounded-xl border bg-primary/5 p-5">
            <p className="text-lg font-semibold">
              기록 준비도{' '}
              {Math.round(
                (findings.filter((finding) => finding.passed).length /
                  findings.length) *
                  100,
              )}
              %
            </p>
            <p className="mt-2 text-sm">
              저장된 기록 {findings.length}개 항목 중{' '}
              {findings.filter((finding) => finding.passed).length}개 확인 ·
              필수 보완{' '}
              {
                findings.filter(
                  (finding) => !finding.passed && finding.severity === '필수',
                ).length
              }
              개
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              규칙 기반 누락 점검입니다. 실제 독립 재실험·코드 실행을 수행하거나
              재현 성공을 판정한 결과가 아닙니다. 입력 내용의 사실성은 연구자가
              확인해야 합니다.
            </p>
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {findings.map((finding) => (
              <section key={finding.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    {finding.passed ? '✓' : '○'} {finding.title}{' '}
                    <span className="text-xs text-muted-foreground">
                      {finding.severity} ·{' '}
                      {finding.passed ? '기록 확인' : '보완 필요'}
                    </span>
                  </h3>
                  {!finding.passed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onNavigate(
                          finding.view === 'design' ? 'overview' : finding.view,
                        )
                      }
                    >
                      기록 보완하기
                    </Button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  근거: {finding.evidence}
                </p>
                {!finding.passed && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {finding.action}
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function DatasetEditor({
  projectId,
  initial,
  protocol,
  saving,
  onDirtyChange,
  onSave,
}: {
  projectId: string;
  initial: Dataset | null;
  protocol: ProtocolRecord;
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (dataset: Dataset) => Promise<boolean>;
}) {
  const create = (): Dataset =>
    initial ?? {
      id: crypto.randomUUID(),
      project_id: projectId,
      name: '',
      quantity: '',
      unit: '',
      values: [],
      exclusions: {},
      resolution: 0,
      coverage_factor: 2,
      conditions: '',
      notes: '',
      run_date: today(),
      protocol_snapshot: structuredClone(protocol),
      archived_at: null,
    };
  const [draft, setDraft] = useState<Dataset>(create);
  const [raw, setRaw] = useState(() => initial?.values.join('\n') ?? '');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [csv, setCsv] = useState<string[][]>([]);
  const [column, setColumn] = useState(0);
  const [header, setHeader] = useState(true);
  const [page, setPage] = useState(0);
  function changed() {
    setDirty(true);
    onDirtyChange(true);
    setNotice('');
  }
  function patch(value: Partial<Dataset>) {
    setDraft((current) => ({ ...current, ...value }));
    changed();
  }
  function rawChanged(value: string) {
    setRaw(value);
    setDraft((current) => ({ ...current, exclusions: {} }));
    setPage(0);
    changed();
  }
  const parsed = useMemo(() => {
    try {
      return { values: parseValues(raw), error: '' };
    } catch (error) {
      return {
        values: [],
        error:
          error instanceof Error ? error.message : '숫자 입력을 확인해 주세요.',
      };
    }
  }, [raw]);
  const stats = useMemo(() => {
    try {
      return statistics(
        parsed.values,
        draft.exclusions,
        draft.resolution,
        draft.coverage_factor,
      );
    } catch {
      return null;
    }
  }, [
    parsed.values,
    draft.exclusions,
    draft.resolution,
    draft.coverage_factor,
  ]);
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (parsed.error || !parsed.values.length || !stats?.n) {
      setNotice(parsed.error || '제외되지 않은 측정값이 하나 이상 필요합니다.');
      return;
    }
    if (
      !draft.name.trim() ||
      !draft.quantity.trim() ||
      !draft.unit.trim() ||
      !draft.run_date
    ) {
      setNotice(
        '이름·측정량·단위·수행 날짜를 입력하세요. 무차원 단위는 1입니다.',
      );
      return;
    }
    if (Object.values(draft.exclusions).some((reason) => !reason.trim())) {
      setNotice('모든 제외값에 제외 사유를 입력해 주세요.');
      return;
    }
    const saved = {
      ...draft,
      name: draft.name.trim(),
      quantity: draft.quantity.trim(),
      unit: draft.unit.trim(),
      values: parsed.values,
    };
    if (await onSave(saved)) {
      setDraft(saved);
      setDirty(false);
      onDirtyChange(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        한 데이터셋에는 같은 조건에서 독립적으로 반복 측정한 값만 넣으세요.
        길이·지형·학습률 등이 다르면 별도 데이터셋으로 저장해 비교합니다.
      </p>
      <fieldset
        disabled={saving}
        className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"
      >
        <label htmlFor="dataset-name" className="grid gap-2 text-sm">
          데이터셋 이름
          <Input
            id="dataset-name"
            required
            maxLength={120}
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="예: 길이 0.5m · 1차 / seed 42 · 평지"
          />
        </label>
        <label htmlFor="dataset-quantity" className="grid gap-2 text-sm">
          측정량
          <Input
            id="dataset-quantity"
            required
            maxLength={120}
            value={draft.quantity}
            onChange={(event) => patch({ quantity: event.target.value })}
            placeholder="주기, 성공률, 보상 등"
          />
        </label>
        <label htmlFor="dataset-unit" className="grid gap-2 text-sm">
          단위
          <Input
            id="dataset-unit"
            required
            maxLength={80}
            value={draft.unit}
            onChange={(event) => patch({ unit: event.target.value })}
            placeholder="s, m, 1 (무차원)"
          />
        </label>
        <label htmlFor="dataset-date" className="grid gap-2 text-sm">
          수행 날짜
          <Input
            id="dataset-date"
            type="date"
            required
            value={draft.run_date}
            onInput={(event) => patch({ run_date: event.currentTarget.value })}
            onChange={(event) => patch({ run_date: event.target.value })}
          />
        </label>
        <label htmlFor="dataset-resolution" className="grid gap-2 text-sm">
          장비 분해능 d (같은 단위, 미기록은 0)
          <Input
            id="dataset-resolution"
            type="number"
            min={0}
            step="any"
            required
            value={draft.resolution}
            onInput={(event) =>
              patch({ resolution: Number(event.currentTarget.value) })
            }
            onChange={(event) =>
              patch({ resolution: Number(event.target.value) })
            }
          />
        </label>
        <label htmlFor="dataset-factor" className="grid gap-2 text-sm">
          포함인자 k
          <Input
            id="dataset-factor"
            type="number"
            min={0.01}
            max={100}
            step="any"
            required
            value={draft.coverage_factor}
            onInput={(event) =>
              patch({ coverage_factor: Number(event.currentTarget.value) })
            }
            onChange={(event) =>
              patch({ coverage_factor: Number(event.target.value) })
            }
          />
        </label>
        <label
          htmlFor="dataset-conditions"
          className="grid gap-2 text-sm sm:col-span-2"
        >
          이번 수행의 조건·시드·변경점
          <Textarea
            id="dataset-conditions"
            value={draft.conditions}
            maxLength={10000}
            onChange={(event) => patch({ conditions: event.target.value })}
            placeholder="길이·진폭·온도 또는 seed·지형·하이퍼파라미터·실행 버전"
          />
        </label>
        <label
          htmlFor="dataset-values"
          className="grid gap-2 text-sm sm:col-span-2"
        >
          반복 측정 원자료
          <Textarea
            id="dataset-values"
            className="min-h-36 font-mono"
            value={raw}
            onChange={(event) => rawChanged(event.target.value)}
            placeholder={'1.42\n1.39\n1.41'}
            aria-describedby="values-help"
          />
        </label>
        <p
          id="values-help"
          className="text-xs text-muted-foreground sm:col-span-2"
        >
          한 줄에 하나 또는 쉼표·공백으로 구분합니다. 소수점은 마침표, 과학적
          표기(1.2e-3)도 지원합니다. 원자료 변경 시 제외 표시는 초기화됩니다.
        </p>
        <label
          htmlFor="dataset-notes"
          className="grid gap-2 text-sm sm:col-span-2"
        >
          실험 관찰·오류·해석 메모
          <Textarea
            id="dataset-notes"
            value={draft.notes}
            maxLength={10000}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </label>
      </fieldset>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">
          CSV / TSV 파일에서 측정 열 가져오기
        </summary>
        <div className="mt-4 space-y-3">
          <label className="grid gap-2 text-sm">
            원자료 파일
            <input
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 2_000_000)
                    throw new Error('파일은 2MB 이하로 가져와 주세요.');
                  const rows = parseCsv(await file.text());
                  if (!rows.length) throw new Error('파일에 자료가 없습니다.');
                  setCsv(rows);
                  setColumn(0);
                  setHeader(true);
                } catch (error) {
                  setNotice(
                    error instanceof Error
                      ? error.message
                      : '파일을 읽지 못했습니다.',
                  );
                }
              }}
            />
          </label>
          {csv.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={header}
                  onChange={(event) => setHeader(event.target.checked)}
                />
                첫 행은 열 이름
              </label>
              <label className="flex items-center gap-2 text-sm">
                측정값 열
                <select
                  value={column}
                  onChange={(event) => setColumn(Number(event.target.value))}
                  className="rounded border bg-background p-2"
                >
                  {csv[0].map((cell, index) => (
                    <option key={index} value={index}>
                      {index + 1}열 {header ? cell : ''}
                    </option>
                  ))}
                </select>
              </label>
              <pre className="max-h-32 overflow-auto rounded bg-muted p-3 text-xs">
                {csv
                  .slice(0, 4)
                  .map((row) => row.join(' | '))
                  .join('\n')}
              </pre>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  try {
                    const values = csvColumn(csv, column, header);
                    rawChanged(values.join('\n'));
                    setCsv([]);
                  } catch (error) {
                    setNotice(
                      error instanceof Error
                        ? error.message
                        : '선택한 열을 확인해 주세요.',
                    );
                  }
                }}
              >
                선택한 열로 원자료 교체
              </Button>
            </>
          )}
        </div>
      </details>
      {(parsed.error || notice) && (
        <output className="block rounded-xl border border-destructive p-4 text-sm">
          {parsed.error || notice}
        </output>
      )}
      {stats && parsed.values.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['유효 반복 / 전체', `${stats.n} / ${stats.total}`],
              ['평균', formatNumber(stats.mean)],
              ['표본 표준편차 s', formatNumber(stats.sd)],
              ['평균 표준불확도 uA', formatNumber(stats.sem)],
              ['분해능 성분 uB', formatNumber(stats.typeB)],
              ['합성 표준불확도 uc', formatNumber(stats.combined)],
              ['확장불확도 U', formatNumber(stats.expanded)],
              ['제외값', String(stats.excluded)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 break-words text-lg font-semibold">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <MeasurementPlot
            values={parsed.values}
            exclusions={draft.exclusions}
            mean={stats.mean}
            unit={draft.unit}
          />
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              원자료·제외 사유 편집 ({parsed.values.length}개)
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              값을 자동 제거하지 않습니다. 제외할 값만 표시하고 이유를 남기세요.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">반복</th>
                    <th className="p-2">원자료</th>
                    <th className="p-2">제외</th>
                    <th className="p-2">제외 사유</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.values
                    .slice(page * 50, page * 50 + 50)
                    .map((value, index) => {
                      const key = String(page * 50 + index);
                      const excluded = Object.hasOwn(draft.exclusions, key);
                      return (
                        <tr key={key} className="border-t">
                          <td className="p-2">{Number(key) + 1}</td>
                          <td className="p-2 font-mono">{value}</td>
                          <td className="p-2">
                            <input
                              type="checkbox"
                              aria-label={`${Number(key) + 1}회 측정값 제외`}
                              checked={excluded}
                              onChange={(event) => {
                                const next = { ...draft.exclusions };
                                if (event.target.checked) next[key] = '';
                                else delete next[key];
                                patch({ exclusions: next });
                              }}
                            />
                          </td>
                          <td className="p-2">
                            {excluded ? (
                              <Input
                                aria-label={`${Number(key) + 1}회 제외 사유`}
                                value={draft.exclusions[key]}
                                onChange={(event) =>
                                  patch({
                                    exclusions: {
                                      ...draft.exclusions,
                                      [key]: event.target.value,
                                    },
                                  })
                                }
                              />
                            ) : (
                              '분석에 포함'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                이전 50개
              </Button>
              <span className="py-2 text-sm">
                {page + 1} / {Math.ceil(parsed.values.length / 50)}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={(page + 1) * 50 >= parsed.values.length}
                onClick={() => setPage(page + 1)}
              >
                다음 50개
              </Button>
            </div>
          </details>
        </>
      )}
      <div className="rounded-xl bg-muted p-4 text-xs leading-6">
        s는 n−1로 나누는 표본 표준편차, uA=s/√n, uB=d/√12, uc=√(uA²+uB²),
        U=k·uc입니다. 동일 조건의 독립 반복값, 분해능 반올림 오차의 균등분포와
        성분 간 독립성을 가정합니다. n&lt;2이면 산포·uA·uc·U는 계산하지
        않습니다. d=0은 분해능 성분을 추가하지 않았다는 뜻이며, 교정·환경 등
        전체 불확도를 평가한 결과가 아닙니다. k=2를 자동으로 95% 신뢰수준이라고
        해석하지 마세요.
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={saving || !dirty} type="submit">
          <Save />
          {saving ? '저장 중…' : '데이터셋 저장'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => {
            setDraft(create());
            setRaw(initial?.values.join('\n') ?? '');
            setDirty(false);
            onDirtyChange(false);
            setNotice('');
            setPage(0);
          }}
        >
          변경 취소
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={dirty || !initial}
          onClick={() => {
            if (initial)
              downloadText(
                `${initial.name}.csv`,
                datasetCsv(initial),
                'text/csv;charset=utf-8',
              );
          }}
        >
          저장된 원자료 CSV
        </Button>
        <span className="text-xs text-muted-foreground">
          {dirty ? '저장하지 않은 변경' : '변경 사항 없음'}
        </span>
      </div>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm">
          측정 당시 프로토콜 스냅샷
        </summary>
        <p className="mt-2 text-sm">
          {draft.protocol_snapshot?.purpose || '목적 없음'} ·{' '}
          {draft.protocol_snapshot?.steps.length ?? 0}단계
        </p>
        <ol className="my-3 list-inside list-decimal text-sm">
          {draft.protocol_snapshot?.steps.map((step) => (
            <li key={step.id}>
              {step.title}: {step.conditions}
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            patch({ protocol_snapshot: structuredClone(protocol) })
          }
        >
          현재 저장된 프로토콜로 연결 변경
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          실제 측정에 사용한 절차가 맞을 때만 변경하세요. 자동으로 과거 기록을
          덮어쓰지 않습니다.
        </p>
      </details>
    </form>
  );
}

function MeasurementPlot({
  values,
  exclusions,
  mean,
  unit,
}: {
  values: number[];
  exclusions: Record<string, string>;
  mean: number | null;
  unit: string;
}) {
  const min = Math.min(...values),
    max = Math.max(...values);
  const span = max - min || 1;
  const stride = Math.max(1, Math.ceil(values.length / 500));
  const points = values
    .map((value, index) => ({
      index,
      value,
      x: 40 + (index / Math.max(1, values.length - 1)) * 720,
      y: 175 - ((value - min) / span) * 130,
    }))
    .filter(
      (point) =>
        point.index % stride === 0 || point.index === values.length - 1,
    );
  return (
    <figure className="rounded-xl border bg-card p-4">
      <figcaption className="mb-2 text-sm font-medium">
        반복 측정값 ({unit || '단위 미입력'}) · 점선은 포함값 평균
      </figcaption>
      <svg
        viewBox="0 0 800 220"
        aria-label={`반복값 ${values.length}개, 평균 ${formatNumber(mean)}. 원자료 표에서 값을 확인할 수 있습니다.`}
        className="w-full"
      >
        <line
          x1="40"
          x2="760"
          y1="180"
          y2="180"
          stroke="currentColor"
          opacity="0.4"
        />
        <line
          x1="40"
          x2="40"
          y1="30"
          y2="180"
          stroke="currentColor"
          opacity="0.4"
        />
        {mean !== null && (
          <line
            x1="40"
            x2="760"
            y1={175 - ((mean - min) / span) * 130}
            y2={175 - ((mean - min) / span) * 130}
            stroke="currentColor"
            strokeDasharray="5 5"
            opacity="0.4"
          />
        )}
        <polyline
          points={points
            .filter((point) => !Object.hasOwn(exclusions, String(point.index)))
            .map((point) => `${point.x},${point.y}`)
            .join(' ')}
          fill="none"
          stroke="currentColor"
          opacity="0.4"
        />
        {points.map((point) => (
          <circle
            key={point.index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={
              Object.hasOwn(exclusions, String(point.index))
                ? '#a1a1aa'
                : '#0e7490'
            }
          >
            <title>
              {point.index + 1}회: {point.value}{' '}
              {Object.hasOwn(exclusions, String(point.index)) ? '(제외)' : ''}
            </title>
          </circle>
        ))}
        <text x="42" y="24" fontSize="12" fill="currentColor">
          {formatNumber(max)}
        </text>
        <text x="42" y="202" fontSize="12" fill="currentColor">
          1회
        </text>
        <text x="720" y="202" fontSize="12" fill="currentColor">
          {values.length}회
        </text>
      </svg>
      {stride > 1 && (
        <p className="text-xs text-muted-foreground">
          그래프는 {stride}개 간격으로 표시합니다. 계산·CSV에는 전체 원자료를
          사용합니다.
        </p>
      )}
    </figure>
  );
}

function DatasetComparison({ datasets }: { datasets: Dataset[] }) {
  const [first, setFirst] = useState(datasets[0]?.id ?? '');
  const [second, setSecond] = useState(datasets[1]?.id ?? '');
  const [tolerance, setTolerance] = useState('');
  const [conditionsConfirmed, setConditionsConfirmed] = useState(false);
  const a = datasets.find((dataset) => dataset.id === first);
  const b = datasets.find((dataset) => dataset.id === second);
  let result: ReturnType<typeof compareDatasets> | null = null;
  let error = '';
  if (a && b) {
    try {
      if (a.id === b.id) throw new Error('서로 다른 데이터셋을 선택하세요.');
      result = compareDatasets(a, b);
    } catch (caught) {
      error =
        caught instanceof Error ? caught.message : '비교할 자료를 확인하세요.';
    }
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        서로 다른 조건·시드·회차의 저장 자료를 비교합니다. 단위와 측정량이
        같아야 하며 단위 자동 변환은 하지 않습니다.
      </p>
      {datasets.length < 2 ? (
        <p className="rounded-xl border p-5">
          데이터·불확도 탭에서 데이터셋을 2개 이상 저장하세요.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: '기준 데이터셋 A', value: first, set: setFirst },
              { label: '비교 데이터셋 B', value: second, set: setSecond },
            ].map((item) => (
              <label key={item.label} className="grid gap-2 text-sm">
                {item.label}
                <select
                  className="rounded-md border bg-background p-3"
                  value={item.value}
                  onChange={(event) => {
                    item.set(event.target.value);
                    setTolerance('');
                    setConditionsConfirmed(false);
                  }}
                >
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.unit})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {error && (
            <output className="block rounded-xl border p-4">{error}</output>
          )}
          {result && a && b && (
            <>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-3">항목</th>
                      <th className="p-3">{a.name}</th>
                      <th className="p-3">{b.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['수행일', a.run_date, b.run_date],
                      ['조건', a.conditions, b.conditions],
                      ['유효 반복', String(result.a.n), String(result.b.n)],
                      [
                        '평균',
                        formatNumber(result.a.mean),
                        formatNumber(result.b.mean),
                      ],
                      [
                        '표본 표준편차',
                        formatNumber(result.a.sd),
                        formatNumber(result.b.sd),
                      ],
                      [
                        '확장불확도',
                        `${formatNumber(result.a.expanded)} (k=${a.coverage_factor})`,
                        `${formatNumber(result.b.expanded)} (k=${b.coverage_factor})`,
                      ],
                    ].map(([label, av, bv]) => (
                      <tr key={label} className="border-t">
                        <th className="p-3 font-medium">{label}</th>
                        <td className="max-w-sm whitespace-pre-wrap p-3">
                          {av}
                        </td>
                        <td className="max-w-sm whitespace-pre-wrap p-3">
                          {bv}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-xl border bg-muted p-5">
                <p>
                  평균 차이 B−A:{' '}
                  <strong>
                    {formatNumber(result.difference)} {a.unit}
                  </strong>
                </p>
                <p className="mt-2">
                  A 평균 절댓값 대비 변화율:{' '}
                  {formatNumber(result.relativePercent)}%
                </p>
                <p className="mt-2">
                  독립을 가정한 차이의 표준불확도:{' '}
                  {formatNumber(result.differenceUncertainty)} {a.unit}
                </p>
              </div>
              <section className="space-y-3 rounded-xl border p-5">
                <h3 className="font-semibold">
                  연구자가 정한 평균차 허용 기준
                </h3>
                <label
                  htmlFor="comparison-tolerance"
                  className="grid gap-2 text-sm"
                >
                  허용할 평균 차이의 절댓값 ({a.unit})
                  <Input
                    id="comparison-tolerance"
                    type="number"
                    min={0}
                    step="any"
                    value={tolerance}
                    onInput={(event) => setTolerance(event.currentTarget.value)}
                    onChange={(event) => setTolerance(event.target.value)}
                    placeholder="연구 계획에서 정한 허용차"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={conditionsConfirmed}
                    onChange={(event) =>
                      setConditionsConfirmed(event.target.checked)
                    }
                  />
                  의도한 비교 조건·측정량·단위가 맞는지 확인했습니다.
                </label>
                {conditionsConfirmed &&
                  tolerance.trim() !== '' &&
                  Number.isFinite(Number(tolerance)) &&
                  Number(tolerance) >= 0 && (
                    <output className="block rounded bg-muted p-4">
                      입력한 평균차 허용 기준:{' '}
                      {Math.abs(result.difference) <= Number(tolerance)
                        ? '충족'
                        : '초과'}{' '}
                      · |B−A|={formatNumber(Math.abs(result.difference))}{' '}
                      {a.unit}, 허용차={tolerance} {a.unit}. 이 판정은 선택한
                      평균차 기준에 한정되며 전체 재현성이나 통계적 유의성
                      판정이 아닙니다.
                    </output>
                  )}
                <Button
                  variant="outline"
                  disabled={
                    !conditionsConfirmed ||
                    tolerance.trim() === '' ||
                    !Number.isFinite(Number(tolerance)) ||
                    Number(tolerance) < 0
                  }
                  onClick={() => {
                    if (!result) return;
                    downloadText(
                      `${a.name}_${b.name}_비교.json`,
                      JSON.stringify(
                        {
                          exported_at: new Date().toISOString(),
                          datasets: [a, b],
                          comparison: result,
                          mean_difference_tolerance: Number(tolerance),
                          mean_difference_criterion_met:
                            Math.abs(result.difference) <= Number(tolerance),
                          scope:
                            '연구자가 정한 평균차 기준만 평가. 전체 재현성·유의성 판정 아님.',
                        },
                        null,
                        2,
                      ),
                      'application/json;charset=utf-8',
                    );
                  }}
                >
                  비교 근거·판정 JSON 저장
                </Button>
              </section>
              <p className="text-sm text-muted-foreground">
                차이만으로 재현 성공·실패나 통계적 유의성을 판정하지 않습니다.
                비교하는 연구 조건과 독립성·상관, 표본 수, 별도의 판단 기준을
                확인하세요.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
