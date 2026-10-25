import {test} from '@playwright/test';
import {checkWreckRecovery} from '../helpers/wreck-recovery-check.js';
for(const mobile of [false,true])test('friendly wreck recovery / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(45000);await checkWreckRecovery(browser,mobile);
});
