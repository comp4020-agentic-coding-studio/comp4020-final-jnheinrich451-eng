import {test} from '@playwright/test';
import {checkOrbitalExpansion} from '../helpers/orbital-expansion-check.js';
for(const payload of ['HEAVY','BARRAGE','CLUSTER','BEAM'])for(const mobile of [false,true])test(`expanded orbital ${payload} / ${mobile?'phone':'desktop'}`,async({browser})=>{
 test.setTimeout(55000);await checkOrbitalExpansion(browser,payload,mobile);
});
