import {test} from '@playwright/test';
import {checkNavalScale} from '../helpers/naval-scale-check.js';
for(const mobile of [false,true])test('large dock and carrier placement, assembly and restore / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(60000);await checkNavalScale(browser,mobile);
});
