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

function sortHoldingsByValuation() {
  var tables = document.querySelectorAll('table');
  for (var t = 0; t < tables.length; t += 1) {
    var table = tables[t];
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    if (headers.length !== 8) continue;
    if ((headers[0].textContent || '').trim() !== '종목명') continue;

    var tbody = table.querySelector('tbody');
    if (!tbody) continue;

    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    rows.sort(function (a, b) {
      return parseWon(b.children[5] ? b.children[5].textContent : '') - parseWon(a.children[5] ? a.children[5].textContent : '');
    });

    for (var r = 0; r < rows.length; r += 1) {
      tbody.appendChild(rows[r]);
    }
  }
}

function ensureFilterBar(target, id) {
  if (!target || target.querySelector('[data-filter-id="' + id + '"]')) return null;
  var bar = document.createElement('div');
  bar.className = 'filterBar';
  bar.setAttribute('data-filter-id', id);
  return bar;
}

function makeSelect(labelText, options, onChange) {
  var wrap = document.createElement('label');
  wrap.className = 'filterItem';
  var span = document.createElement('span');
  span.textContent = labelText;
  var select = document.createElement('select');
  for (var i = 0; i < options.length; i += 1) {
    var option = document.createElement('option');
    option.value = options[i][0];
    option.textContent = options[i][1];
    select.appendChild(option);
  }
  select.addEventListener('change', onChange);
  wrap.appendChild(span);
  wrap.appendChild(select);
  return { wrap: wrap, select: select };
}

function addHoldingsFilters() {
  var tables = document.querySelectorAll('table');
  for (var t = 0; t < tables.length; t += 1) {
    var table = tables[t];
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    if (headers.length !== 8 || (headers[0].textContent || '').trim() !== '종목명') continue;
    var card = table.closest('.card');
    var title = card ? card.querySelector('h2') : null;
    var bar = ensureFilterBar(card, 'holdings');
    if (!bar) continue;

    var gainFilter = makeSelect('상태', [['all', '전체'], ['profit', '수익'], ['loss', '손실']], function () {
      var value = gainFilter.select.value;
      var rows = table.querySelectorAll('tbody tr');
      for (var r = 0; r < rows.length; r += 1) {
        var gain = parseWon(rows[r].children[6] ? rows[r].children[6].textContent : '');
        var show = value === 'all' || (value === 'profit' && gain >= 0) || (value === 'loss' && gain < 0);
        rows[r].style.display = show ? '' : 'none';
      }
    });

    bar.appendChild(gainFilter.wrap);
    title && title.insertAdjacentElement('afterend', bar);
  }
}

function addTradeFilters() {
  var table = Array.prototype.slice.call(document.querySelectorAll('table')).find(function (candidate) {
    var headers = Array.prototype.slice.call(candidate.querySelectorAll('thead th'));
    return headers.length >= 10 && (headers[0].textContent || '').trim() === '날짜';
  });
  if (!table) return;
  var card = table.closest('.card');
  var headerRow = card ? card.querySelector('.row.between') : null;
  var bar = ensureFilterBar(card, 'trades');
  if (!bar) return;

  var typeSelect = makeSelect('구분', [['all', '전체'], ['buy', '매수'], ['sell', '매도']], apply);
  var accountSelect = makeSelect('계좌', [['all', '전체'], ['regular', '일반'], ['isa', 'ISA']], apply);
  bar.appendChild(typeSelect.wrap);
  bar.appendChild(accountSelect.wrap);
  headerRow && headerRow.insertAdjacentElement('afterend', bar);

  function apply() {
    var rows = table.querySelectorAll('tbody tr');
    for (var r = 0; r < rows.length; r += 1) {
      var cells = rows[r].children;
      var typeText = cells[3] ? cells[3].textContent : '';
      var memoIndex = cells.length >= 11 ? 9 : 8;
      var memoText = cells[memoIndex] ? cells[memoIndex].textContent.toUpperCase() : '';
      var rowType = typeText.indexOf('매도') >= 0 ? 'sell' : 'buy';
      var rowAccount = memoText.indexOf('ISA') >= 0 ? 'isa' : 'regular';
      var showType = typeSelect.select.value === 'all' || typeSelect.select.value === rowType;
      var showAccount = accountSelect.select.value === 'all' || accountSelect.select.value === rowAccount;
      rows[r].style.display = showType && showAccount ? '' : 'none';
    }
  }
}

