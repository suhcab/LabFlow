export type Project = {
  user_id?: string;
  revision?: number;
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
  if (/Invitation is invalid|Invalid invitation/.test(error.message))
    return '유효하지 않은 초대코드입니다. 사용 완료·취소·7일 만료 여부를 확인하고 소유자에게 새 코드를 요청하세요.';
  if (/Already a project member/.test(error.message))
    return '이미 참여 중인 프로젝트입니다.';
  if (/Project is in the trash/.test(error.message))
    return '휴지통에 있는 프로젝트입니다. 소유자에게 복원을 요청하세요.';
  if (error.code === '40001' || /LABFLOW_CONFLICT/.test(error.message))
    return '다른 팀원이 먼저 저장했거나 화면이 오래되었습니다. 입력 내용을 복사해 보관한 뒤 ‘최신 내용 불러오기’ 또는 새로고침으로 다시 확인하세요. 변경 내용은 덮어쓰지 않았습니다.';
  if (error.code === 'PGRST205' || error.code === '42P01') {
    return '필요한 테이블이 없습니다. Supabase SQL Editor에서 supabase/schema.sql을 실행해 주세요.';
  }
  if (error.code === '42501') {
    return '접근 권한이 없습니다. 소유자에게 팀원 권한을 확인해 주세요.';
  }
  if (/api key|jwt/i.test(error.message)) {
    return 'Supabase 연결 키가 올바르지 않습니다. 프로젝트 주소와 같은 프로젝트의 공개 키를 설정해 주세요.';
  }
  if (/fetch|network|timeout|abort|load failed/i.test(error.message)) {
    return '연구 저장소에 연결하지 못했습니다. Supabase 프로젝트가 활성 상태인지, 연결 주소가 올바른지 확인한 뒤 다시 시도해 주세요.';
  }
  return `요청을 처리하지 못했습니다: ${error.message}`;
}
