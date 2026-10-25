import {test} from '@playwright/test';
import {checkHeavyBridge} from '../helpers/heavy-bridge-check.js';
for(const mobile of [false,true])test('heavy bridge planning, construction and crossing / '+mobile,async({browser})=>{
 test.setTimeout(90000);await checkHeavyBridge(browser,mobile);
});
