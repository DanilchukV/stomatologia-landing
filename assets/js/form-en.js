'use strict';
// Name and phone checks for the booking form.
window.SiteForm = (function () {
  function nameError(v) {
    const s = v.trim();
    if (!s) return 'Please enter your name';
    if (s.length < 2) return 'The name is too short';
    if (!/^[A-Za-zА-Яа-яЁёІіЎў' -]+$/.test(s)) return 'Letters only, no digits or symbols';
    if (!/[аеёиоуыэюяіaeiouy]/i.test(s) || /(.)\1\1/i.test(s) || /[бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxz]{4,}/i.test(s) || mashed(s)) return 'Please check the spelling of your name';
    return '';
  }
  // a run along a keyboard row («йцукен», «фыва», «qwerty», «asdf»): 5+ keys anywhere in a word, or a whole word
  // of 4+ (4 anywhere would catch real names, e.g. «Митьков»)
  const ROWS = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  function mashed(s) {
    return s.toLowerCase().split(/[\s'-]+/).some((w) => {
      for (const row of ROWS) {
        for (const r of [row, Array.from(row).reverse().join('')]) {
          if (w.length >= 4 && r.includes(w)) return true;
          for (let i = 0; i + 5 <= w.length; i++) if (r.includes(w.slice(i, i + 5))) return true;
        }
      }
      return false;
    });
  }
  function phoneError(v) {
    const d = v.replace(/\D/g, '');
    if (!d || d === '375') return 'Please enter your phone number';
    if (!d.startsWith('375')) return d.length < 8 ? 'The number is incomplete: check the country code and number' : '';
    if (d.length < 12) return 'The number is incomplete: 9 digits are needed after +375';
    if (!/^375(25|29|33|44|1\d|2\d)/.test(d)) return 'Check the operator code: 25, 29, 33 or 44';
    return '';
  }
  // optional: empty is fine
  function emailError(v) {
    const s = v.trim();
    if (!s) return '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'Please check the email address';
    return '';
  }
  // another country ("+" and a code other than 375): kept as typed, digits and separators only, max 15 digits (E.164)
  function formatForeign(raw) {
    let n = 0;
    const s = raw.replace(/[^\d ()-]/g, '').replace(/^[ ()-]+/, '').replace(/ {2,}/g, ' ');
    return '+' + Array.from(s).filter((c) => !/\d/.test(c) || ++n <= 15).join('');
  }
  // +375 (29) 123-45-67; a local 80… prefix becomes 375, an international 00 a "+"; digits without "+" are a
  // Belarusian number
  function formatPhone(raw) {
    const plus = raw.trim().startsWith('+');
    let d = raw.replace(/\D/g, '');
    if (!plus && d.startsWith('00')) return formatPhone('+' + raw.replace(/^[^\d]*0[^\d]*0/, ''));
    if (plus && d && !d.startsWith('375') && !'375'.startsWith(d)) return formatForeign(raw);
    // may be the start of 80…, 00… or 375…: no "+" yet, or «33…» (МТС) typed without a code turned into «+33…» (France)
    if (!plus && (d === '8' || d === '0' || d === '3' || d === '37')) return d;
    if (!plus && d.startsWith('80')) d = '375' + d.slice(2);
    else if (d && !d.startsWith('375') && !'375'.startsWith(d)) d = '375' + d;
    d = d.slice(0, 12);
    if (!d) return plus ? '+' : '';
    let out = '+' + d.slice(0, 3);
    if (d.length > 3) out += ' (' + d.slice(3, 5);
    // the bracket closes with the next digit, so Backspace after «(29» isn't undone at once
    if (d.length > 5) out += ')';
    if (d.length > 5) out += ' ' + d.slice(5, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    if (d.length > 10) out += '-' + d.slice(10, 12);
    return out;
  }

  // Formats the phone input in place and keeps the caret after the same digit (it jumped to the end, so a digit
  // fixed in the middle sent the next one to the end). Backspace or Delete on a bracket, space or dash takes the
  // digit next to it instead, or the formatting would put the separator straight back.
  const digitsIn = (s) => s.replace(/\D/g, '').length;
  // how many digits formatPhone adds (+) or drops (−) in front of the typed ones, mirroring its rules
  function leadDelta(raw) {
    const plus = raw.trim().startsWith('+');
    const d = raw.replace(/\D/g, '');
    if (!plus && d.startsWith('00')) return -2 + leadDelta('+' + d.slice(2));
    if (plus || ['8', '0', '3', '37'].includes(d)) return 0;
    if (d.startsWith('80')) return 1;
    return d && !d.startsWith('375') && !'375'.startsWith(d) ? 3 : 0;
  }
  function reformat(input, e, prev) {
    let v = input.value;
    let caret = input.selectionStart;
    // (the deleted character is prev[caret]; a «+» is not a separator: it goes alone, and the formatter decides)
    if (caret !== null && digitsIn(v) === digitsIn(prev) && v.length < prev.length && prev[caret] !== '+') {
      const back = e.inputType === 'deleteContentBackward';
      const at = back ? caret - 1 : caret;
      let k = at;
      while (k >= 0 && k < v.length && /\D/.test(v[k])) k += back ? -1 : 1;
      if (k >= 0 && k < v.length) { v = v.slice(0, k) + v.slice(k + 1); caret = back ? k : caret; }
    }
    const before = caret === null ? digitsIn(v) : digitsIn(v.slice(0, caret));
    const out = formatPhone(v);
    // the formatting may add or drop digits at the start (375 for 80…, 00 for +); digits cut off at the end (over
    // 12, or 15 abroad) don't move the caret
    let n = Math.min(digitsIn(out), Math.max(0, before + leadDelta(v)));
    let pos = 0;
    while (n > 0 && pos < out.length) { if (/\d/.test(out[pos])) n--; pos++; }
    // past the «) » or «-» that follows, where the next digit goes
    if (before > 0) while (pos < out.length && /\D/.test(out[pos])) pos++;
    if (caret === null || caret >= v.length) pos = out.length;
    input.value = out;
    if (document.activeElement === input) input.setSelectionRange(pos, pos);
  }

  // Validates the form's "name", "phone" and (if present) "email" inputs. An error shows once the field
  // was left filled in, or after a submit attempt; its box is the element named by the input's aria-describedby.
  function bind(form, onSend) {
    const all = { name: nameError, phone: phoneError, email: emailError };
    const fields = {};
    const check = {};
    const touched = {};
    Object.keys(all).forEach((k) => { if (form.elements[k]) { fields[k] = form.elements[k]; check[k] = all[k]; touched[k] = false; } });
    let tried = false;
    function show() {
      Object.keys(fields).forEach((k) => {
        const err = check[k](fields[k].value);
        const visible = !!err && (touched[k] || tried);
        fields[k].setAttribute('aria-invalid', visible);
        const box = document.getElementById(fields[k].getAttribute('aria-describedby'));
        box.hidden = !visible;
        box.lastElementChild.textContent = err;
      });
    }
    fields.name.addEventListener('input', show);
    if (fields.email) fields.email.addEventListener('input', show);
    let prevPhone = '';
    fields.phone.addEventListener('beforeinput', () => { prevPhone = fields.phone.value; });
    fields.phone.addEventListener('input', (e) => { reformat(fields.phone, e, prevPhone); show(); });
    Object.keys(fields).forEach((k) => fields[k].addEventListener('blur', () => { if (fields[k].value) touched[k] = true; show(); }));
    // form.reset() (a new booking) starts the checks over: no errors until the fields are used again
    form.addEventListener('reset', () => {
      tried = false;
      Object.keys(touched).forEach((k) => { touched[k] = false; });
      show();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = Object.keys(fields).find((k) => check[k](fields[k].value));
      if (bad) { tried = true; show(); fields[bad].focus(); return; }
      onSend();
    });
  }

  return { bind };
})();
