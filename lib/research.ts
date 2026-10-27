import type { ImageAnalysisRecord } from './image-analysis';

export type ProtocolStep = {
  id: string;
  title: string;
  materials: string;
  equipment: string;
  conditions: string;
  notes: string;
};
export type ProtocolRecord = { purpose: string; steps: ProtocolStep[] };
export type ResearchDesign = {
  image_analyses?: ImageAnalysisRecord[];
  research_type: 'experiment' | 'simulation' | 'observational';
  question: string;
  hypothesis: string;
  independent_variable: string;
  dependent_variable: string;
  controls: string;
  environment: string;
  code_version: string;
  random_seed: string;
  data_source: string;
  analysis_plan: string;
  calibration: string;
};
export const emptyDesign: ResearchDesign = {
  research_type: 'experiment',
  question: '',
  hypothesis: '',
  independent_variable: '',
  dependent_variable: '',
  controls: '',
  environment: '',
  code_version: '',
  random_seed: '',
  data_source: '',
  analysis_plan: '',
  calibration: '',
};
export type Dataset = {
  id: string;
  project_id: string;
  name: string;
  quantity: string;
  unit: string;
  values: number[];
  exclusions: Record<string, string>;
  resolution: number;
  coverage_factor: number;
  conditions: string;
  notes: string;
  run_date: string;
  protocol_snapshot: ProtocolRecord | null;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export function parseValues(raw: string): number[] {
  if (!raw.trim()) return [];
  const tokens = raw.trim().split(/[\s,;]+/);
  if (tokens.length > 10000)
    throw new Error('한 데이터셋에는 최대 10,000개 값을 입력할 수 있습니다.');
  return tokens.map((token, index) => {
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token))
      throw new Error(`${index + 1}번째 값 “${token}”은 숫자가 아닙니다.`);
    const value = Number(token);
    if (!Number.isFinite(value) || Math.abs(value) > 1e100)
      throw new Error(`${index + 1}번째 값이 계산 가능한 범위를 벗어났습니다.`);
    return value;
  });
}

export function statistics(
  values: number[],
  exclusions: Record<string, string> = {},
  resolution = 0,
  k = 2,
) {
  if (
    !Number.isFinite(resolution) ||
    resolution < 0 ||
    !Number.isFinite(k) ||
    k <= 0
  )
    throw new Error('분해능과 포함인자를 확인해 주세요.');
  if (
    values.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e100)
  )
    throw new Error('유효한 유한 숫자만 계산할 수 있습니다.');
  const included = values.filter(
    (_value, index) => !Object.hasOwn(exclusions, String(index)),
  );
  let mean = 0;
  let m2 = 0;
  included.forEach((value, index) => {
    const delta = value - mean;
    mean += delta / (index + 1);
    m2 += delta * (value - mean);
  });
  const n = included.length;
  const sd = n > 1 ? Math.sqrt(Math.max(0, m2 / (n - 1))) : null;
  const sem = sd === null ? null : sd / Math.sqrt(n);
  const typeB = resolution / Math.sqrt(12);
  const combined = sem === null ? null : Math.hypot(sem, typeB);
  return {
    n,
    total: values.length,
    excluded: values.length - n,
    mean: n ? mean : null,
    sd,
    sem,
    typeB,
    combined,
    expanded: combined === null ? null : combined * k,
    min: n ? Math.min(...included) : null,
    max: n ? Math.max(...included) : null,
  };
}

export function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '계산 불가';
  if (value === 0) return '0';
  return Number(value.toPrecision(6)).toString();
}

export function compareDatasets(first: Dataset, second: Dataset) {
  if (
    !first.quantity.trim() ||
    first.quantity.trim() !== second.quantity.trim() ||
    first.unit.trim() !== second.unit.trim()
  )
    throw new Error(
      '측정량과 단위가 정확히 같은 데이터셋만 비교할 수 있습니다. 단위는 자동 변환하지 않습니다.',
    );
  const a = statistics(
    first.values,
    first.exclusions,
    first.resolution,
    first.coverage_factor,
  );
  const b = statistics(
    second.values,
    second.exclusions,
    second.resolution,
    second.coverage_factor,
  );
  if (a.mean === null || b.mean === null)
    throw new Error('두 데이터셋 모두 제외되지 않은 측정값이 필요합니다.');
  const difference = b.mean - a.mean;
  return {
    a,
    b,
    difference,
    relativePercent:
      a.mean === 0 ? null : (difference / Math.abs(a.mean)) * 100,
    differenceUncertainty:
      a.combined === null || b.combined === null
        ? null
        : Math.hypot(a.combined, b.combined),
  };
}

// Canonical form ignores JSON object key order but preserves the recorded step order.
export function protocolSignature(protocol: ProtocolRecord | null): string {
  if (!protocol) return '';
  return JSON.stringify([
    protocol.purpose,
    protocol.steps.map((step) => [
      step.id,
      step.title,
      step.materials,
      step.equipment,
      step.conditions,
      step.notes,
    ]),
  ]);
}

