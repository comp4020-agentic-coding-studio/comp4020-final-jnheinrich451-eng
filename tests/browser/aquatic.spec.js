import {test} from '@playwright/test';
import {checkAquatic} from '../helpers/aquatic-check.js';
for(const mobile of [false,true])test('Vesper aquatic warning, active cloud, spitter and saved return / '+mobile,async({browser})=>{
 test.setTimeout(45000);await checkAquatic(browser,mobile);
});
