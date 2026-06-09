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

function getTableLabels(table) {
  return Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (th) {
    return cleanHeaderLabel(th.textContent);
  });
}

function getTradeTable() {
  var tables = Array.prototype.slice.call(document.querySelectorAll('table'));
  return tables.find(function (table) {
    var headers = getTableLabels(table);
    return headers[0] === '날짜' &&
      headers.indexOf('종목명') >= 0 &&
      headers.indexOf('코드') >= 0 &&
      headers.indexOf('구분') >= 0 &&
      headers.indexOf('관리') >= 0;
  });
}

function getHoldingTables() {
  var tables = Array.prototype.slice.call(document.querySelectorAll('table'));
  return tables.filter(function (table) {
    var headers = getTableLabels(table);
    return headers[0] === '종목명' &&
      headers.indexOf('코드') >= 0 &&
      headers.indexOf('보유수량') >= 0 &&
      headers.indexOf('평균단가') >= 0 &&
      headers.indexOf('현재가 입력') >= 0 &&
      headers.indexOf('평가금액') >= 0 &&
      headers.indexOf('관리') < 0;
  });
}

function filterableTradeColumn(label) {
  return ['날짜', '종목명', '코드', '구분', '메모'].indexOf(label) >= 0;
}

function sortableTradeColumn(label) {
  return label !== '관리';
}

function filterableHoldingColumn(label) {
  return label !== '현재가 입력';
}

function sortableHoldingColumn(label) {
  return label !== '현재가 입력';
}

function getFilterValueFromCell(cell) {
  var value = normalizeCellText(cell ? cell.textContent : '');
  return value || '-';
}

function applyTableFilters(table, datasetKey) {
  var filters = JSON.parse(table.dataset[datasetKey] || '{}');
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

function sortRows(table, columnIndex, direction, filterDatasetKey) {
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
  applyTableFilters(table, filterDatasetKey);
}

function resetTableFilters(table, datasetKey) {
  table.dataset[datasetKey] = '{}';
  table.querySelectorAll('.thFilterSelect').forEach(function (select) {
    select.value = '';
  });
  table.querySelectorAll('tbody tr').forEach(function (row) {
    row.style.display = '';
  });
}

function cleanupResetButtons(card, markerClass) {
  var buttons = Array.prototype.slice.call(card.querySelectorAll('.tableResetButton.' + markerClass));
  buttons.slice(1).forEach(function (button) { button.remove(); });
  return buttons[0] || null;
}

function placeResetButton(table, options) {
  var card = table.closest('.card');
  if (!card) return;

  var existingButton = cleanupResetButtons(card, options.markerClass);
  if (existingButton) return;

  var resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'tableResetButton ' + options.markerClass;
  resetButton.textContent = '필터 초기화';
  resetButton.addEventListener('click', function () {
    resetTableFilters(table, options.filterDatasetKey);
  });

  var rowHeader = card.querySelector('.row.between');
  if (rowHeader) {
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
    return;
  }

  var existingTitleRow = Array.prototype.slice.call(card.children).find(function (node) {
    return node.classList && node.classList.contains('cardTitleRow');
  });
  if (existingTitleRow) {
    existingTitleRow.appendChild(resetButton);
    return;
  }

  var h2 = Array.prototype.slice.call(card.children).find(function (node) { return node.tagName === 'H2'; });
  if (h2) {
    var titleRow = document.createElement('div');
    titleRow.className = 'cardTitleRow';
    card.insertBefore(titleRow, h2);
    titleRow.appendChild(h2);
    titleRow.appendChild(resetButton);
  }
}

function enhanceTable(table, options) {
  var headerCells = Array.prototype.slice.call(table.querySelectorAll('thead th'));
  var labels = headerCells.map(function (th) { return cleanHeaderLabel(th.textContent); });
  var rowCount = table.querySelectorAll('tbody tr').length;
  var signature = labels.join('|') + ':' + rowCount;

  if (table.dataset[options.enhancedKey] === 'true' && table.dataset[options.signatureKey] === signature) {
    placeResetButton(table, options);
    return;
  }

  table.dataset[options.enhancedKey] = 'true';
  table.dataset[options.signatureKey] = signature;
  table.dataset[options.filterDatasetKey] = '{}';

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
    button.textContent = options.isSortable(label) ? label + ' ↕' : label;

    if (options.isSortable(label)) {
      button.title = '클릭하면 정렬됩니다';
      button.addEventListener('click', function () {
        var currentColumn = Number(table.dataset[options.sortColumnKey] || -1);
        var currentDirection = table.dataset[options.sortDirectionKey] || 'desc';
        var nextDirection = currentColumn === columnIndex && currentDirection === 'asc' ? 'desc' : 'asc';

        table.dataset[options.sortColumnKey] = String(columnIndex);
        table.dataset[options.sortDirectionKey] = nextDirection;

        table.querySelectorAll('.thSortButton').forEach(function (item) {
          var base = item.dataset.label || cleanHeaderLabel(item.textContent);
          item.textContent = options.isSortable(base) ? base + ' ↕' : base;
        });
        button.textContent = label + (nextDirection === 'asc' ? ' ↑' : ' ↓');
        sortRows(table, columnIndex, nextDirection, options.filterDatasetKey);
      });
    }

    th.appendChild(button);

    if (options.isFilterable(label) && values.length > 1 && values.length <= 120) {
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
        var filters = JSON.parse(table.dataset[options.filterDatasetKey] || '{}');
        if (select.value) filters[columnIndex] = select.value;
        else delete filters[columnIndex];
        table.dataset[options.filterDatasetKey] = JSON.stringify(filters);
        applyTableFilters(table, options.filterDatasetKey);
      });

      th.appendChild(select);
    }
  });

  placeResetButton(table, options);
}

