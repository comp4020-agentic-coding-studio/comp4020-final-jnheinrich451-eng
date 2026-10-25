import {test} from '@playwright/test';
import {checkDockBoarding} from '../helpers/dock-boarding-check.js';
for(const mobile of [false,true])test('manual carrier docking and occupied exit fallback / '+mobile,async({browser})=>{
 test.setTimeout(30000);await checkDockBoarding(browser,mobile);
});
