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
  if (/fetch|network/i.test(error.message)) {
    return 'Supabase에 연결하지 못했습니다. 프로젝트 주소와 네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
  }
  return `요청을 처리하지 못했습니다: ${error.message}`;
}
