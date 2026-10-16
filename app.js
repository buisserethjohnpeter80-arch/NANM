document.addEventListener('DOMContentLoaded', function () {
  function activate(button) {
    if (button) button.addEventListener('click', function () { button.textContent = 'It works'; });
  }
  activate(document.getElementById('fallbackBtn'));
  if (window.customElements) {
    customElements.whenDefined('ion-app').then(function () {
      var fallback = document.getElementById('previewFallback');
      var shell = document.querySelector('.ionic-shell');
      if (fallback) fallback.hidden = true;
      if (shell) shell.classList.add('ready');
      activate(document.getElementById('helloBtn'));
    });
  }
});