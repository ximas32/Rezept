/* Login / Registrierung mit E-Mail + Passwort. */
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { auth, configIsPlaceholder } from './firebase.js';
import { ALLOWED_EMAILS } from './config.js';
import { $, toast } from './util.js';

const FEHLER = {
  'auth/invalid-email': 'Diese E-Mail-Adresse sieht nicht gültig aus.',
  'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
  'auth/wrong-password': 'Das Passwort stimmt nicht.',
  'auth/user-not-found': 'Zu dieser E-Mail gibt es noch kein Konto – zuerst registrieren.',
  'auth/email-already-in-use': 'Für diese E-Mail gibt es schon ein Konto – bitte anmelden.',
  'auth/weak-password': 'Das Passwort braucht mindestens 6 Zeichen.',
  'auth/too-many-requests': 'Zu viele Versuche. Bitte ein paar Minuten warten.',
  'auth/network-request-failed': 'Keine Verbindung zum Server.',
  'auth/operation-not-allowed': 'E-Mail/Passwort ist in der Firebase-Console noch nicht aktiviert.'
};

let modeRegister = false;

export function initAuth(onUser) {
  const loginBox = $('#login');
  const form = $('#login-form');
  const errorBox = $('#login-error');
  const submit = $('#login-submit');
  const toggle = $('#login-toggle');
  const resetBtn = $('#login-reset');
  const sub = $('#login-sub');

  if (configIsPlaceholder) {
    $('#boot').classList.add('hidden');
    loginBox.classList.remove('hidden');
    form.classList.add('hidden');
    $('#setup-hint').classList.remove('hidden');
    $('#setup-hint').textContent =
      'Setup fehlt noch: Trage deine Firebase-Zugangsdaten in js/config.js ein. ' +
      'Die Anleitung Schritt für Schritt steht in der README.md im Projektordner.';
    return;
  }

  const showError = (msg) => {
    errorBox.textContent = msg;
    errorBox.classList.toggle('hidden', !msg);
  };

  toggle.addEventListener('click', () => {
    modeRegister = !modeRegister;
    submit.textContent = modeRegister ? 'Konto erstellen' : 'Anmelden';
    toggle.textContent = modeRegister ? 'Ich habe schon ein Konto' : 'Noch kein Konto? Registrieren';
    sub.textContent = modeRegister
      ? 'Erstelle dein Konto – danach seht ihr beide dieselben Rezepte.'
      : 'Melde dich an, um loszulegen.';
    $('#login-password').setAttribute('autocomplete', modeRegister ? 'new-password' : 'current-password');
    showError('');
  });

  resetBtn.addEventListener('click', async () => {
    const email = $('#login-email').value.trim();
    if (!email) return showError('Bitte zuerst die E-Mail-Adresse eintragen.');
    try {
      await sendPasswordResetEmail(auth, email);
      showError('');
      toast('E-Mail zum Zurücksetzen verschickt.');
    } catch (err) {
      showError(FEHLER[err.code] || err.message);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    submit.disabled = true;
    showError('');
    try {
      if (modeRegister) {
        const allow = ALLOWED_EMAILS.map((e) => e.toLowerCase());
        if (allow.length && !allow.includes(email.toLowerCase())) {
          throw new Error(
            'Diese Adresse steht nicht auf eurer Liste. Trage sie in js/config.js ' +
            'und in den Firestore-Regeln ein.'
          );
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      showError(FEHLER[err.code] || err.message || 'Anmeldung fehlgeschlagen.');
    } finally {
      submit.disabled = false;
    }
  });

  onAuthStateChanged(auth, (user) => {
    $('#boot').classList.add('hidden');
    if (user) {
      loginBox.classList.add('hidden');
      $('#app').classList.remove('hidden');
    } else {
      $('#app').classList.add('hidden');
      loginBox.classList.remove('hidden');
      $('#login-password').value = '';
    }
    onUser(user);
  });
}

export function logout() {
  return signOut(auth);
}

export function currentUser() {
  return auth ? auth.currentUser : null;
}
