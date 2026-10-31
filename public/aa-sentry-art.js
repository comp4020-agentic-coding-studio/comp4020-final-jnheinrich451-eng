// Stationary air defense: a one-tile mounting pad and two independently recoiling
// barrels. Only the server-provided turret bearing controls its aim.
export function drawAASentry(c,angle,recoil=[0,0]){
  c.save();
  c.fillStyle='#263a3344';c.fillRect(-19,-15,42,40);
  c.fillStyle='#40585b';c.fillRect(-20,-20,40,40);
  c.strokeStyle='#a6c4c1';c.lineWidth=1.6;c.strokeRect(-17,-17,34,34);
  for(const x of [-19,14])for(const y of [-19,14]){c.fillStyle='#d4b779';c.fillRect(x,y,5,5);c.fillStyle='#344a4c';c.fillRect(x+1,y+1,3,3);}
  c.fillStyle='#1b3037';c.beginPath();c.arc(0,0,15,0,Math.PI*2);c.fill();
  c.strokeStyle='#708e8c';c.lineWidth=2;c.stroke();
  c.rotate(angle);
  // Mouths match the AA muzzle events (lateral ±.16 tiles, forward ≈44 px).
  for(let i=0;i<2;i++){
    const x=(i?1:-1)*7.68,y=-44+(recoil[i]||0);
    c.fillStyle='#263b43';c.fillRect(x-3.2,y,6.4,37);
    c.fillStyle='#a6c6c8';c.fillRect(x-2,y,2,34);
    c.fillStyle='#657f83';c.fillRect(x-3.8,y+4,7.6,4);
    c.fillStyle='#1a2933';c.fillRect(x-2.5,y,5,2);
  }
  c.fillStyle='#788f8c';c.strokeStyle='#cad2af';c.lineWidth=1.5;
  c.beginPath();c.moveTo(-13,-10);c.lineTo(13,-10);c.lineTo(16,5);c.lineTo(10,13);c.lineTo(-10,13);c.lineTo(-16,5);c.closePath();c.fill();c.stroke();
  c.fillStyle='#344d56';c.fillRect(-8,-4,16,10);
  c.strokeStyle='#a3c0b4';c.lineWidth=1;for(let y=-2;y<6;y+=3){c.beginPath();c.moveTo(-6,y);c.lineTo(6,y);c.stroke();}
  c.fillStyle='#b4dddf';c.fillRect(-2,-9,4,3);
  c.strokeStyle='#425e67';c.lineWidth=2;c.beginPath();c.moveTo(0,11);c.lineTo(0,18);c.stroke();
  c.fillStyle='#496a72';c.strokeStyle='#a7d9dd';c.lineWidth=1.2;
  c.beginPath();c.ellipse(0,17,10,3.5,0,0,Math.PI*2);c.fill();c.stroke();
  c.restore();
}
