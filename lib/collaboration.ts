import { supabase } from './supabase';

export type VersionedTable =
  | 'projects'
  | 'protocols'
  | 'research_events'
  | 'research_designs'
  | 'research_datasets';
// The database independently checks revisions and permissions; this filter adds atomic CAS.
export async function saveVersioned(
  table: VersionedTable,
  record: Record<string, unknown>,
  version: number | null,
) {
  const key =
    table === 'protocols' || table === 'research_designs' ? 'project_id' : 'id';
  const payload = { ...record, revision: version === null ? 0 : version + 1 };
  const query =
    version === null
      ? supabase.from(table).insert(payload)
      : supabase
          .from(table)
          .update(payload)
          .eq(key, record[key])
          .eq('revision', version);
  const result = await query.select().single();
  if (result.error && ['PGRST116', '23505'].includes(result.error.code))
    return {
      ...result,
      error: {
        code: '40001',
        message: 'LABFLOW_CONFLICT',
        details: result.error.details,
        hint: result.error.hint,
        name: result.error.name,
      },
    };
  return result;
}

export const recordLabels: Record<string, string> = {
  projects: '프로젝트',
  protocols: '실험 프로토콜',
  research_events: '일정',
  research_designs: '연구 설계·분석 기록',
  research_datasets: '측정 데이터',
  project_members: '팀원',
  project_invitations: '초대',
};
export function changedValues(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  prefix = '',
): { field: string; before: unknown; after: unknown }[] {
  const result: { field: string; before: unknown; after: unknown }[] = [];
  for (const key of new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])) {
    const a = before?.[key],
      b = after?.[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (
      key === 'design' &&
      a &&
      b &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    )
      result.push(
        ...changedValues(
          a as Record<string, unknown>,
          b as Record<string, unknown>,
          `${prefix}design.`,
        ),
      );
    else result.push({ field: prefix + key, before: a, after: b });
  }
  return result;
}
