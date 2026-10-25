import {test} from '@playwright/test';
import {checkSubmarineOperations} from '../helpers/submarine-operations-check.js';
for(const phone of [false,true])test('moving submarine depth and underwater launch on '+(phone?'phone':'desktop'),async({browser},info)=>{
 test.setTimeout(60000);await checkSubmarineOperations(browser,phone,name=>info.outputPath(name+'.png'));
});
