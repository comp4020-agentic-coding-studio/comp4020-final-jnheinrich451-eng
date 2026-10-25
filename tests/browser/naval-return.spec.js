import {test} from '@playwright/test';
import {checkNavalReturn} from '../helpers/naval-return-check.js';
for(const phone of [false,true])test('return to dock from '+(phone?'phone workshop':'desktop Remote'),async({browser},info)=>{
 test.setTimeout(90000);await checkNavalReturn(browser,phone,name=>info.outputPath(name+'.png'));
});

test('return completes the turn outside a tight dock corner',async({browser},info)=>{
 test.setTimeout(90000);await checkNavalReturn(browser,false,name=>info.outputPath(name+'.png'),{tightDock:true});
});
