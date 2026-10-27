-- Execute in Supabase SQL Editor. Temporary users and records are rolled back.
begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.projects(id,title,topic) values ('10000000-0000-4000-8000-000000000011','Research tools RLS test','rollback only');
insert into public.research_designs(project_id,design) values ('10000000-0000-4000-8000-000000000011','{"question":"temporary"}');
insert into public.research_datasets(project_id,name,quantity,unit,"values",run_date) values ('10000000-0000-4000-8000-000000000011','A','period','s','[1,2,3]',current_date);
do $$ begin
  if (select count(*) from public.research_designs) <> 1 then raise exception 'owner design read failed'; end if;
  if (select count(*) from public.research_datasets) <> 1 then raise exception 'owner dataset read failed'; end if;
  begin
    insert into public.research_datasets(project_id,name,quantity,unit,"values",run_date) values ('10000000-0000-4000-8000-000000000011','invalid','period','s','["bad"]',current_date);
    raise exception 'invalid raw value accepted';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.research_designs) <> 0 then raise exception 'cross-user design leak'; end if;
  if (select count(*) from public.research_datasets) <> 0 then raise exception 'cross-user dataset leak'; end if;
  begin
    insert into public.research_designs(project_id) values ('10000000-0000-4000-8000-000000000011');
    raise exception 'cross-user insert accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.research_designs','select') then raise exception 'anon design access'; end if;
  if has_table_privilege('anon','public.research_datasets','select') then raise exception 'anon dataset access'; end if;
end $$;
rollback;
select 'PASS: owner save/read, cross-user isolation, raw numeric validation, anon denied; test data rolled back' as result;
