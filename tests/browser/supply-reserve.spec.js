import {test} from '@playwright/test';
import {checkSupplyReserve} from '../helpers/supply-reserve-check.js';
for(const mobile of [false,true])test('shared refill thresholds follow connected pilots / '+(mobile?'phone':'desktop'),async({browser})=>{
 await checkSupplyReserve(browser,mobile);
});