function enhanceTradesTable() {
  var table = getTradeTable();
  if (!table) return;
  enhanceTable(table, {
    enhancedKey: 'tradeExcelEnhanced',
    signatureKey: 'tradeExcelSignature',
    filterDatasetKey: 'tradeFilters',
    sortColumnKey: 'tradeSortColumn',
    sortDirectionKey: 'tradeSortDirection',
    markerClass: 'tradeFilterResetButton',
    isFilterable: filterableTradeColumn,
    isSortable: sortableTradeColumn
  });
}

function enhanceHoldingTables() {
  getHoldingTables().forEach(function (table, index) {
    enhanceTable(table, {
      enhancedKey: 'holdingExcelEnhanced',
      signatureKey: 'holdingExcelSignature',
      filterDatasetKey: 'holdingFilters',
      sortColumnKey: 'holdingSortColumn',
      sortDirectionKey: 'holdingSortDirection',
      markerClass: 'holdingFilterResetButton' + index,
      isFilterable: filterableHoldingColumn,
      isSortable: sortableHoldingColumn
    });
  });
}

function enhancePortfolioTables() {
  enhanceTradesTable();
  enhanceHoldingTables();
}

var portfolioExcelTimer = null;
function schedulePortfolioTablesEnhance() {
  window.clearTimeout(portfolioExcelTimer);
  portfolioExcelTimer = window.setTimeout(enhancePortfolioTables, 120);
  [260, 650, 1200].forEach(function (delay) {
    window.setTimeout(enhancePortfolioTables, delay);
  });
}

window.addEventListener('load', function () {
  [250, 700, 1300].forEach(function (delay) {
    window.setTimeout(enhancePortfolioTables, delay);
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.classList) return;
    if (target.classList.contains('tab') || target.classList.contains('btn')) {
      schedulePortfolioTablesEnhance();
    }
  }, true);

  window.addEventListener('focus', schedulePortfolioTablesEnhance);
  window.addEventListener('pageshow', schedulePortfolioTablesEnhance);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) schedulePortfolioTablesEnhance();
  });
});
