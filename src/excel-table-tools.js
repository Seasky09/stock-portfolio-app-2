function normalizeCellText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function cleanHeaderLabel(text) {
  return normalizeCellText(text)
    .replace(/\s*[↕↑↓].*$/, '')
    .replace(/전체$/, '')
    .trim();
}

function parseNumberLike(text) {
  var cleaned = normalizeCellText(text).replace(/[^0-9.\-]/g, '');
  var number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function getComparableValue(text) {
  var number = parseNumberLike(text);
  if (number !== null && /[0-9]/.test(String(text))) return number;
  return normalizeCellText(text).toLowerCase();
}

function getTradeTable() {
  var tables = Array.prototype.slice.call(document.querySelectorAll('table'));
  return tables.find(function (table) {
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (th) {
      return cleanHeaderLabel(th.textContent);
    });

    return headers[0] === '날짜' &&
      headers.indexOf('종목명') >= 0 &&
      headers.indexOf('코드') >= 0 &&
      headers.indexOf('구분') >= 0 &&
      headers.indexOf('관리') >= 0;
  });
}

function filterableTradeColumn(label) {
  return ['날짜', '종목명', '코드', '구분', '메모'].indexOf(label) >= 0;
}

function sortableTradeColumn(label) {
  return label !== '관리';
}

function getFilterValueFromCell(cell) {
  var value = normalizeCellText(cell ? cell.textContent : '');
  return value || '-';
}

function applyTradeFilters(table) {
  var filters = JSON.parse(table.dataset.tradeFilters || '{}');
  var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));

  rows.forEach(function (row) {
    var visible = Object.keys(filters).every(function (key) {
      var expected = filters[key];
      if (!expected) return true;
      var cell = row.children[Number(key)];
      return getFilterValueFromCell(cell) === expected;
    });
    row.style.display = visible ? '' : 'none';
  });
}

function sortTradeRows(table, columnIndex, direction) {
  var tbody = table.querySelector('tbody');
  if (!tbody) return;

  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  rows.sort(function (a, b) {
    var av = getComparableValue(a.children[columnIndex] ? a.children[columnIndex].textContent : '');
    var bv = getComparableValue(b.children[columnIndex] ? b.children[columnIndex].textContent : '');

    if (typeof av === 'number' && typeof bv === 'number') {
      return direction === 'asc' ? av - bv : bv - av;
    }

    return direction === 'asc'
      ? String(av).localeCompare(String(bv), 'ko')
      : String(bv).localeCompare(String(av), 'ko');
  });

  rows.forEach(function (row) { tbody.appendChild(row); });
  applyTradeFilters(table);
}

function resetTradeFilters(table) {
  table.dataset.tradeFilters = '{}';
  table.querySelectorAll('.thFilterSelect').forEach(function (select) {
    select.value = '';
  });
  table.querySelectorAll('tbody tr').forEach(function (row) {
    row.style.display = '';
  });
}

function placeTradeResetButton(table) {
  var card = table.closest('.card');
  if (!card || card.querySelector('.tradeFilterResetButton')) return;

  var resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'tableResetButton tradeFilterResetButton';
  resetButton.textContent = '필터 초기화';
  resetButton.addEventListener('click', function () {
    resetTradeFilters(table);
  });

  var rowHeader = card.querySelector('.row.between');
  if (!rowHeader) return;

  var actionGroup = rowHeader.querySelector('.cardHeaderActions');
  if (!actionGroup) {
    actionGroup = document.createElement('div');
    actionGroup.className = 'cardHeaderActions';
    Array.prototype.slice.call(rowHeader.children).forEach(function (child) {
      if (child.tagName === 'BUTTON') actionGroup.appendChild(child);
    });
    rowHeader.appendChild(actionGroup);
  }

  actionGroup.insertBefore(resetButton, actionGroup.firstChild);
}

function enhanceTradesTable() {
  var table = getTradeTable();
  if (!table) return;

  var headerCells = Array.prototype.slice.call(table.querySelectorAll('thead th'));
  var labels = headerCells.map(function (th) { return cleanHeaderLabel(th.textContent); });
  var rowCount = table.querySelectorAll('tbody tr').length;
  var signature = labels.join('|') + ':' + rowCount;

  if (table.dataset.tradeExcelEnhanced === 'true' && table.dataset.tradeExcelSignature === signature) {
    placeTradeResetButton(table);
    return;
  }

  table.dataset.tradeExcelEnhanced = 'true';
  table.dataset.tradeExcelSignature = signature;
  table.dataset.tradeFilters = '{}';

  headerCells.forEach(function (th, columnIndex) {
    var label = labels[columnIndex];
    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    var values = Array.from(new Set(rows.map(function (row) {
      return getFilterValueFromCell(row.children[columnIndex]);
    }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'ko'); });

    th.innerHTML = '';
    th.classList.add('filterableTh');

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'thSortButton';
    button.dataset.label = label;
    button.textContent = sortableTradeColumn(label) ? label + ' ↕' : label;

    if (sortableTradeColumn(label)) {
      button.title = '클릭하면 정렬됩니다';
      button.addEventListener('click', function () {
        var currentColumn = Number(table.dataset.tradeSortColumn || -1);
        var currentDirection = table.dataset.tradeSortDirection || 'desc';
        var nextDirection = currentColumn === columnIndex && currentDirection === 'asc' ? 'desc' : 'asc';

        table.dataset.tradeSortColumn = String(columnIndex);
        table.dataset.tradeSortDirection = nextDirection;

        table.querySelectorAll('.thSortButton').forEach(function (item) {
          var base = item.dataset.label || cleanHeaderLabel(item.textContent);
          item.textContent = sortableTradeColumn(base) ? base + ' ↕' : base;
        });
        button.textContent = label + (nextDirection === 'asc' ? ' ↑' : ' ↓');
        sortTradeRows(table, columnIndex, nextDirection);
      });
    }

    th.appendChild(button);

    if (filterableTradeColumn(label) && values.length > 1 && values.length <= 120) {
      var select = document.createElement('select');
      select.className = 'thFilterSelect';
      select.title = label + ' 필터';

      var allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = '전체';
      select.appendChild(allOption);

      values.forEach(function (value) {
        var option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      select.addEventListener('click', function (event) { event.stopPropagation(); });
      select.addEventListener('change', function () {
        var filters = JSON.parse(table.dataset.tradeFilters || '{}');
        if (select.value) filters[columnIndex] = select.value;
        else delete filters[columnIndex];
        table.dataset.tradeFilters = JSON.stringify(filters);
        applyTradeFilters(table);
      });

      th.appendChild(select);
    }
  });

  placeTradeResetButton(table);
}

var tradeExcelTimer = null;
function scheduleTradesTableEnhance() {
  window.clearTimeout(tradeExcelTimer);
  tradeExcelTimer = window.setTimeout(enhanceTradesTable, 120);
  [260, 650, 1200].forEach(function (delay) {
    window.setTimeout(enhanceTradesTable, delay);
  });
}

window.addEventListener('load', function () {
  [250, 700, 1300].forEach(function (delay) {
    window.setTimeout(enhanceTradesTable, delay);
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.classList) return;
    if (target.classList.contains('tab') || target.classList.contains('btn')) {
      scheduleTradesTableEnhance();
    }
  }, true);

  window.addEventListener('focus', scheduleTradesTableEnhance);
  window.addEventListener('pageshow', scheduleTradesTableEnhance);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) scheduleTradesTableEnhance();
  });
});
