import {test} from '@playwright/test';
import {checkPanelCombat} from '../helpers/panel-combat-check.js';
for(const mobile of [false,true])test('workshop and deployment capture only their own pointer area / '+(mobile?'phone':'desktop'),async({browser})=>checkPanelCombat(browser,mobile));
for(const mobile of [false,true])test('carrier exchange retains both parked aircraft / '+(mobile?'phone':'desktop'),async({browser})=>checkPanelCombat(browser,mobile,true));

for(const mobile of [false,true])test('carrier exchange automatically recycles parked aircraft without confirmation / '+(mobile?'phone':'desktop'),async({browser})=>checkPanelCombat(browser,mobile,'gunship'));