export type Finding = {
  id: string;
  title: string;
  passed: boolean;
  severity: '필수' | '권장';
  evidence: string;
  action: string;
  view: 'design' | 'protocol' | 'analysis';
};
export function reviewResearch(
  design: ResearchDesign,
  protocol: ProtocolRecord,
  datasets: Dataset[],
): Finding[] {
  const active = datasets.filter((dataset) => !dataset.archived_at);
  const steps = protocol.steps;
  const checks: Finding[] = [];
  const add = (
    id: string,
    title: string,
    passed: boolean,
    severity: Finding['severity'],
    evidence: string,
    action: string,
    view: Finding['view'],
  ) => checks.push({ id, title, passed, severity, evidence, action, view });
  add(
    'question',
    '연구 질문',
    !!design.question.trim(),
    '필수',
    design.question || '미기록',
    '누가 다시 수행하더라도 같은 질문을 검증할 수 있게 연구 질문을 작성하세요.',
    'design',
  );
  add(
    'variables',
    '조작·관찰 변수와 측정량',
    !!design.independent_variable.trim() && !!design.dependent_variable.trim(),
    '필수',
    `조작·관찰: ${design.independent_variable || '없음'} / 측정: ${design.dependent_variable || '없음'}`,
    '바꾸거나 관찰할 변수와 결과로 측정할 변수를 구분하세요.',
    'design',
  );
  add(
    'controls',
    '통제 조건',
    !!design.controls.trim(),
    '필수',
    design.controls || '미기록',
    '유지할 조건과 가능한 경우 수치·단위를 기록하세요.',
    'design',
  );
  add(
    'environment',
    '실행·실험 환경',
    !!design.environment.trim(),
    '필수',
    design.environment || '미기록',
    '장소·온도 또는 OS·라이브러리·시뮬레이터 버전을 기록하세요.',
    'design',
  );
  add(
    'purpose',
    '실험 목적과 절차',
    !!protocol.purpose.trim() && steps.length > 0,
    '필수',
    `목적 ${protocol.purpose ? '있음' : '없음'}, ${steps.length}단계`,
    '실험 목적과 실행할 단계를 프로토콜에 작성하세요.',
    'protocol',
  );
  const incomplete = steps.filter(
    (step) =>
      !step.title.trim() || !step.conditions.trim() || !step.equipment.trim(),
  );
  add(
    'steps',
    '단계별 조건·장비',
    steps.length > 0 && incomplete.length === 0,
    '필수',
    incomplete.length
      ? `보완할 단계: ${incomplete.map((step) => step.title || '제목 없음').join(', ')}`
      : steps.length
        ? `${steps.length}단계의 제목·조건·장비 기록`
        : '작성된 단계가 없습니다.',
    '각 단계의 장비 또는 도구와 실행 조건을 채우세요.',
    'protocol',
  );
  add(
    'quantitative',
    '수치 조건',
    steps.some((step) => /\d/.test(step.conditions)),
    '권장',
    '단계별 조건에 수치가 포함되어 있는지 확인한 항목입니다.',
    '가능한 조건을 수치와 단위로 구체화하세요. 해당하지 않으면 연구 설계에 이유를 적으세요.',
    'protocol',
  );
  add(
    'data',
    '원자료와 측정 단위',
    active.length > 0 &&
      active.every(
        (dataset) =>
          dataset.values.length > 0 &&
          dataset.quantity.trim() &&
          dataset.unit.trim(),
      ),
    '필수',
    `저장된 데이터셋 ${active.length}개`,
    '측정량·단위와 원자료를 저장하세요. 무차원 값은 단위를 1로 기록하세요.',
    'analysis',
  );
  add(
    'repeat',
    '반복값과 산포 추정',
    active.length > 0 &&
      active.every(
        (dataset) => statistics(dataset.values, dataset.exclusions).n >= 3,
      ),
    '권장',
    active
      .map(
        (dataset) =>
          `${dataset.name}: 유효 ${statistics(dataset.values, dataset.exclusions).n}회`,
      )
      .join(' / ') || '반복 자료 없음',
    '독립적인 반복 측정을 늘리고 충분한 반복이 어려운 이유도 기록하세요. 3회는 충분성 보장 기준이 아닙니다.',
    'analysis',
  );
  add(
    'runconditions',
    '데이터셋별 수행 조건',
    active.length > 0 &&
      active.every((dataset) => dataset.conditions.trim() && dataset.run_date),
    '필수',
    active
      .map((dataset) => `${dataset.name}: ${dataset.conditions || '조건 없음'}`)
      .join(' / ') || '자료 없음',
    '반복값들이 같은 조건에서 얻어졌는지 확인하고 수행 날짜와 조건을 남기세요.',
    'analysis',
  );
  add(
    'exclusions',
    '제외값의 근거',
    active.every((dataset) =>
      Object.values(dataset.exclusions).every((reason) => reason.trim()),
    ),
    '필수',
    `제외 원자료 ${active.reduce((sum, dataset) => sum + Object.keys(dataset.exclusions).length, 0)}개`,
    '값을 임의로 삭제하지 말고 제외한 이유를 기록하세요.',
    'analysis',
  );
  add(
    'snapshot',
    '측정 당시 프로토콜',
    active.length > 0 &&
      active.every(
        (dataset) =>
          dataset.protocol_snapshot &&
          protocolSignature(dataset.protocol_snapshot) ===
            protocolSignature(protocol),
      ),
    '권장',
    active
      .filter(
        (dataset) =>
          !dataset.protocol_snapshot ||
          protocolSignature(dataset.protocol_snapshot) !==
            protocolSignature(protocol),
      )
      .map((dataset) => dataset.name)
      .join(', ') ||
      (active.length
        ? '현재 프로토콜과 연결 기록이 일치합니다.'
        : '연결된 데이터셋이 없습니다.'),
    '변경된 프로토콜과 측정 당시 스냅샷을 비교하세요. 이전 자료의 조건을 임의로 새 조건으로 바꾸지 마세요.',
    'analysis',
  );
  add(
    'analysis',
    '분석·제외 기준',
    !!design.analysis_plan.trim(),
    '권장',
    design.analysis_plan || '미기록',
    '분석 방법, 데이터 제외 기준과 판단 기준을 기록하세요.',
    'design',
  );
  add(
    'source',
    '원자료·참고 자료 출처',
    !!design.data_source.trim(),
    '권장',
    design.data_source || '미기록',
    '원자료 위치, 참고 문헌이나 데이터셋 출처를 기록하세요.',
    'design',
  );
  if (design.research_type === 'simulation') {
    add(
      'version',
      '코드·모델 버전',
      !!design.code_version.trim(),
      '필수',
      design.code_version || '미기록',
      'Git 커밋, 모델·체크포인트와 설정 파일 버전을 남기세요.',
      'design',
    );
    add(
      'seed',
      '난수 시드',
      !!design.random_seed.trim(),
      '필수',
      design.random_seed || '미기록',
      '실행별 난수 시드와 결정성 설정을 남기세요. 난수가 없다면 해당 없음을 이유와 함께 기록하세요.',
      'design',
    );
  } else if (design.research_type === 'experiment') {
    add(
      'calibration',
      '장비·분해능과 교정',
      !!design.calibration.trim() &&
        active.length > 0 &&
        active.every((dataset) => dataset.resolution > 0),
      '권장',
      design.calibration || '교정 기록 없음',
      '장비 분해능과 교정·영점 확인을 기록하세요. 분해능만으로 모든 계통 불확도를 평가할 수는 없습니다.',
      'design',
    );
  }
  return checks;
}

