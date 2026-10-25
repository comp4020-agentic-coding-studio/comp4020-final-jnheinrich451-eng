import {test} from '@playwright/test';
import {checkMusic} from '../helpers/music-check.js';
test('music loops with persistent controls on desktop',async({browser})=>{await checkMusic(browser);});
test('music loops with persistent controls on phone',async({browser})=>{await checkMusic(browser,true);});
