// Single keyboard table. app.js supplies a guard and action for each id; this list
// fixes precedence (first matching, currently valid binding wins) and also renders
// the on-screen key caps and the F1 reference, so the three never disagree.
// Letter and digit keys are matched by physical position (event.code), so the
// WASD layout works on non-QWERTY keyboards; symbols keep their typed meaning.

export const SCOPES = Object.freeze({
  global: 'Anywhere', remote: 'Remote', strike: 'Orbital strike', catalogue: 'Deploy catalogue', placing: 'Placing', combat: 'Weapons',
  recycler: 'Recycler', tank: 'Tank', gun: 'Cannon / missile battery', ship: 'Ship', submarine: 'Submarine', aircraft: 'Aircraft',
});

const bind = (id, keys, label, scope, text, extra = {}) => Object.freeze({ id, keys, label, scope, text, ...extra });

export const BINDINGS = Object.freeze([
  // Vehicle seats and context keys come first: they override the global meaning.
  bind('remote-air-rotate',['r'],'R','remote','Return a ship or helicopter home, or turn an aircraft approach'),
  bind('remote-slot',['1','2','3','4'],'1–4','remote','Choose shells or bomber payload'),
  bind('remote-ramp',['g'],'G','remote','Ship ramp at the nearest shore, or helicopter landing at the cursor'),
  bind('remote-sling',['v'],'V','remote','Helicopter: lift or drop a vehicle at the cursor'),
  bind('remote-launch',['l'],'L','remote','Carrier: launch its aircraft'),
  bind('remote-turn',['t'],'T','remote','Submarine: turn the strike area'),
  bind('orbital-rotate', ['r'], 'R', 'strike', 'Rotate walking HE, fire curtain or cluster line'),
  bind('runway-turn', ['r'], 'R', 'placing', 'Airbase: turn the double runway'),
  bind('heli-sling',['v'],'V','aircraft','Helicopter sling: lift / set down vehicle'),
  bind('orbital-open', ['v'], 'V', 'global', 'Aim the selected orbital strike'),
  bind('bomber-open', ['h'], 'H', 'global', 'Aircraft support and landing orders'),
  bind('recycler-board', ['e'], 'E', 'recycler', 'Board or leave the recycler / bridge builder'),
  bind('station-open', ['e'], 'E', 'recycler', 'Open a nearby launch station on foot'),
  bind('builder-plan', ['g'], 'G', 'recycler', 'Bridge builder: plan a bridge'),
  bind('recycler-launch', ['l'], 'L', 'recycler', 'Recycler beside a station: send its cargo'),
  bind('aircraft-board', ['e'], 'E', 'aircraft', 'Board, land helicopter on clear ground, or disembark'),
  bind('aircraft-space', [' '], 'Space', 'aircraft', 'Reserved while flying (bombs use LMB)'),
  bind('sub-depth', [' ', 'controlleft', 'controlright'], 'Ctrl / Space', 'submarine', 'Dive / surface'),
  bind('missile-rotate', ['r'], 'R', 'gun', 'Rotate the strike area'),
  bind('gun-target', ['t'], 'T', 'gun', 'Jump to the next target in range'),
  bind('catalogue-prev', ['z'], 'Z', 'catalogue', 'Previous category'),
  bind('catalogue-next', ['x'], 'X', 'catalogue', 'Next category'),
  bind('catalogue-pick', ['1', '2', '3', '4', '5', '6', '7', '8', '9'], '1–9', 'catalogue', 'Choose an asset in this category'),
  bind('gun-ammo', ['1', '2', '3'], '1 2 3', 'gun', 'HE / Fire / Gas shells'),
  bind('flight-payload', ['1','2','3','4'], '1 2 3 4', 'aircraft', 'Bomber payloads / Aerial gunship: 1–3 select guns'),
  bind('flight-systems', ['u'], 'U', 'aircraft', 'Locate airbase'),
  bind('ship-systems', ['u'], 'U', 'ship', 'Open / close ship systems and carrier flight controls'),
  bind('ship-throttle', ['w','s','arrowup','arrowdown'], 'W / S', 'ship', 'Raise / lower throttle one step (tap)'),
  bind('ship-ammo', ['1', '2', '3'], '1 2 3', 'ship', 'HE / Fire / Gas shells'),
  bind('tank-primary', ['1'], '1', 'tank', 'Toggle LMB: HE / Magnetic'),
  bind('tank-secondary', ['2'], '2', 'tank', 'Toggle RMB: machine gun / fuel jet'),
  bind('shipyard-open', ['e'], 'E', 'ship', 'Open your nearby shipyard'),
  bind('ship-board', ['e'], 'E', 'ship', 'Board or leave the ship'),
  bind('tank-board', ['e'], 'E', 'tank', 'Board or leave the tank'),
  bind('place-confirm', ['enter'], 'Enter', 'placing', 'Confirm the selected site', { shift: false }),
  bind('place-repeat', ['enter'], 'Shift+Enter', 'placing', 'Confirm and keep placing', { shift: true }),
  bind('chat', ['enter'], 'Enter', 'global', 'Open chat / send and close; empty sends close; Esc keeps draft'),
  bind('emote', ['q'], 'Q (hold)', 'global', 'Emote wheel: point, then release Q to send; Esc cancels'),
  bind('rail-shape', ['r'], 'R', 'placing', 'Rail: cycle shape'),
  bind('rail-length', ['t'], 'T', 'placing', 'Rail: toggle 1 / 5 tiles'),
  bind('remote', ['f'], 'F', 'global', 'Remote: order guns, ships and aircraft from the map'),
  bind('deploy', ['b'], 'B', 'global', 'Deploy catalogue'),
  bind('secondary', ['j'], 'J (hold)', 'combat', 'Laser on foot; a vehicle\'s secondary weapon'),
  bind('primary', [' '], 'Space', 'combat', 'Fuel jet on foot; a vehicle\'s main gun'),
  bind('back', ['escape'], 'Esc', 'global', 'Back / close current window; resume or open room menu'),
  bind('sub-rotate', ['r'], 'R', 'submarine', 'Rotate the strike area'),
  bind('recenter', ['c'], 'C', 'global', 'Recenter on yourself'),
  bind('locator', ['x'], 'X', 'global', 'Project the way to the next target'),
  bind('ship-cargo', ['k'], 'K', 'ship', 'Load a parked vehicle; drive off at the helm or beside the loading gate'),
  bind('ship-ramp', ['g'], 'G', 'ship', 'Deploy or retract the shore ramp'),
  bind('grid', ['g'], 'G', 'global', 'Toggle tile grid'),
  bind('logistics', ['l'], 'L', 'global', 'Logistics and supplies'),
  bind('planet-open', ['n'], 'N', 'global', 'Campaign globe'),
  bind('overview', ['m'], 'M', 'global', 'Flat tactical overview'),
  bind('objective-next', ['o'], 'O', 'global', 'Locate next hostile site', { shift: false }),
  bind('objective-prev', ['o'], 'Shift+O', 'global', 'Locate previous hostile site', { shift: true }),
  bind('room', ['p'], 'P', 'global', 'Room menu (solo pauses)'),
  bind('keys', ['f1', '?'], 'F1 / ?', 'global', 'Key reference'),
  bind('zoom-in', ['+', '='], '+', 'global', 'Zoom in'),
  bind('zoom-out', ['-'], '−', 'global', 'Zoom out'),
]);

