/* The theme control.

   The page follows the reader's system setting by default, which is right: an artifact is opened
   inside someone else's window and should not argue with it. But a BRAND GUIDE has a second job —
   the light and the dark palette are both part of what is being documented, and a reader on a dark
   machine could not see the paper ground at all. So the control is a specimen switch, not a
   preference: three states, and "Sistem" is the honest default rather than a hidden one.

   `localStorage` is wrapped: a private window or blocked site data throws on access, and a theme is
   never worth a broken page. */
(function () {
  var KEY = 'aesc-brand-tema'
  var order = ['sistem', 'svjetlo', 'tamno']
  var rijec = { sistem: 'Sistem', svjetlo: 'Svjetlo', tamno: 'Tamno' }
  var stanje = 'sistem'
  try { var v = localStorage.getItem(KEY); if (order.indexOf(v) > -1) stanje = v } catch {}

  function primijeni() {
    var d = document.documentElement
    if (stanje === 'sistem') d.removeAttribute('data-theme')
    else d.setAttribute('data-theme', stanje === 'tamno' ? 'dark' : 'light')
    var b = document.getElementById('tema')
    if (b) {
      b.querySelector('.tema-t').textContent = rijec[stanje]
      b.setAttribute('aria-label', 'Tema: ' + rijec[stanje] + '. Kliknite za sljedecu.')
    }
  }
  primijeni()
  // The theme is applied above, before the masthead parses, so there is no flash. The BUTTON does
  // not exist that early, so its label is written again once the document is ready — otherwise a
  // reader returning with "tamno" stored sees a control captioned "Sistem".
  document.addEventListener('DOMContentLoaded', primijeni)

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#tema')
    if (!b) return
    stanje = order[(order.indexOf(stanje) + 1) % order.length]
    try { localStorage.setItem(KEY, stanje) } catch {}
    primijeni()
  })
})()
