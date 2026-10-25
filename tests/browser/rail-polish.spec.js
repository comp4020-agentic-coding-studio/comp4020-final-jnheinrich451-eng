import {test} from '@playwright/test';
import {checkRailPolish} from '../helpers/rail-polish-check.js';
for(const mobile of [false,true])test('rail catalogue, saved unfolding and remote cannon / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(45000);await checkRailPolish(browser,mobile);
});
