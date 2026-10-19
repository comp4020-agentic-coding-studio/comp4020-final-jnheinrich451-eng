import {createInterface} from 'node:readline';
import {parseAuditLine,presentAudit} from '../log-presentation.js';
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
 const event=parseAuditLine(line);if(event)console.log(presentAudit(event));
}
