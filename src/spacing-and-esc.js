window.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') return;

  var modalBg = document.querySelector('.modalBg');
  if (!modalBg) return;

  modalBg.click();
});
