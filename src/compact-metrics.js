function compactWonText(text) {
  if (!text || text.indexOf('만 원') >= 0) return text;
  var sign = '';
  var trimmed = text.trim();
  if (trimmed.charAt(0) === '+' || trimmed.charAt(0) === '-') sign = trimmed.charAt(0);
  var numeric = Number(trimmed.replace(/[^0-9.-]/g, ''));
  if (!isFinite(numeric)) return text;
  var abs = Math.abs(numeric);
  if (abs < 10000) return text;
  var man = Math.round(abs / 10000).toLocaleString('ko-KR');
  return sign + man + '만 원';
}

function compactSummaryMetrics() {
  var metrics = document.querySelectorAll('.metric');
  for (var i = 0; i < metrics.length; i += 1) {
    var titleEl = metrics[i].querySelector('.metricTitle');
    var valueEl = metrics[i].querySelector('.metricValue');
    if (!titleEl || !valueEl) continue;

    var title = titleEl.textContent.trim();
    if (title === '평가수익률') continue;

    var original = valueEl.textContent.trim();
    if (original.indexOf('원') < 0) continue;

    var compact = compactWonText(original);
    if (compact !== original) {
      valueEl.setAttribute('title', original);
      valueEl.textContent = compact;
    }
  }
}

function parseWon(text) {
  return Number(String(text || '').replace(/[^0-9.-]/g, '')) || 0;
}

function formatWon(value) {
  return Math.round(value).toLocaleString('ko-KR') + '원';
}

function addTradeAmountColumn() {
  var tables = document.querySelectorAll('table');
  for (var t = 0; t < tables.length; t += 1) {
    var table = tables[t];
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    if (headers.length < 10) continue;
    if ((headers[0].textContent || '').trim() !== '날짜') continue;
    if (headers.some(function (h) { return (h.textContent || '').trim() === '거래금액'; })) continue;

    var amountHead = document.createElement('th');
    amountHead.className = 'right tradeAmountCol moneyCell';
    amountHead.textContent = '거래금액';
    headers[6].parentNode.insertBefore(amountHead, headers[6]);

    var rows = table.querySelectorAll('tbody tr');
    for (var r = 0; r < rows.length; r += 1) {
      var cells = rows[r].children;
      if (cells.length < 10) continue;
      var qty = parseWon(cells[4].textContent);
      var price = parseWon(cells[5].textContent);
      var amount = qty * price;

      cells[5].classList.add('moneyCell');
      cells[6].classList.add('moneyCell');
      cells[7].classList.add('moneyCell');

      var amountCell = document.createElement('td');
      amountCell.className = 'right bold tradeAmountCol moneyCell';
      amountCell.textContent = formatWon(amount);
      cells[6].parentNode.insertBefore(amountCell, cells[6]);
    }
  }
}

function closeModalWithEscape(event) {
  if (event.key !== 'Escape') return;
  var modalBg = document.querySelector('.modalBg');
  if (!modalBg) return;
  modalBg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

window.addEventListener('keydown', closeModalWithEscape);
window.addEventListener('load', function () {
  compactSummaryMetrics();
  addTradeAmountColumn();
  var count = 0;
  var timer = window.setInterval(function () {
    compactSummaryMetrics();
    addTradeAmountColumn();
    count += 1;
    if (count >= 40) window.clearInterval(timer);
  }, 500);
});