export function parseCsv(text: string): string[][] {
  if (text.length > 2_000_000)
    throw new Error('CSV는 2MB 이하로 가져와 주세요.');
  const source = text.replace(/^\uFEFF/, '');
  const delimiter = source.split(/\r?\n/)[0].includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (quoted || !cell) quoted = !quoted;
      else cell += char;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index++;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았습니다.');
  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  if (rows.length > 10001)
    throw new Error('CSV는 제목행을 포함해 최대 10,001행까지 지원합니다.');
  return rows;
}

export function csvColumn(
  rows: string[][],
  column: number,
  hasHeader: boolean,
): number[] {
  return rows.slice(hasHeader ? 1 : 0).map((row, index) => {
    const raw = row[column]?.trim();
    if (!raw)
      throw new Error(
        `${index + (hasHeader ? 2 : 1)}행의 선택한 열에 값이 없습니다. 빈 행을 임의로 제외하지 않습니다.`,
      );
    const parsed = parseValues(raw);
    if (parsed.length !== 1)
      throw new Error(
        `${index + (hasHeader ? 2 : 1)}행에 숫자 하나가 필요합니다.`,
      );
    return parsed[0];
  });
}

export function csvCell(value: string): string {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function datasetCsv(dataset: Dataset): string {
  const rows = [
    ['반복', '측정량', '단위', '원자료', '분석포함', '제외사유'].join(','),
  ];
  dataset.values.forEach((value, index) =>
    rows.push(
      [
        index + 1,
        csvCell(dataset.quantity),
        csvCell(dataset.unit),
        value,
        Object.hasOwn(dataset.exclusions, String(index)) ? '아니오' : '예',
        csvCell(dataset.exclusions[String(index)] ?? ''),
      ].join(','),
    ),
  );
  return '\uFEFF' + rows.join('\r\n');
}

export function downloadText(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 150);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
