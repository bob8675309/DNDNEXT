// Derive a disposable runner; never edit original I1F source.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const p='scripts/test_i1f_battle_master_original_joint_local_auth.mjs';
const b=fs.readFileSync(p);
assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),'85ad0863723994c2efcd2f4bc316a8e97b2e85fa');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.CI,'true');
assert.equal(process.env.PGHOST,'127.0.0.1');
assert.equal(process.env.PGPORT,'55422');
assert.equal(process.env.DNDNEXT_I1F_LOCAL_CONFIRM,'DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY');
fs.writeFileSync('scripts/.i2j_i1ef_resource_progression_generated.mjs',b.toString('utf8')+'\n'+fs.readFileSync('scripts/integration/i2j/i1ef_resource_progression_research_tail.mjs','utf8'),{flag:'wx'});
