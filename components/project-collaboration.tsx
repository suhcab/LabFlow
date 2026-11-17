'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { databaseError, type Project } from '@/lib/project';
import { changedValues, recordLabels } from '@/lib/collaboration';
import { downloadText } from '@/lib/research';
type TeamMember = {
  user_id: string;
  email: string;
  role: string;
  joined_at: string;
};
type Invite = {
  id: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};
type History = {
  id: number;
  actor_email: string | null;
  occurred_at: string;
  record_type: string;
  action: string;
  changed_fields: string[];
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
};
const fieldLabels: Record<string, string> = {
  title: '제목',
  topic: '연구 주제',
  progress: '진행률',
  status: '상태',
  purpose: '실험 목적',
  steps: '실험 단계',
  values: '측정 원자료',
  exclusions: '제외 사유',
  conditions: '수행 조건',
  notes: '메모',
  archived_at: '보관 상태',
  'design.project_deleted_at': '프로젝트 휴지통 상태',
  'design.data_source': '원자료·참고문헌',
  'design.question': '연구 질문',
  'design.reproduction': '재현성 검토',
  'design.image_analyses': '사진 분석 기록',
};
const show = (value: unknown) =>
  value === undefined ? '없음' : (JSON.stringify(value, null, 2) ?? '없음');
