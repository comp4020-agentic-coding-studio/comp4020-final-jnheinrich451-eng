import {test} from '@playwright/test';
import {checkSubmarineMagazines} from '../helpers/submarine-magazines-check.js';
for(const phone of [false,true])test('four submarine salvo groups / '+(phone?'phone':'desktop'),async({browser})=>{test.setTimeout(40000);await checkSubmarineMagazines(browser,phone);});
