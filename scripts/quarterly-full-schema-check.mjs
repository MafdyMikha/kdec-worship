// Optional integration check, separate from npm test. LOCAL ISOLATED DATABASE ONLY.
// The target must already contain auth-stub.sql + full schema + dynamic roles + quarterly migration.
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const psql=process.env.KDEC_TEST_PSQL || 'psql'
const database=process.argv[2]
if(database!=='kdec_full_schema_test')throw new Error('Use only the dedicated kdec_full_schema_test local database.')
const prelude=`begin;
select set_config('app.admin_user_update','1',true);
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'synthetic-'||i||'@example.invalid' from generate_series(1,9) i;
alter table auth.users enable trigger on_auth_user_created;
delete from worship_roles where name in ('Worship Leader','Guitar');
grant select on profiles,services,service_team to authenticated;
grant update,insert,delete on service_team to authenticated;
`
let sql=readFileSync(new URL('../test/sql/quarterly-workflow.sql',import.meta.url),'utf8').replace('begin;',prelude)
sql=sql.replace("update profiles set availability='{}'",`update profiles set availability='{"sun":true,"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":true}';
update profiles set availability='{}'`)
sql=sql.replace('insert into worship_roles(id,name) values','insert into worship_roles(id,name,slug) values').replace("'Worship Leader'),('10000000","'Worship Leader','worship-leader'),('10000000").replace("'10000000-0000-0000-0000-000000000002','Guitar');","'10000000-0000-0000-0000-000000000002','Guitar','guitar');")
const directory=mkdtempSync(join(tmpdir(),'kdec-quarter-full-'))
const file=join(directory,'scenario.sql');writeFileSync(file,sql)
execFileSync(psql,['-h','127.0.0.1','-p','55439','-d',database,'-v','ON_ERROR_STOP=1','-f',file],{stdio:'inherit'})
