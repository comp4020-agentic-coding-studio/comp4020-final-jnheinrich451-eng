import {test} from '@playwright/test';
import {checkRemoteBranches} from '../helpers/remote-branches-check.js';
for(const mobile of [false,true])test('helicopter transport and submarine Remote / '+(mobile?'phone':'desktop'),async({browser})=>{test.setTimeout(90000);await checkRemoteBranches(browser,mobile);});
