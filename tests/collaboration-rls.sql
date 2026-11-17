-- Run as postgres in Supabase SQL Editor after the collaboration migration.
-- All users, invitations, membership and records below are temporary/rolled back.
begin;
insert into auth.users(id,email) values
('20000000-0000-4000-8000-000000000001','owner@example.invalid'),
('20000000-0000-4000-8000-000000000002','editor@example.invalid'),
('20000000-0000-4000-8000-000000000003','outsider@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
insert into public.projects(id,title) values ('20000000-0000-4000-8000-000000000011','Collaboration rollback QA');
insert into public.protocols(project_id,purpose) values ('20000000-0000-4000-8000-000000000011','before');
insert into public.research_designs(project_id) values ('20000000-0000-4000-8000-000000000011');
select set_config('labflow.test_token',public.create_project_invitation('20000000-0000-4000-8000-000000000011'),true);
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
do $$ begin
if exists(select 1 from public.projects where id='20000000-0000-4000-8000-000000000011') then raise exception 'OUTSIDER LEAK'; end if;
if exists(select 1 from public.project_history where project_id='20000000-0000-4000-8000-000000000011') then raise exception 'HISTORY LEAK'; end if;
begin insert into public.research_events(project_id,title,event_date) values ('20000000-0000-4000-8000-000000000011','denied',current_date); raise exception 'OUTSIDER WRITE'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select public.accept_project_invitation(current_setting('labflow.test_token'));
update public.protocols set purpose='after',revision=1 where project_id='20000000-0000-4000-8000-000000000011' and revision=0;
insert into public.research_events(id,project_id,title,event_date) values ('20000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000011','temporary event',current_date);
update public.research_events set completed=true,revision=1 where id='20000000-0000-4000-8000-000000000021';
delete from public.research_events where id='20000000-0000-4000-8000-000000000021' and revision=1;
do $$ begin
if(select count(*) from public.list_project_team('20000000-0000-4000-8000-000000000011'))<>2 then raise exception 'TEAM LIST'; end if;
if not exists(select 1 from public.protocols where project_id='20000000-0000-4000-8000-000000000011' and purpose='after') then raise exception 'MEMBER WRITE'; end if;
if not exists(select 1 from public.project_history where project_id='20000000-0000-4000-8000-000000000011' and record_type='protocols' and action='UPDATE' and actor_email='editor@example.invalid' and before_data->>'purpose'='before' and after_data->>'purpose'='after') then raise exception 'AUDIT FAILED'; end if;
if not exists(select 1 from public.project_history where project_id='20000000-0000-4000-8000-000000000011' and record_type='research_events' and action='DELETE') then raise exception 'DELETE HISTORY FAILED'; end if;
begin update public.protocols set purpose='stale',revision=1 where project_id='20000000-0000-4000-8000-000000000011'; raise exception 'STALE WRITE'; exception when serialization_failure then null; end;
update public.protocols set purpose='stale',revision=1 where project_id='20000000-0000-4000-8000-000000000011' and revision=0;
if found then raise exception 'CAS FAILED'; end if;
begin update public.projects set user_id='20000000-0000-4000-8000-000000000002',revision=1 where id='20000000-0000-4000-8000-000000000011'; raise exception 'OWNER CHANGED'; exception when insufficient_privilege then null; end;
begin update public.research_designs set design='{"project_deleted_at":"2026-11-17"}',revision=1 where project_id='20000000-0000-4000-8000-000000000011'; raise exception 'MEMBER TRASH'; exception when insufficient_privilege then null; end;
begin update public.project_history set actor_email='fake'; raise exception 'AUDIT MUTABLE'; exception when insufficient_privilege then null; end;
begin perform token_hash from public.project_invitations; raise exception 'TOKEN HASH LEAK'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select public.remove_project_member('20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$ begin
if exists(select 1 from public.projects where id='20000000-0000-4000-8000-000000000011') then raise exception 'REVOKE FAILED'; end if;
begin perform public.accept_project_invitation(current_setting('labflow.test_token')); raise exception 'REUSE ACCEPTED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin if has_table_privilege('anon','public.project_history','select') or has_function_privilege('anon','public.accept_project_invitation(text)','execute') then raise exception 'ANON ACCESS'; end if; end $$;
rollback;
select 'PASS: owner/editor/outsider RLS, invitation single use, team revoke, immutable audit before/after/delete, stale revision and CAS; all QA data rolled back' as result;
