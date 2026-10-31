// Full schema integration, on a pre-created LOCAL ISOLATED database only.
// This does not connect to Supabase, send messages, or touch production accounts.
import {execFileSync} from 'node:child_process'
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const database=process.argv[2]
if(database!=='kdec_calendar_test')throw new Error('Use only the dedicated local kdec_calendar_test database.')
const psql=process.env.KDEC_TEST_PSQL||'psql'
const args=['-h','127.0.0.1','-p','55439','-d',database,'-v','ON_ERROR_STOP=1']
const run=sql=>execFileSync(psql,args,{input:sql,stdio:['pipe','inherit','inherit']})
run(readFileSync(new URL('../test/sql/unified-calendar-workflow.sql',import.meta.url),'utf8'))
// Reuse the existing full-schema replacement/decline/privacy scenario under the
// new calendar publication rules, with synthetic rows and known end times.
let scenario=readFileSync(new URL('../test/sql/quarterly-workflow.sql',import.meta.url),'utf8')
scenario=scenario.replace('begin;',`begin;
select set_config('app.admin_user_update','1',true);
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'synthetic-'||i||'@example.invalid' from generate_series(1,9) i;
alter table auth.users enable trigger on_auth_user_created;
delete from worship_roles where name in ('Worship Leader','Guitar');
grant select on profiles,services,service_team to authenticated;
grant update,insert,delete on service_team to authenticated;
`)
scenario=scenario.replace("update profiles set availability='{}'",`update profiles set availability='{"sun":true,"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":true}';\nupdate profiles set availability='{}'`)
scenario=scenario.replace('insert into worship_roles(id,name) values','insert into worship_roles(id,name,slug) values').replace("'Worship Leader'),('10000000","'Worship Leader','worship-leader'),('10000000").replace("'10000000-0000-0000-0000-000000000002','Guitar');","'10000000-0000-0000-0000-000000000002','Guitar','guitar');")
scenario=scenario.replaceAll('insert into services(id,title,date,time) values','insert into services(id,title,date,time,end_time) values').replaceAll("current_date+7,'18:00');","current_date+7,'18:00','19:00');").replaceAll("current_date+7,'20:00');","current_date+7,'20:00','21:00');")
// Legacy fixture removes a temporary draft; canonical events are now retained.
scenario=scenario.replace("delete from services where id='20000000-0000-0000-0000-000000000002';","update services set status='cancelled' where id='20000000-0000-0000-0000-000000000002';")
const directory=mkdtempSync(join(tmpdir(),'kdec-calendar-sql-'))
const file=join(directory,'replacement-scenario.sql');writeFileSync(file,scenario)
execFileSync(psql,[...args,'-f',file],{stdio:'inherit'})
console.log('Unified calendar and protected replacement scenarios passed; synthetic data rolled back.')
