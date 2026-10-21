'use strict';
// Name and phone checks shared by the forms: booking (home page) and job application (vacancies).
window.SiteForm = (function () {
  function nameError(v) {
    const s = v.trim();
    if (!s) return 'Укажите имя';
    if (s.length < 2) return 'Имя слишком короткое';
    if (!/^[A-Za-zА-Яа-яЁёІіЎў' -]+$/.test(s)) return 'Только буквы, без цифр и символов';
    if (!/[аеёиоуыэюяіaeiouy]/i.test(s) || /(.)\1\1/i.test(s) || /[бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxz]{4,}/i.test(s)) return 'Проверьте, правильно ли написано имя';
    return '';
  }
  function phoneError(v) {
    const d = v.replace(/\D/g, '');
    if (!d || d === '375') return 'Укажите номер телефона';
    if (d.length < 12) return 'Номер неполный: нужно 9 цифр после +375';
    if (!/^375(25|29|33|44|1\d|2\d)/.test(d)) return 'Проверьте код оператора: 25, 29, 33 или 44';
    return '';
  }
  // +375 (29) 123-45-67; a local 80… prefix becomes 375
  function formatPhone(raw) {
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('80')) d = '375' + d.slice(2);
    else if (d && !d.startsWith('375') && !'375'.startsWith(d)) d = '375' + d;
    d = d.slice(0, 12);
    if (!d) return '';
    let out = '+' + d.slice(0, 3);
    if (d.length > 3) out += ' (' + d.slice(3, 5);
    if (d.length >= 5) out += ')';
    if (d.length > 5) out += ' ' + d.slice(5, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    if (d.length > 10) out += '-' + d.slice(10, 12);
    return out;
  }

  // Validates the form's "name" and "phone" inputs. An error shows once the field was left filled in,
  // or after a submit attempt; its box is the element named by the input's aria-describedby.
  function bind(form, onSend) {
    const fields = { name: form.elements.name, phone: form.elements.phone };
    const check = { name: nameError, phone: phoneError };
    const touched = { name: false, phone: false };
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
    fields.phone.addEventListener('input', () => { fields.phone.value = formatPhone(fields.phone.value); show(); });
    Object.keys(fields).forEach((k) => fields[k].addEventListener('blur', () => { if (fields[k].value) touched[k] = true; show(); }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = Object.keys(fields).find((k) => check[k](fields[k].value));
      if (bad) { tried = true; show(); fields[bad].focus(); return; }
      onSend();
    });
  }

  return { bind };
})();
