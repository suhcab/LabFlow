export type Project = {
  id: string;
  title: string;
  topic: string;
  field: string;
  status: '계획 중' | '진행 중' | '완료';
  start_date: string | null;
  due_date: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
};

export function databaseError(error: { code?: string; message: string }) {
  if (error.code === 'PGRST205' || error.code === '42P01') {
    return '필요한 테이블이 없습니다. Supabase SQL Editor에서 supabase/schema.sql을 실행해 주세요.';
  }
  if (error.code === '42501') {
    return '저장 권한이 없습니다. Supabase의 테이블 권한과 RLS 정책을 확인해 주세요.';
  }
  if (/api key|jwt/i.test(error.message)) {
    return 'Supabase 연결 키가 올바르지 않습니다. 프로젝트 주소와 같은 프로젝트의 공개 키를 설정해 주세요.';
  }
  if (/fetch|network|timeout|abort|load failed/i.test(error.message)) {
    return '연구 저장소에 연결하지 못했습니다. Supabase 프로젝트가 활성 상태인지, 연결 주소가 올바른지 확인한 뒤 다시 시도해 주세요.';
  }
  return `요청을 처리하지 못했습니다: ${error.message}`;
}
