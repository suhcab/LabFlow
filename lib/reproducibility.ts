export type ReproductionPlan = {
  baselineId: string;
  repeatId: string;
  tolerance: number;
  minRepeats: number;
  maxCvPercent: number | null;
  procedure: string;
  savedAt: string;
};
export type ReproductionEvidence = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  n: number;
  mean: number | null;
  sd: number | null;
  conditions: string;
  protocol: string;
  exclusionsValid: boolean;
};
export type ReproductionCheck = {
  title: string;
  state: '충족' | '초과' | '미확인';
  evidence: string;
  action: string;
};
export function assessReproduction(
  a: ReproductionEvidence,
  b: ReproductionEvidence,
  plan: ReproductionPlan,
  confirmed: boolean,
) {
  if (
    !Number.isFinite(plan.tolerance) ||
    plan.tolerance < 0 ||
    !Number.isInteger(plan.minRepeats) ||
    plan.minRepeats < 2 ||
    plan.minRepeats > 10000 ||
    (plan.maxCvPercent !== null &&
      (!Number.isFinite(plan.maxCvPercent) || plan.maxCvPercent < 0))
  )
    throw new Error(
      '허용차는 0 이상, 최소 반복수는 2~10000의 정수, CV 한도는 0 이상의 숫자여야 합니다.',
    );
  const checks: ReproductionCheck[] = [];
  const add = (
    title: string,
    passed: boolean,
    evidence: string,
    action: string,
    missing = false,
  ) =>
    checks.push({
      title,
      state: passed ? '충족' : missing ? '미확인' : '초과',
      evidence,
      action,
    });
  add(
    '서로 다른 원본·재실험 자료',
    a.id !== b.id,
    `${a.name} / ${b.name}`,
    '독립적으로 새로 수행한 결과를 별도 데이터셋으로 저장하세요.',
    true,
  );
  add(
    '측정량·단위 일치',
    !!a.quantity.trim() &&
      !!a.unit.trim() &&
      a.quantity.trim() === b.quantity.trim() &&
      a.unit.trim() === b.unit.trim(),
    `${a.quantity} (${a.unit}) / ${b.quantity} (${b.unit})`,
    '측정량과 단위를 통일하세요. 자동 단위 변환은 하지 않습니다.',
    true,
  );
  add(
    '독립 재실험·비교 조건 확인',
    confirmed && !!a.conditions.trim() && !!b.conditions.trim(),
    `연구자 확인: ${confirmed ? '예' : '아니오'}; A 조건: ${a.conditions || '없음'}; B 조건: ${b.conditions || '없음'}`,
    '별도의 재실험인지, 조건·장비·환경이 비교 가능한지 연구자가 확인하세요.',
    true,
  );
  add(
    '측정 당시 프로토콜 일치',
    !!a.protocol && !!b.protocol && a.protocol === b.protocol,
    a.protocol && b.protocol
      ? a.protocol === b.protocol
        ? '두 측정 당시 절차 기록이 일치'
        : '두 측정 당시 절차 기록이 다름'
      : '측정 당시 절차 기록 없음',
    '프로토콜 스냅샷을 확인하세요. 조건을 바꾼 연구는 동일 조건 재실험과 구분하세요.',
    true,
  );
  add(
    '원자료 제외 이유',
    a.exclusionsValid && b.exclusionsValid,
    '제외값의 사유 기록 점검',
    '제외한 원자료마다 사유를 작성하고 저장하세요.',
    true,
  );
  add(
    '최소 유효 반복수',
    a.n >= plan.minRepeats && b.n >= plan.minRepeats,
    `A=${a.n}, B=${b.n}, 기준 각 ${plan.minRepeats}회 이상`,
    '각 수행의 독립 반복 측정을 늘리세요. 설정한 횟수는 충분성을 보장하지 않습니다.',
    true,
  );
  const available =
    a.mean !== null &&
    b.mean !== null &&
    Number.isFinite(a.mean) &&
    Number.isFinite(b.mean);
  const difference = available ? b.mean! - a.mean! : null;
  add(
    '평균차 허용 기준',
    difference !== null && Math.abs(difference) <= plan.tolerance,
    `B−A=${difference ?? '계산 불가'} ${a.unit}; |B−A| ≤ ${plan.tolerance} ${a.unit}`,
    '측정 조건·장비 교정·제외 기준을 조사하고 추가 수행을 계획하세요.',
    !available,
  );
  const cv = (item: ReproductionEvidence) =>
    item.mean !== null &&
    item.mean !== 0 &&
    item.sd !== null &&
    Number.isFinite(item.sd)
      ? (item.sd / Math.abs(item.mean)) * 100
      : null;
  if (plan.maxCvPercent !== null) {
    const acv = cv(a),
      bcv = cv(b);
    add(
      '수행별 산포 CV 기준',
      acv !== null &&
        bcv !== null &&
        acv <= plan.maxCvPercent &&
        bcv <= plan.maxCvPercent,
      `A=${acv ?? '계산 불가'}%, B=${bcv ?? '계산 불가'}%; 한도 ${plan.maxCvPercent}%`,
      '평균이 0이거나 산포가 없으면 CV를 판정할 수 없습니다. 측정량에 적합한 산포 기준인지 확인하세요.',
      acv === null || bcv === null,
    );
  }
  const verdict = checks.some((check) => check.state === '미확인')
    ? '판정 보류'
    : checks.some((check) => check.state === '초과')
      ? '입력 기준 미충족'
      : '입력 기준 충족';
  return { verdict, checks, difference, cvA: cv(a), cvB: cv(b) };
}
export type ReproductionRun = {
  id: string;
  createdAt: string;
  plan: ReproductionPlan;
  confirmed: boolean;
  baseline: unknown;
  repeat: unknown;
  result: ReturnType<typeof assessReproduction>;
  limits: string;
};
export type ReproductionState = {
  plan: ReproductionPlan | null;
  runs: ReproductionRun[];
};
