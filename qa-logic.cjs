const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/dist/app.js', 'utf8');
class Element {
  constructor(value = '') { this.value = value; this.listeners = {}; this.hidden = false; this.textContent = ''; this.dataset = {}; this.classList = {add(){}}; }
  addEventListener(name, cb) { this.listeners[name] = cb; }
  removeAttribute(name) { delete this[name]; }
  setAttribute(name, value) { this[name] = value; }
  setCustomValidity(value) { this.validityMessage = value; }
  remove() {}
}
function run(config, now) {
  const elements = Object.fromEntries(['countdown-grid', 'countdown-message', 'countdown-note', 'map-link', 'map-status', 'guest-count-field', 'rsvp-status'].map(x => ['#' + x, new Element()]));
  const name = new Element('Айсұлу Нұрланқызы'), count = new Element('3');
  const radios = [new Element('yes'), new Element('no')];
  const form = new Element();
  let selected = 'yes';
  form.elements = {namedItem: key => ({guestName:name, guestCount:count})[key]};
  form.querySelector = () => ({value:selected});
  form.querySelectorAll = () => radios;
  form.reportValidity = () => !name.validityMessage && !count.validityMessage;
  elements['#rsvp-form'] = form;
  ['days','hours','minutes','seconds'].forEach(x => elements[`[data-count="${x}"]`] = new Element());
  let lastLink;
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(source, {
    window: {INVITATION_CONFIG:config, matchMedia:() => ({matches:true})},
    document: {
      hidden:false, baseURI:'https://example.com/', body:{appendChild(){}},
      querySelector:x=>elements[x] || null,
      querySelectorAll:x=>x === '[data-count]' ? ['days','hours','minutes','seconds'].map(y => elements[`[data-count="${y}"]`]) : [],
      addEventListener(){}, createElement(){ const el = new Element(); el.click=()=>lastLink=el; return el; }
    }, Date:Clock, Intl, URL, setInterval(){return 1}, clearInterval(){}
  });
  return {elements, name, count, radios, submit:()=>form.listeners.submit({preventDefault(){}}), select:no=>{ selected=no; radios[0].listeners.change(); }, link:()=>lastLink};
}
const exactTarget = Date.parse('2030-07-20T13:30:00Z');
let result = run({eventDate:'2030-07-20', eventTime:'18:30'}, exactTarget - 90061000);
assert.equal(result.elements['[data-count="days"]'].textContent, '01');
assert.equal(result.elements['[data-count="hours"]'].textContent, '01');
assert.equal(result.elements['[data-count="minutes"]'].textContent, '01');
assert.equal(result.elements['[data-count="seconds"]'].textContent, '01');
result = run({eventDate:'2030-07-20',eventTime:'18:30'}, exactTarget + 1);
assert.equal(result.elements['#countdown-message'].textContent, 'Қош келдіңіздер!');
assert.equal(result.elements['#countdown-grid'].hidden, true);
for (const eventDate of ['[ЖЫЛЫ-АА-КК]','2030-02-31','2030-13-10']) {
  result = run({eventDate,eventTime:'18:30'}, exactTarget);
  assert.equal(result.elements['[data-count="days"]'].textContent, '—');
  assert.equal(result.elements['#countdown-note'].textContent, 'Той күні нақтылануда');
}
result = run({eventDate:'2030-07-20',eventTime:'18:30',whatsappNumber:'+7 (700) 123-45-67', mapUrl:'https://maps.google.com/?q=Almaty'}, exactTarget - 10000);
assert.equal(result.elements['#map-link'].href, 'https://maps.google.com/?q=Almaty');
result.submit();
let url = new URL(result.link().href);
assert.equal(url.hostname, 'wa.me');
assert.equal(url.pathname, '/77001234567');
assert.match(url.searchParams.get('text'), /Келетін адам саны: 3/);
assert.match(url.searchParams.get('text'), /Айсұлу Нұрланқызы/);
result.select('no');
assert.equal(result.count.disabled,true);
assert.equal(result.elements['#guest-count-field'].hidden,true);
result.submit();
url = new URL(result.link().href);
assert.match(url.searchParams.get('text'), /Өкінішке қарай, келе алмаймын/);
assert.doesNotMatch(url.searchParams.get('text'), /Келетін адам саны/);
result = run({whatsappNumber:'[WHATSAPP НӨМІРІ]'}, exactTarget);
result.submit();
assert.equal(result.link(),undefined);
assert.match(result.elements['#rsvp-status'].textContent,/нөмірі жақында/);
result.name.value = '   ';
result.submit();
assert.equal(result.name.validityMessage, 'Аты-жөніңізді жазыңыз.');
result.elements['#map-link'].listeners.click({preventDefault(){}});
assert.match(result.elements['#map-status'].textContent,/жақында/);
console.log('Passed: Almaty timezone/countdown, expiry, invalid dates, WhatsApp encoding, attendance toggle, missing data and blank-name validation.');
