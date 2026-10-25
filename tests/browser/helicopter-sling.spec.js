import {test} from '@playwright/test';
import {checkHelicopterSling} from '../helpers/helicopter-sling-check.js';
for(const mobile of [false,true])test('failed landing flash, sling pickup and set-down / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(60000);await checkHelicopterSling(browser,mobile);
});
