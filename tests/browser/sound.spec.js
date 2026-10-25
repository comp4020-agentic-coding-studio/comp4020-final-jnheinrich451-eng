import {test} from '@playwright/test';
import {checkSound} from '../helpers/sound-check.js';
test('confirmed weapon audio and bounded mixer on desktop',async({browser})=>{await checkSound(browser);});
test('confirmed weapon audio and bounded mixer on phone',async({browser})=>{await checkSound(browser,true);});
