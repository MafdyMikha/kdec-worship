-- Optional deployment step: review and apply ONLY when ready for live dispatch.
-- Prerequisites: enable pg_cron, pg_net and Vault in Supabase; store the project
-- URL and dedicated dispatch secret in Vault as described in WEB-PUSH.md.
begin;
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='kdec_push_project_url' and decrypted_secret ~ '^https://[^/[:space:]]+$')
 or not exists(select 1 from vault.decrypted_secrets where name='kdec_push_dispatch_secret' and length(decrypted_secret)>=32) then
  raise exception 'Configure the push project URL and dispatch secret in Vault first';
 end if;
end$$;
select cron.unschedule(jobid) from cron.job where jobname='kdec-web-push';
select cron.schedule('kdec-web-push','* * * * *',$cron$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='kdec_push_project_url')||'/functions/v1/push-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='kdec_push_dispatch_secret')),
  body:='{}'::jsonb,
  timeout_milliseconds:=120000
 );
$cron$);
commit;
