import {test} from '@playwright/test';
import {checkCommunication} from '../helpers/communication-check.js';
test('room chat and pixel emotes on desktop',async({browser})=>{await checkCommunication(browser);});
test('room chat and pixel emotes on phone',async({browser})=>{await checkCommunication(browser,true);});
test('large saved worlds reconnect and retain movement and chat',async({browser})=>{await checkCommunication(browser,false,{snapshotCrates:1600});});
