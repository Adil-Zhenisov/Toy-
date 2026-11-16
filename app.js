(() => {
  'use strict';

  const config = window.INVITATION_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const isFilled = (value) => typeof value === 'string' && value.trim() !== '' && !/\[[^\]]*\]/.test(value);
  const setStatus = (element, message) => {
    if (element) {
      element.textContent = message;
      element.hidden = !message;
    }
  };

  document.querySelectorAll('[data-config]').forEach((element) => {
    const value = config[element.dataset.config];
    if (typeof value === 'string') element.textContent = value;
  });

  const portrait = $('#portrait-img');
  const portraitPlaceholder = $('#portrait-placeholder');
  if (portrait && isFilled(config.portraitUrl)) {
    try {
      const url = new URL(config.portraitUrl, document.baseURI);
      if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw new Error('Invalid image URL');
      portrait.addEventListener('load', () => {
        portrait.hidden = false;
        if (portraitPlaceholder) portraitPlaceholder.hidden = true;
      });
      portrait.addEventListener('error', () => {
        portrait.hidden = true;
        if (portraitPlaceholder) portraitPlaceholder.hidden = false;
      });
      portrait.alt = isFilled(config.fullName) ? config.fullName : 'Той иесінің портреті';
      portrait.src = url.href;
    } catch {
      portrait.hidden = true;
    }
  }

  // Convert the configured Almaty wall-clock time to one exact instant.
  // Intl uses the IANA timezone database, including historic offset changes.
  function eventTimestamp(dateValue, timeValue) {
    if (typeof dateValue !== 'string' || typeof timeValue !== 'string') return null;
    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
    const time = /^(\d{2}):(\d{2})$/.exec(timeValue);
    if (!date || !time) return null;
    const [year, month, day] = date.slice(1).map(Number);
    const [hour, minute] = time.slice(1).map(Number);
    if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
    const wallTime = Date.UTC(year, month - 1, day, hour, minute);
    const check = new Date(wallTime);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      });
      let timestamp = wallTime;
      for (let attempt = 0; attempt < 3; attempt++) {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
        const displayedWallTime = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
        const adjustment = wallTime - displayedWallTime;
        timestamp += adjustment;
        if (!adjustment) return timestamp;
      }
      return null;
    } catch {
      // Kazakhstan uses UTC+05:00 for current and future invitations.
      return wallTime - 5 * 60 * 60 * 1000;
    }
  }

  const target = eventTimestamp(config.eventDate, config.eventTime);
  const countdownGrid = $('#countdown-grid');
  const countdownMessage = $('#countdown-message');
  const countdownNote = $('#countdown-note');
  let countdownInterval;
  function updateCountdown() {
    if (target === null) {
      document.querySelectorAll('[data-count]').forEach((element) => { element.textContent = '—'; });
      setStatus(countdownNote, 'Той күні нақтылануда');
      if (countdownMessage) countdownMessage.hidden = true;
      return;
    }
    const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
    if (remaining <= 0) {
      if (countdownGrid) countdownGrid.hidden = true;
      setStatus(countdownMessage, 'Қош келдіңіздер!');
      setStatus(countdownNote, '');
      clearInterval(countdownInterval);
      return;
    }
    const values = {
      days: Math.floor(remaining / 86400),
      hours: Math.floor(remaining % 86400 / 3600),
      minutes: Math.floor(remaining % 3600 / 60),
      seconds: remaining % 60
    };
    Object.entries(values).forEach(([key, value]) => {
      const element = $(`[data-count="${key}"]`);
      if (element) element.textContent = String(value).padStart(2, '0');
    });
    setStatus(countdownNote, '');
  }
  updateCountdown();
  if (target !== null && target > Date.now()) countdownInterval = setInterval(updateCountdown, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateCountdown(); });

  const mapLink = $('#map-link');
  const mapStatus = $('#map-status');
  let mapUrl = null;
  if (isFilled(config.mapUrl)) {
    try {
      const parsed = new URL(config.mapUrl);
      if (['http:', 'https:'].includes(parsed.protocol)) mapUrl = parsed.href;
    } catch { /* Leave the placeholder inactive until a complete URL is supplied. */ }
  }
  if (mapLink) {
    if (mapUrl) {
      mapLink.href = mapUrl;
      mapLink.target = '_blank';
      mapLink.rel = 'noopener noreferrer';
    } else {
      mapLink.removeAttribute('href');
      mapLink.setAttribute('role', 'button');
      mapLink.tabIndex = 0;
      const explainMap = (event) => {
        event.preventDefault();
        setStatus(mapStatus, 'Карта сілтемесі жақында қосылады.');
      };
      mapLink.addEventListener('click', explainMap);
      mapLink.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') explainMap(event);
      });
    }
  }

  const form = $('#rsvp-form');
  const guestCountField = $('#guest-count-field');
  const rsvpStatus = $('#rsvp-status');
  if (form) {
    const guestName = form.elements.namedItem('guestName');
    const guestCount = form.elements.namedItem('guestCount');
    const selectedAttendance = () => form.querySelector('input[name="attendance"]:checked')?.value;
    function updateAttendance() {
      const attending = selectedAttendance() === 'yes';
      if (guestCountField) guestCountField.hidden = !attending;
      if (guestCount) {
        guestCount.disabled = !attending;
        guestCount.required = attending;
        guestCount.setCustomValidity('');
      }
      setStatus(rsvpStatus, '');
    }
    form.querySelectorAll('[name="attendance"]').forEach((input) => input.addEventListener('change', updateAttendance));
    guestName?.addEventListener('input', () => guestName.setCustomValidity(''));
    guestCount?.addEventListener('input', () => guestCount.setCustomValidity(''));
    updateAttendance();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      setStatus(rsvpStatus, '');
      const name = guestName?.value.trim() || '';
      guestName?.setCustomValidity(name ? '' : 'Аты-жөніңізді жазыңыз.');
      const attending = selectedAttendance() === 'yes';
      const count = Number(guestCount?.value);
      if (attending && guestCount) {
        guestCount.setCustomValidity(Number.isInteger(count) && count >= 1 && count <= 50 ? '' : 'Адам санын 1 мен 50 аралығында көрсетіңіз.');
      }
      if (!form.reportValidity()) return;
      const rawNumber = typeof config.whatsappNumber === 'string' ? config.whatsappNumber.trim() : '';
      const number = rawNumber.replace(/[\s()+-]/g, '');
      if (!isFilled(rawNumber) || !/^\d{8,15}$/.test(number)) {
        setStatus(rsvpStatus, 'WhatsApp нөмірі жақында қосылады. Жауабыңызды той иелеріне тікелей хабарлауға болады.');
        return;
      }
      const lines = [
        'Зейнет тойға шақыруға жауап',
        `Аты-жөнім: ${name}`,
        `Қатысуым: ${attending ? 'Келемін' : 'Өкінішке қарай, келе алмаймын'}`
      ];
      if (attending) lines.push(`Келетін адам саны: ${count}`);
      if (isFilled(config.fullName)) lines.push(`Той иесі: ${config.fullName}`);
      if (isFilled(config.eventDateLabel)) lines.push(`Той күні: ${config.eventDateLabel}`);
      const url = `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`;
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus(rsvpStatus, 'WhatsApp-та дайын хабарламаны тексеріп, жіберіңіз.');
    });
  }

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px 24px 0px' });
    document.querySelectorAll('.reveal').forEach((element) => {
      element.classList.add('will-reveal');
      observer.observe(element);
    });
  }
})();