export function ProjectCollaboration({
  project,
  view,
  isOwner,
}: {
  project: Project;
  view: 'team' | 'history';
  isOwner: boolean;
}) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [detail, setDetail] = useState<History | null>(null);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      if (view === 'team') {
        const result = await supabase.rpc('list_project_team', {
          p_project: project.id,
        });
        if (!active) return;
        if (result.error) setNotice(databaseError(result.error));
        else setTeam(result.data ?? []);
        if (isOwner) {
          const list = await supabase
            .from('project_invitations')
            .select('id,expires_at,accepted_at,revoked_at,created_at')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false })
            .limit(30);
          if (!active) return;
          if (list.error) setNotice(databaseError(list.error));
          else setInvites(list.data ?? []);
        }
      } else {
        const result = await supabase
          .from('project_history')
          .select(
            'id,actor_email,occurred_at,record_type,action,changed_fields',
          )
          .eq('project_id', project.id)
          .order('id', { ascending: false })
          .range(page * 20, page * 20 + 19);
        if (!active) return;
        if (result.error) setNotice(databaseError(result.error));
        else setHistory(result.data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [project.id, view, isOwner, page, revision]);
  async function action(
    name:
      | 'create_project_invitation'
      | 'remove_project_member'
      | 'revoke_project_invitation',
    args: Record<string, string>,
  ) {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await supabase.rpc(name, args);
      if (result.error) setNotice(databaseError(result.error));
      else {
        if (name === 'create_project_invitation') setCode(result.data);
        setRevision((value) => value + 1);
        setNotice(
          name === 'create_project_invitation'
            ? '초대코드를 발급했습니다.'
            : '설정을 저장했습니다.',
        );
      }
    } catch {
      setNotice('연결하지 못했습니다. 다시 시도하세요.');
    } finally {
      setBusy(false);
    }
  }
  async function readDetail(item: History) {
    setBusy(true);
    setDetail(null);
    const result = await supabase
      .from('project_history')
      .select('*')
      .eq('project_id', project.id)
      .eq('id', item.id)
      .single();
    if (result.error) setNotice(databaseError(result.error));
    else setDetail(result.data);
    setBusy(false);
  }
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-5 md:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">
          {view === 'team' ? '팀원·초대' : '수정 이력'}
        </h2>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          새로고침
        </Button>
      </div>
      <output className="block text-sm" aria-live="polite">
        {notice || (loading ? '불러오는 중…' : '')}
      </output>
      {view === 'team' ? (
        <>
          <div className="rounded-xl border bg-muted/40 p-5 text-sm space-y-2">
            <p>
              초대한 팀원은 이 프로젝트의 연구 설계·프로토콜·일정·측정값·분석
              기록을 함께 조회하고 수정할 수 있습니다. 팀원 관리와 프로젝트
              삭제·복원은 소유자만 할 수 있습니다.
            </p>
            <p>
              저장된 내용을 공유하는 공동 편집입니다. 같은 기록을 동시에
              수정하면 충돌을 알리며, 입력 내용을 보관한 뒤 최신 내용을 불러와
              다시 반영하세요.
            </p>
          </div>
          <div className="divide-y rounded-xl border">
            {team.map((member) => (
              <div
                key={member.user_id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium">
                    {member.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.role === 'owner' ? '소유자' : '공동 편집자'} ·{' '}
                    {new Date(member.joined_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                {isOwner && member.role !== 'owner' && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void action('remove_project_member', {
                        p_project: project.id,
                        p_user: member.user_id,
                      })
                    }
                  >
                    편집 권한 해제
                  </Button>
                )}
              </div>
            ))}
          </div>
          {isOwner && (
            <section className="rounded-xl border p-5 space-y-3">
              <h3 className="font-semibold">팀원 초대</h3>
              <p className="text-sm text-muted-foreground">
                가입한 팀원에게 초대코드를 직접 전달하세요. 코드는 7일 동안 1회
                사용할 수 있으며, 코드를 받은 계정이 편집 권한을 얻으므로
                팀원에게만 전달하세요.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void action('create_project_invitation', {
                    p_project: project.id,
                  })
                }
              >
                초대코드 발급
              </Button>
              {code && (
                <div className="rounded-lg bg-muted p-3 space-y-2">
                  <p className="text-xs">
                    코드는 이 화면에서만 확인할 수 있습니다.
                  </p>
                  <p className="break-all select-all font-mono text-sm">
                    {code}
                  </p>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(code);
                        setNotice('초대코드를 복사했습니다.');
                      } catch {
                        setNotice('표시된 코드를 직접 복사하세요.');
                      }
                    }}
                  >
                    코드 복사
                  </Button>
                </div>
              )}
              <div className="divide-y">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span>
                      {new Date(invite.created_at).toLocaleString('ko-KR')} ·{' '}
                      {invite.revoked_at
                        ? '취소됨'
                        : invite.accepted_at
                          ? '사용됨'
                          : new Date(invite.expires_at) < new Date()
                            ? '만료됨'
                            : '참여 대기'}
                      <span className="block text-xs text-muted-foreground">
                        만료:{' '}
                        {new Date(invite.expires_at).toLocaleString('ko-KR')}
                      </span>
                    </span>
                    {!invite.accepted_at &&
                      !invite.revoked_at &&
                      new Date(invite.expires_at) > new Date() && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void action('revoke_project_invitation', {
                              p_invitation: invite.id,
                            })
                          }
                        >
                          초대 취소
                        </Button>
                      )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            기능 적용 이후의 저장·삭제·팀원 변경을 DB에서 자동 기록합니다.
            기록한 시각과 등록 이메일을 표시하며, 과거의 모든 키 입력을
            기록하지는 않습니다. 이력은 앱에서 수정하거나 삭제할 수 없습니다.
          </p>
          {!loading && !history.length && (
            <p className="rounded-xl border p-5">아직 수정 이력이 없습니다.</p>
          )}
          <div className="divide-y rounded-xl border">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {recordLabels[item.record_type] ?? item.record_type} ·{' '}
                    {(
                      {
                        INSERT: '추가',
                        UPDATE: '수정',
                        DELETE: '삭제',
                      } as Record<string, string>
                    )[item.action] ?? item.action}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {item.actor_email ?? '시스템'} ·{' '}
                    {new Date(item.occurred_at).toLocaleString('ko-KR')}
                  </p>
                  <p className="mt-1 break-words text-xs">
                    변경 항목:{' '}
                    {item.changed_fields
                      .map((field) => fieldLabels[field] ?? field)
                      .join(', ')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void readDetail(item)}
                >
                  변경 전후 보기
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={page === 0 || loading}
              onClick={() => {
                setPage((value) => value - 1);
                setDetail(null);
              }}
            >
              이전
            </Button>
            <span className="text-sm">{page + 1}쪽</span>
            <Button
              variant="outline"
              disabled={history.length < 20 || loading}
              onClick={() => {
                setPage((value) => value + 1);
                setDetail(null);
              }}
            >
              다음
            </Button>
          </div>
          {detail && (
            <section className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="font-semibold">
                  변경 전후 ·{' '}
                  {new Date(detail.occurred_at).toLocaleString('ko-KR')}
                </h3>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadText(
                      '수정이력.json',
                      JSON.stringify(detail, null, 2),
                      'application/json;charset=utf-8',
                    )
                  }
                >
                  상세 JSON
                </Button>
              </div>
              {changedValues(
                detail.before_data ?? null,
                detail.after_data ?? null,
              ).map((change) => (
                <div key={change.field} className="border-t pt-3">
                  <p className="mb-2 text-sm font-medium">
                    {fieldLabels[change.field] ?? change.field}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ['변경 전', change.before],
                      ['변경 후', change.after],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="min-w-0 rounded-lg bg-muted p-3"
                      >
                        <p className="text-xs font-semibold">{String(label)}</p>
                        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">
                          {show(value).slice(0, 4000)}
                          {show(value).length > 4000
                            ? '\n… 전체 내용은 상세 JSON에서 확인하세요.'
                            : ''}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
