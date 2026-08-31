window.WC = window.WC || {};
WC.vintages = (function () {
  'use strict';
  var FIRST_YEAR = 2000;

  //          2000 ....................................... 2023
  var tables = {
    'bordeaux':      '543435324553314553554353',
    'burgundy-red':  '332443534445324555543545',
    'burgundy-white':'433454343445434555443454',
    'rhone-north':   '542434534554335545543545',
    'rhone-south':   '542534534553335545542545',
    'piedmont':      '451353545354352453344533',
    'tuscany':       '432534453454334555443545',
    'rioja':         '433453444453435455443544',
    'napa':          '343445434454554553454345',
    'port':          '531425443533315455343545',
    'champagne':     '431534453452435545443445',
    'mosel':         '432435453454334555443545'
  };

  var REGION_TO_TABLE = {
    'bordeaux-left-bank': 'bordeaux', 'bordeaux-right-bank': 'bordeaux',
    'bordeaux-dry-white': 'bordeaux', 'sauternes': 'bordeaux',
    'burgundy-red': 'burgundy-red', 'beaujolais-cru': 'burgundy-red',
    'burgundy-white': 'burgundy-white', 'chablis': 'burgundy-white',
    'rhone-north': 'rhone-north',
    'rhone-south': 'rhone-south', 'cotes-du-rhone': 'rhone-south',
    'barolo': 'piedmont', 'barbaresco': 'piedmont',
    'brunello': 'tuscany', 'chianti-classico': 'tuscany', 'super-tuscan': 'tuscany',
    'rioja': 'rioja', 'ribera-del-duero': 'rioja',
    'napa-cab': 'napa', 'washington-cab': 'napa',
    'port': 'port', 'douro': 'port',
    'champagne': 'champagne',
    'riesling-dry': 'mosel', 'riesling-off-dry': 'mosel'
  };

  function regionKeyToTable(regionKey) {
    return REGION_TO_TABLE[regionKey] || null;
  }

  function rating(regionKey, year) {
    var name = regionKeyToTable(regionKey);
    if (!name) { return 3; }
    var y = parseInt(year, 10);
    if (!y) { return 3; }
    var index = y - FIRST_YEAR;
    var row = tables[name];
    if (index < 0 || index >= row.length) { return 3; }
    return parseInt(row.charAt(index), 10);
  }

  return { FIRST_YEAR: FIRST_YEAR, tables: tables, rating: rating, regionKeyToTable: regionKeyToTable };
})();
