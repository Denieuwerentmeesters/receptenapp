/*
 * Taalkeuze voor privacy.html, voorwaarden.html en support.html.
 * Nederlands is de standaard; #en in het adres of een toestel dat niet op
 * Nederlands staat geeft Engels. De knoppen zetten de keuze in het adres,
 * zodat je een link naar de Engelse versie kunt delen (…/privacy.html#en).
 */
(function () {
  function kies(taal) {
    document.documentElement.setAttribute('data-taal', taal)
    document.documentElement.lang = taal
  }
  function uitAdres() {
    var hash = location.hash.replace('#', '')
    if (hash === 'en' || hash === 'nl') return hash
    return /^nl/i.test(navigator.language || 'nl') ? 'nl' : 'en'
  }
  kies(uitAdres())
  window.addEventListener('hashchange', function () { kies(uitAdres()) })
  document.addEventListener('click', function (e) {
    var knop = e.target.closest && e.target.closest('[data-kies]')
    if (!knop) return
    history.replaceState(null, '', '#' + knop.getAttribute('data-kies'))
    kies(knop.getAttribute('data-kies'))
  })
})()
