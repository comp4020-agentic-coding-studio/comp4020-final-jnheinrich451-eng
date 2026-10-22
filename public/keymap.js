// Single keyboard table. app.js supplies a guard and action for each id; this list
// fixes precedence (first matching, currently valid binding wins) and also renders
// the on-screen key caps and the F1 reference, so the three never disagree.
// Letter and digit keys are matched by physical position (event.code), so the
// WASD layout works on non-QWERTY keyboards; symbols keep their typed meaning.

export const SCOPES = Object.freeze({
  global: 'Anywhere', catalogue: 'Deploy catalogue', placing: 'Placing', combat: 'Weapons',
  recycler: 'Recycler', tank: 'Tank', gun: 'Cannon / missile battery', ship: 'Ship', submarine: 'Submarine', aircraft: 'Aircraft',
});

const bind = (id, keys, label, scope, text, extra = {}) => Object.freeze({ id, keys, label, scope, text, ...extra });

export const BINDINGS = Object.freeze([
  // Vehicle seats and context keys come first: they override the global meaning.
  bind('remote-air-rotate',['r'],'R','global','Rotate remote aircraft attack approach'),
  bind('orbital-rotate', ['r'], 'R', 'global', 'Rotate orbital strike preview'),
  bind('orbital-open', ['v'], 'V', 'global', 'Orbital strike planner'),
  bind('bomber-open', ['h'], 'H', 'global', 'Aircraft support and landing orders'),
  bind('recycler-board', ['e'], 'E', 'recycler', 'Board or leave the recycler / bridge builder'),
  bind('station-open', ['e'], 'E', 'recycler', 'Open a nearby launch station on foot'),
  bind('aircraft-board', ['e'], 'E', 'aircraft', 'Board, land helicopter, or disembark'),
  bind('airbase-rebuild', ['t'], 'T', 'aircraft', 'Rebuild a nearby ruined airbase / helipad for 150 GND'),
  bind('aircraft-space', [' '], 'Space', 'aircraft', 'Reserved while flying (bombs use LMB)'),
  bind('sub-depth', [' ', 'controlleft'], 'Ctrl / Space', 'submarine', 'Dive / surface'),
  bind('missile-rotate', ['r'], 'R', 'gun', 'Rotate the strike area'),
  bind('catalogue-prev', ['z'], 'Z', 'catalogue', 'Previous category'),
  bind('catalogue-next', ['x'], 'X', 'catalogue', 'Next category'),
  bind('catalogue-pick', ['1', '2', '3', '4', '5', '6', '7', '8', '9'], '1–9', 'catalogue', 'Choose an asset in this category'),
  bind('gun-ammo', ['1', '2', '3'], '1 2 3', 'gun', 'HE / Fire / Gas shells'),
  bind('flight-systems', ['u'], 'U', 'aircraft', 'Open / close aircraft systems'),
  bind('ship-systems', ['u'], 'U', 'ship', 'Open / close ship systems and carrier flight controls'),
  bind('ship-throttle', ['w','s','arrowup','arrowdown'], 'W / S', 'ship', 'Raise / lower throttle one step (tap)'),
  bind('ship-ammo', ['1', '2', '3'], '1 2 3', 'ship', 'HE / Fire / Gas shells'),
  bind('tank-primary', ['1'], '1', 'tank', 'Toggle LMB: HE / Magnetic'),
  bind('tank-secondary', ['2'], '2', 'tank', 'Toggle RMB: machine gun / fuel jet'),
  bind('shipyard-open', ['e'], 'E', 'ship', 'Open your nearby shipyard'),
  bind('ship-board', ['e'], 'E', 'ship', 'Board or leave the ship'),
  bind('tank-board', ['e'], 'E', 'tank', 'Board or leave the tank'),
  bind('place-confirm', ['enter'], 'Enter', 'placing', 'Confirm the selected site', { shift: false }),
  bind('place-repeat', ['enter'], 'Shift+Enter', 'placing', 'Confirm and keep placing (sentry, rail)', { shift: true }),
  bind('rail-shape', ['r'], 'R', 'placing', 'Rail: cycle shape'),
  bind('rail-length', ['t'], 'T', 'placing', 'Rail: toggle 1 / 5 tiles'),
  bind('remote', ['f'], 'F', 'global', 'Select a cannon or missile launcher remotely'),
  bind('deploy', ['b'], 'B', 'global', 'Deploy catalogue'),
  bind('secondary', ['j'], 'J (hold)', 'combat', 'Secondary weapon'),
  bind('primary', [' '], 'Space', 'combat', 'Primary weapon'),
  bind('back', ['escape'], 'Esc', 'global', 'Back / close current window; resume or open room menu'),
  bind('sub-rotate', ['r'], 'R', 'submarine', 'Rotate the strike area'),
  bind('recenter', ['c'], 'C', 'global', 'Recenter on yourself'),
  bind('ship-cargo', ['k'], 'K', 'ship', 'Load a parked vehicle or drive off the transport'),
  bind('ship-ramp', ['g'], 'G', 'ship', 'Deploy or retract the shore ramp'),
  bind('grid', ['g'], 'G', 'global', 'Toggle tile grid'),
  bind('logistics', ['l'], 'L', 'global', 'Logistics and supplies'),
  bind('planet-open', ['n'], 'N', 'global', 'Campaign globe'),
  bind('overview', ['m'], 'M', 'global', 'Toggle survey overview'),
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
  ['Jet / bomber', 'Hold W/S to change airspeed; A/D banks, release to level; U systems'],
  ['Ship steering', 'Hold A/D to steer; release to centre rudder; W/S selects persistent throttle'],
  ['Tank driving', 'World-direction steering; slower reverse; release to brake'],
  ['Mouse', 'Aim (gold crosshair = desired target)'],
  ['LMB / Space', 'Primary weapon'],
  ['RMB / J (hold)', 'Secondary weapon'],
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
