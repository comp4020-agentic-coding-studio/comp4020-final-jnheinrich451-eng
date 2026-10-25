import {test} from '@playwright/test';
import {checkHelicopterField} from '../helpers/helicopter-field-check.js';
for(const mobile of [false,true])test('field landing, disembark, reboard and takeoff / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(60000);await checkHelicopterField(browser,mobile);
});
