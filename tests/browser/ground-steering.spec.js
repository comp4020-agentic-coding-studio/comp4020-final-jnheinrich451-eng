import {test} from '@playwright/test';
import {checkGroundSteering} from '../helpers/ground-steering-check.js';
for(const kind of ['tank','recycler','builder'])for(const mobile of [false,true])test('hull-relative steering, braking and saved heading / '+kind+' / '+mobile,async({browser})=>{
 test.setTimeout(30000);await checkGroundSteering(browser,kind,mobile);
});
