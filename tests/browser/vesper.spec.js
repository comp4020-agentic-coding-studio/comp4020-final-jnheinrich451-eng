import {test} from '@playwright/test';
import {checkVesper} from '../helpers/vesper-check.js';
for(const mobile of [false,true])test('Vesper selection, core deployment, movement and saved return / '+mobile,async({browser})=>{
 test.setTimeout(60000);await checkVesper(browser,mobile);
});