// Always-available pointer and movement controls, listed in the reference only.
export const POINTER = Object.freeze([
  ['WASD / arrows', 'Move, drive, sail; rail travel; aircraft speed and turn'],
  ['WASD with panels', 'Movement continues unless typing or the game is paused'],
  ['Jet / bomber', 'Hold W/S to change airspeed; A/D banks, release to level; U locates airbase'],
  ['Tank / utility driving', 'W forward, S reverse; A/D turn the hull; release to brake'],
  ['Recycler', 'Park near salvage to collect, beside a station to unload; the gold ring fills with your load'],
  ['Ship steering', 'Hold A/D to steer; release to centre rudder; W/S selects persistent throttle'],
  ['Mouse', 'Aim (gold crosshair = desired target)'],
  ['LMB / Space', 'Fuel jet on foot; a vehicle\'s main gun'],
  ['RMB / J (hold)', 'Laser on foot; a vehicle\'s secondary weapon'],
  ['Wheel / pinch', 'Zoom at the pointer'],
  ['Middle-drag', 'Pan the map'],
]);

// Physical-position key for letters and digits; typed key for everything else.
export function keyOf(event) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  if (event.code === 'ControlLeft') return 'controlleft';
  if (event.code === 'NumpadAdd') return '+';
  if (event.code === 'NumpadSubtract') return '-';
  return event.key.toLowerCase();
}

export const bindingFor = id => BINDINGS.find(b => b.id === id);

// Mouse rows for a contextual section, shown with its keys in the reference.
export const SCOPE_POINTER = Object.freeze({
  remote: [['LMB', 'Attack at the cursor'], ['RMB', 'Move there; on a free friendly dock, moor'], ['Esc / F', 'Leave Remote']],
  strike: [['LMB / tap', 'Call the strike; the cutting beam takes a start, then an endpoint'], ['B', 'Back to the shelf to choose another'], ['Esc', 'Stop aiming']],
  placing: [['LMB', 'Place with ORB'], ['RMB', 'Build with GND inside support'], ['Shift + click', 'Keep placing']],
});
