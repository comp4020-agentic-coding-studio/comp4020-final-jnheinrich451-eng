import {test} from '@playwright/test';
import {checkDockRetirement} from '../helpers/dock-retirement-check.js';
for(const mobile of [false,true])test('empty dock explains its blocker and dismantles after walking ashore / '+mobile,async({browser})=>{
 test.setTimeout(45000);await checkDockRetirement(browser,mobile);
});
