import {test} from '@playwright/test';
import {checkSurveyZoom} from '../helpers/survey-zoom-check.js';
for(const mobile of [false,true])test(`robot wheel zoom reaches survey scale ${mobile?'phone':'desktop'}`,async({browser})=>{
 await checkSurveyZoom(browser,mobile);
});
