window.addEventListener('keyup', function (event) {
  if (event.key !== 'Escape') return;
  var layer = document.querySelector('.modalBg');
  if (!layer) return;
  layer.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