function addRealizedFilters() {
  var table = Array.prototype.slice.call(document.querySelectorAll('table')).find(function (candidate) {
    var headers = Array.prototype.slice.call(candidate.querySelectorAll('thead th'));
    return headers.length === 7 && (headers[0].textContent || '').trim() === '매도일';
  });
  if (!table) return;
  var card = table.closest('.card');
  var title = card ? card.querySelector('h2') : null;
  var bar = ensureFilterBar(card, 'realized');
  if (!bar) return;

  var resultSelect = makeSelect('결과', [['all', '전체'], ['profit', '수익'], ['loss', '손실']], function () {
    var value = resultSelect.select.value;
    var rows = table.querySelectorAll('tbody tr');
    for (var r = 0; r < rows.length; r += 1) {
      var gain = parseWon(rows[r].children[5] ? rows[r].children[5].textContent : '');
      var show = value === 'all' || (value === 'profit' && gain >= 0) || (value === 'loss' && gain < 0);
      rows[r].style.display = show ? '' : 'none';
    }
  });

  bar.appendChild(resultSelect.wrap);
  title && title.insertAdjacentElement('afterend', bar);
}

function improveMarketChart() {
  var svg = document.querySelector('.marketChart');
  if (!svg || svg.querySelector('.marketGrid')) return;
  var ns = 'http://www.w3.org/2000/svg';
  [14, 29, 44].forEach(function (y) {
    var line = document.createElementNS(ns, 'line');
    line.setAttribute('class', 'marketGrid');
    line.setAttribute('x1', '0');
    line.setAttribute('x2', '220');
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    svg.insertBefore(line, svg.firstChild);
  });

  var card = svg.closest('.marketCard');
  if (card && !card.querySelector('.marketCaption')) {
    var caption = document.createElement('div');
    caption.className = 'marketCaption';
    caption.textContent = '최근 1개월 흐름';
    card.appendChild(caption);
  }
}

function injectLayoutFixStyles() {
  if (document.getElementById('portfolio-layout-fix-style')) return;

  var style = document.createElement('style');
  style.id = 'portfolio-layout-fix-style';
  style.textContent = [
    '.card > h2{padding:2px 14px 0;margin-bottom:14px;}',
    '.card > .tableWrap{margin-top:0;}',
    '.card > .row.between{padding:2px 14px 0;}',
    '.card > .row.between .btn{margin-right:4px;}',
    '.filterBar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:0 14px 14px;}',
    '.filterItem{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#64748b;}',
    '.filterItem select{height:34px;border:1px solid #cbd5e1;border-radius:10px;background:rgba(255,255,255,.9);padding:0 28px 0 10px;font-weight:700;color:#0f172a;}',
    '.marketCard{position:relative;overflow:hidden;}',
    '.marketChart .marketGrid{stroke:rgba(100,116,139,.28);stroke-width:1;vector-effect:non-scaling-stroke;}',
    '.marketCaption{position:absolute;right:24px;bottom:12px;font-size:12px;font-weight:700;color:#64748b;}',
    '@media (max-width:640px){.card > h2{padding:0 4px;margin-bottom:12px;}.card > .row.between{padding:0 4px;}.card > .row.between .btn{margin-right:0;}.filterBar{padding:0 4px 12px}.filterItem{width:100%;justify-content:space-between}.filterItem select{min-width:120px}.marketCaption{right:14px;bottom:8px;font-size:11px;}}'
  ].join('\n');

  document.head.appendChild(style);
}

function closeModalWithEscape(event) {
  if (event.key !== 'Escape') return;
  var modalBg = document.querySelector('.modalBg');
  if (!modalBg) return;
  modalBg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function runDisplayHelpers() {
  injectLayoutFixStyles();
  compactSummaryMetrics();
  addTradeAmountColumn();
  sortHoldingsByValuation();
  addHoldingsFilters();
  addTradeFilters();
  addRealizedFilters();
  improveMarketChart();
}

window.addEventListener('keydown', closeModalWithEscape);
window.addEventListener('load', function () {
  runDisplayHelpers();
  var count = 0;
  var timer = window.setInterval(function () {
    runDisplayHelpers();
    count += 1;
    if (count >= 40) window.clearInterval(timer);
  }, 500);
});
