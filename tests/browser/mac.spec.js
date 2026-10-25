import {test} from '@playwright/test';
import {checkMAC} from '../helpers/mac-check.js';
for(const mobile of [false,true])test('deploy and remotely charge the rail MAC / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(45000);await checkMAC(browser,mobile);
});
