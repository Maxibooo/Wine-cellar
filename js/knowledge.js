window.WC = window.WC || {};
WC.knowledge = (function () {
  'use strict';

  // curve: [readyFrom, peakFrom, peakTo, declineFrom] in years after the vintage.
  // Values below are for the "serious" tier; Task 4 scales them by tier.
  var RAW = [
    // key, country, region, style, grapes, curve, tempC, decantMin, glass, pairings
    ['bordeaux-left-bank','France','Bordeaux — Left Bank','red',['Cabernet Sauvignon','Merlot','Cabernet Franc'],[6,10,20,28],[16,18],60,'Bordeaux',['Lamb','Ribeye','Hard cheese']],
    ['bordeaux-right-bank','France','Bordeaux — Right Bank','red',['Merlot','Cabernet Franc'],[5,8,18,25],[16,18],45,'Bordeaux',['Duck','Beef','Mushroom']],
    ['bordeaux-dry-white','France','Bordeaux — Dry White','white',['Sémillon','Sauvignon Blanc'],[2,3,8,12],[9,11],0,'White',['Oysters','Sole','Goat cheese']],
    ['burgundy-red','France','Burgundy — Red','red',['Pinot Noir'],[4,7,15,22],[14,16],30,'Burgundy',['Roast chicken','Salmon','Comté']],
    ['burgundy-white','France','Burgundy — White','white',['Chardonnay'],[3,5,12,18],[11,13],15,'White',['Lobster','Poultry in cream','Gruyère']],
    ['chablis','France','Chablis','white',['Chardonnay'],[2,4,10,15],[9,11],0,'White',['Oysters','Shellfish','Sushi']],
    ['beaujolais-village','France','Beaujolais Villages','red',['Gamay'],[1,1,4,6],[13,15],0,'Burgundy',['Charcuterie','Roast pork','Picnic food']],
    ['beaujolais-cru','France','Beaujolais Cru','red',['Gamay'],[2,4,10,14],[14,16],20,'Burgundy',['Duck','Game birds','Soft cheese']],
    ['rhone-north','France','Northern Rhône','red',['Syrah'],[5,9,18,26],[16,18],60,'Bordeaux',['Venison','Peppered steak','Braised beef']],
    ['rhone-south','France','Southern Rhône','red',['Grenache','Syrah','Mourvèdre'],[4,7,15,22],[15,17],45,'Bordeaux',['Lamb','Cassoulet','Herb-roasted meats']],
    ['cotes-du-rhone','France','Côtes du Rhône','red',['Grenache','Syrah'],[1,2,6,9],[15,17],15,'Bordeaux',['Sausage','Stew','Pizza']],
    ['loire-chenin','France','Loire — Chenin Blanc','white',['Chenin Blanc'],[3,6,18,28],[10,12],15,'White',['Pork','Apple dishes','Aged Comté']],
    ['loire-cabernet-franc','France','Loire — Cabernet Franc','red',['Cabernet Franc'],[3,5,12,18],[14,16],30,'Burgundy',['Charcuterie','Grilled vegetables','Goat cheese']],
    ['loire-sauvignon','France','Loire — Sancerre & Pouilly-Fumé','white',['Sauvignon Blanc'],[1,2,6,9],[8,10],0,'White',['Goat cheese','Asparagus','Shellfish']],
    ['muscadet','France','Muscadet','white',['Melon de Bourgogne'],[1,2,7,10],[8,10],0,'White',['Oysters','Fried fish','Clams']],
    ['alsace','France','Alsace','white',['Riesling','Pinot Gris','Gewurztraminer'],[2,4,12,20],[9,11],0,'White',['Choucroute','Spiced dishes','Munster']],
    ['champagne','France','Champagne','sparkling',['Chardonnay','Pinot Noir','Pinot Meunier'],[3,6,15,22],[8,10],0,'Flute or white',['Oysters','Fried food','Parmesan']],
    ['provence-rose','France','Provence Rosé','rose',['Grenache','Cinsault','Syrah'],[0,1,3,4],[8,10],0,'White',['Salade niçoise','Grilled fish','Tapenade']],
    ['corsica-white','France','Corsica — Vermentino','white',['Vermentino'],[0,1,4,6],[9,11],0,'White',['Grilled fish','Shellfish','Brocciu']],
    ['corsica-rose','France','Corsica — Rosé','rose',['Niellucciu','Sciaccarellu'],[0,1,3,4],[8,10],0,'White',['Charcuterie','Grilled vegetables','Summer salads']],
    ['languedoc','France','Languedoc-Roussillon','red',['Syrah','Grenache','Carignan'],[2,4,10,15],[15,17],30,'Bordeaux',['Grilled lamb','Ratatouille','Sausage']],
    ['languedoc-white','France','Languedoc — White','white',['Clairette','Grenache Blanc'],[0,1,4,6],[8,10],0,'White',['Grilled fish','Goat cheese','Herb salads']],
    ['cahors','France','Cahors','red',['Malbec'],[4,7,15,22],[16,18],60,'Bordeaux',['Duck confit','Cassoulet','Hard cheese']],
    ['sud-ouest-white','France','South-West — Côtes de Gascogne','white',['Colombard','Gros Manseng'],[0,1,3,5],[8,10],0,'White',['Seafood','Salads','Apéritif']],
    ['jura','France','Jura','white',['Savagnin','Chardonnay'],[3,6,18,28],[12,14],15,'White',['Comté','Chicken in cream','Curry']],
    ['sauternes','France','Sauternes & Barsac','sweet',['Sémillon','Sauvignon Blanc'],[5,10,30,45],[8,10],0,'Dessert',['Foie gras','Roquefort','Fruit tart']],
    ['rhone-north-white','France','Northern Rhône — White','white',['Viognier','Marsanne','Roussanne'],[2,4,10,16],[11,13],15,'White',['Scallops','Roast chicken','Apricot dishes']],
    ['rhone-south-white','France','Southern Rhône — White','white',['Grenache Blanc','Clairette','Roussanne'],[1,2,6,10],[10,12],0,'White',['Grilled fish','Aioli','Goat cheese']],
    ['cremant','France','Crémant','sparkling',['Chardonnay','Chenin Blanc','Pinot Noir'],[1,2,6,9],[8,10],0,'Flute or white',['Apéritif','Fried fish','Soft cheese']],
    ['bandol','France','Bandol — Red','red',['Mourvèdre','Grenache','Cinsault'],[7,12,22,30],[16,18],90,'Bordeaux',['Daube provençale','Grilled lamb','Game']],
    ['madiran','France','Madiran','red',['Tannat','Cabernet Franc'],[7,11,22,30],[16,18],90,'Bordeaux',['Duck confit','Garbure','Hard cheese']],
    ['bergerac-red','France','Bergerac — Red','red',['Merlot','Cabernet Franc','Cabernet Sauvignon'],[2,4,10,15],[15,17],30,'Bordeaux',['Roast lamb','Duck','Mushroom']],
    ['banyuls-maury','France','Banyuls & Maury','fortified',['Grenache Noir','Grenache Gris'],[3,8,30,50],[14,16],0,'Port',['Dark chocolate','Roquefort','Cherry desserts']],
    ['rivesaltes','France','Rivesaltes','fortified',['Grenache','Macabeu'],[3,10,40,60],[14,16],0,'Copita',['Walnuts','Aged cheese','Crème brûlée']],
    ['alsace-vt','France','Alsace — Vendanges Tardives','sweet',['Gewurztraminer','Pinot Gris','Riesling'],[4,8,25,38],[8,10],0,'Dessert',['Foie gras','Munster','Spiced desserts']],
    ['jurancon','France','Jurançon — Moelleux','sweet',['Petit Manseng','Gros Manseng'],[4,9,28,42],[8,10],0,'Dessert',['Foie gras','Blue cheese','Peach tart']],
    ['provence-red','France','Provence — Red','red',['Grenache','Syrah','Cabernet Sauvignon'],[3,5,12,18],[15,17],30,'Bordeaux',['Daube','Grilled lamb','Ratatouille']],
    ['provence-white','France','Provence — White','white',['Rolle','Clairette','Ugni Blanc'],[0,1,4,6],[8,10],0,'White',['Grilled fish','Bouillabaisse','Tapenade']],
    ['corsica-red','France','Corsica — Red','red',['Niellucciu','Sciaccarellu'],[2,4,10,15],[15,17],30,'Burgundy',['Wild boar','Lamb','Sheep cheese']],
    ['savoie','France','Savoie — Jacquère','white',['Jacquère'],[0,1,3,5],[8,10],0,'White',['Fondue','Raclette','Freshwater fish']],
    ['vouvray-sparkling','France','Vouvray — Sparkling','sparkling',['Chenin Blanc'],[2,3,10,15],[8,10],0,'Flute or white',['Oysters','Pork rillettes','Apple tart']],
    ['loire-rose','France','Loire — Rosé','rose',['Cabernet Franc','Grolleau'],[0,1,3,4],[8,10],0,'White',['Charcuterie','Melon','Summer salads']],
    ['maconnais','France','Mâconnais','white',['Chardonnay'],[1,3,8,12],[10,12],0,'White',['Roast chicken','Goat cheese','White fish']],
    ['cote-chalonnaise-red','France','Côte Chalonnaise — Red','red',['Pinot Noir'],[2,4,10,15],[14,16],20,'Burgundy',['Roast chicken','Charcuterie','Mushroom']],
    ['cote-chalonnaise-white','France','Côte Chalonnaise — White','white',['Chardonnay'],[2,3,9,13],[10,12],0,'White',['Poultry','White fish','Comté']],
    ['gaillac','France','Gaillac — Red','red',['Braucol','Duras','Syrah'],[2,3,8,12],[15,17],20,'Bordeaux',['Sausage','Grilled meats','Tomme']],
    ['fronton','France','Fronton','red',['Négrette','Syrah'],[1,2,6,9],[14,16],0,'Burgundy',['Charcuterie','Grilled pork','Duck rillettes']],
    ['irouleguy','France','Irouléguy — Red','red',['Tannat','Cabernet Franc'],[3,6,12,18],[16,18],45,'Bordeaux',['Grilled lamb','Piperade','Ossau-Iraty']],
    ['barolo','Italy','Barolo','red',['Nebbiolo'],[8,12,25,35],[16,18],90,'Burgundy',['Truffle','Braised beef','Aged cheese']],
    ['barbaresco','Italy','Barbaresco','red',['Nebbiolo'],[6,10,22,30],[16,18],60,'Burgundy',['Risotto','Veal','Mushroom']],
    ['piedmont-barbera','Italy','Monferrato — Barbera','red',['Barbera'],[1,3,8,12],[15,17],30,'Burgundy',['Pasta with ragù','Salumi','Risotto']],
    ['brunello','Italy','Brunello di Montalcino','red',['Sangiovese'],[6,10,22,30],[16,18],60,'Bordeaux',['Bistecca','Wild boar','Pecorino']],
    ['chianti-classico','Italy','Chianti Classico','red',['Sangiovese'],[3,5,12,18],[16,18],30,'Bordeaux',['Tomato pasta','Grilled meats','Pecorino']],
    ['vino-nobile','Italy','Vino Nobile di Montepulciano','red',['Sangiovese'],[4,6,15,22],[16,18],45,'Bordeaux',['Roast pork','Grilled beef','Pecorino']],
    ['super-tuscan','Italy','Bolgheri & Super Tuscan','red',['Cabernet Sauvignon','Merlot','Sangiovese'],[5,8,18,25],[16,18],60,'Bordeaux',['Steak','Lamb','Aged cheese']],
    ['amarone','Italy','Amarone della Valpolicella','red',['Corvina','Rondinella'],[5,9,20,28],[16,18],60,'Bordeaux',['Braised meat','Risotto','Hard cheese']],
    ['valpolicella','Italy','Valpolicella Classico','red',['Corvina'],[1,2,6,9],[15,17],15,'Burgundy',['Pizza','Pasta','Cured meats']],
    ['etna-rosso','Italy','Etna Rosso','red',['Nerello Mascalese'],[3,5,14,20],[15,17],30,'Burgundy',['Grilled fish','Pork','Aubergine']],
    ['puglia-primitivo','Italy','Puglia — Primitivo','red',['Primitivo'],[1,2,7,10],[16,18],30,'Bordeaux',['Grilled red meat','Aged cheese','Spiced stews']],
    ['abruzzo-white','Italy','Abruzzo — Pecorino','white',['Pecorino'],[1,2,6,9],[9,11],0,'White',['Seafood','White fish','Vegetable antipasti']],
    ['soave','Italy','Soave','white',['Garganega'],[1,2,6,9],[9,11],0,'White',['Risotto','White fish','Asparagus']],
    ['prosecco','Italy','Prosecco','sparkling',['Glera'],[0,1,3,4],[6,8],0,'Flute or white',['Aperitivo','Prosciutto','Fruit']],
    // The Italy batch. A region label carries a style suffix wherever the
    // appellation name itself is shared across styles: Bardolino is a red and
    // the Chiaretto rosé, Lambrusco is dry and sweet, Franciacorta has a
    // rosé, and Montepulciano d'Abruzzo shares both its region and its
    // grape with Cerasuolo. get() matches a region key before it ever looks at
    // style, so an ambiguous label is a wrong drinking window the owner has no
    // way to correct.
    ['dolcetto','Italy','Dolcetto d\'Alba','red',['Dolcetto'],[1,2,6,8],[15,17],15,'Burgundy',['Salumi','Pasta with ragù','Roast pork','Tomino']],
    ['nero-davola','Italy','Sicily — Nero d\'Avola (Red)','red',['Nero d\'Avola'],[2,4,10,15],[16,18],30,'Bordeaux',['Grilled lamb','Aubergine','Sausage','Aged cheese']],
    ['aglianico','Italy','Taurasi & Aglianico del Vulture','red',['Aglianico'],[7,11,22,30],[16,18],90,'Bordeaux',['Braised beef','Wild boar','Lamb','Aged cheese']],
    ['sagrantino','Italy','Montefalco Sagrantino','red',['Sagrantino'],[10,14,26,34],[16,18],120,'Bordeaux',['Braised beef','Wild boar','Game','Aged pecorino']],
    ['chianti','Italy','Chianti — Non-Classico','red',['Sangiovese'],[2,3,8,12],[16,18],15,'Bordeaux',['Tomato pasta','Pizza','Salumi','Pecorino']],
    ['montepulciano-dabruzzo','Italy','Abruzzo — Montepulciano (Red)','red',['Montepulciano'],[2,4,10,15],[16,18],30,'Bordeaux',['Grilled lamb','Tomato pasta','Sausage','Aged pecorino']],
    ['salice-salentino','Italy','Salice Salentino — Red','red',['Negroamaro'],[2,4,10,14],[16,18],30,'Bordeaux',['Orecchiette','Braised pork','Grilled lamb','Aged cheese']],
    ['bardolino','Italy','Bardolino — Red','red',['Corvina','Rondinella','Molinara'],[1,2,5,7],[14,16],0,'Burgundy',['Pizza','Lake fish','Salumi','Risotto']],
    ['gavi','Italy','Gavi','white',['Cortese'],[1,3,8,12],[9,11],0,'White',['Seafood risotto','Fried fish','Veal','Goat cheese']],
    ['verdicchio','Italy','Verdicchio dei Castelli di Jesi & Matelica','white',['Verdicchio'],[1,3,9,14],[9,11],0,'White',['Brodetto','Shellfish','Roast fish','White fish']],
    ['alto-adige-white','Italy','Alto Adige — White','white',['Pinot Bianco','Sauvignon Blanc','Gewürztraminer'],[1,3,9,14],[9,11],0,'White',['Trout','Speck','Asparagus','Alpine cheese']],
    ['friuli-white','Italy','Friuli — White','white',['Friulano','Pinot Grigio','Ribolla Gialla'],[1,2,7,10],[9,11],0,'White',['Prosciutto','White fish','Frico','Risotto']],
    ['vermentino-sardegna','Italy','Sardinia — Vermentino','white',['Vermentino'],[0,1,4,6],[9,11],0,'White',['Grilled fish','Shellfish','Fregola','Bottarga']],
    ['bardolino-chiaretto','Italy','Bardolino — Chiaretto Rosé','rose',['Corvina','Rondinella'],[0,1,3,4],[8,10],0,'White',['Lake fish','Grilled vegetables','Prosciutto','Summer salads']],
    ['cerasuolo-abruzzo','Italy','Abruzzo — Cerasuolo Rosé','rose',['Montepulciano'],[0,1,4,6],[10,12],0,'White',['Grilled fish','Charcuterie','Tomato pasta','Arrosticini']],
    ['franciacorta','Italy','Franciacorta — Sparkling (incl. Rosé)','sparkling',['Chardonnay','Pinot Bianco','Pinot Nero'],[2,4,11,16],[8,10],0,'Flute or white',['Oysters','Risotto','Prosciutto','Parmigiano']],
    ['moscato-dasti','Italy','Moscato d\'Asti','sparkling',['Moscato Bianco'],[0,0,1,2],[6,8],0,'Flute or white',['Fresh peaches','Panettone','Almond biscotti','Fruit salad']],
    ['lambrusco-secco','Italy','Lambrusco — Dry (Secco)','sparkling',['Lambrusco Grasparossa','Lambrusco Salamino','Lambrusco di Sorbara'],[0,0,2,3],[10,12],0,'Flute or white',['Salumi','Parmigiano','Pork ribs','Tigelle']],
    ['lambrusco-dolce','Italy','Lambrusco — Sweet (Amabile & Dolce)','sparkling',['Lambrusco Salamino','Lambrusco Marani'],[0,0,2,3],[8,10],0,'Flute or white',['Panettone','Berries','Fruit tart']],
    ['rioja','Spain','Rioja','red',['Tempranillo','Garnacha'],[4,7,16,24],[16,18],45,'Bordeaux',['Roast lamb','Chorizo','Manchego']],
    ['ribera-del-duero','Spain','Ribera del Duero','red',['Tempranillo'],[5,8,18,25],[16,18],60,'Bordeaux',['Roast suckling pig','Beef','Aged cheese']],
    ['priorat','Spain','Priorat','red',['Garnacha','Cariñena'],[5,9,20,28],[16,18],60,'Bordeaux',['Game','Grilled lamb','Strong cheese']],
    ['terra-alta','Spain','Terra Alta — Garnacha','red',['Garnacha'],[2,4,10,15],[15,17],30,'Bordeaux',['Grilled lamb','Rice dishes','Hard cheese']],
    ['rias-baixas','Spain','Rías Baixas','white',['Albariño'],[1,2,6,9],[8,10],0,'White',['Shellfish','Octopus','Ceviche']],
    ['cava','Spain','Cava','sparkling',['Macabeo','Xarel·lo','Parellada'],[1,2,6,9],[6,8],0,'Flute or white',['Tapas','Fried fish','Croquetas']],
    ['sherry','Spain','Jerez — Sherry','fortified',['Palomino','Pedro Ximénez'],[0,1,8,15],[7,13],0,'Copita',['Almonds','Jamón','Olives']],
    ['douro','Portugal','Douro','red',['Touriga Nacional','Touriga Franca'],[4,8,18,26],[16,18],60,'Bordeaux',['Grilled meats','Stews','Hard cheese']],
    ['port','Portugal','Port — Vintage','fortified',['Touriga Nacional','Touriga Franca'],[10,20,45,60],[16,18],120,'Port',['Stilton','Walnuts','Dark chocolate']],
    ['madeira','Portugal','Madeira','fortified',['Verdelho','Sercial','Bual'],[5,15,60,90],[13,16],0,'Copita',['Consommé','Almond cake','Aged cheese']],
    ['vinho-verde','Portugal','Vinho Verde','white',['Loureiro','Alvarinho'],[0,1,3,4],[7,9],0,'White',['Sardines','Salad','Fried fish']],
    ['riesling-dry','Germany','Germany — Dry Riesling','white',['Riesling'],[2,4,12,20],[9,11],0,'White',['Trout','Pork','Asian food']],
    ['riesling-off-dry','Germany','Mosel — Kabinett & Spätlese','white',['Riesling'],[3,6,20,30],[8,10],0,'White',['Spicy Asian','Charcuterie','Blue cheese']],
    ['spatburgunder','Germany','German Spätburgunder','red',['Pinot Noir'],[3,5,12,18],[14,16],30,'Burgundy',['Roast duck','Mushroom','Veal']],
    ['tokaji','Hungary','Tokaji Aszú','sweet',['Furmint'],[5,10,30,45],[8,10],0,'Dessert',['Foie gras','Blue cheese','Apricot tart']],
    ['gruner','Austria','Grüner Veltliner','white',['Grüner Veltliner'],[1,3,9,14],[9,11],0,'White',['Schnitzel','Asparagus','Herb salads']],
    ['napa-cab','United States','Napa Valley Cabernet','red',['Cabernet Sauvignon'],[5,8,18,25],[16,18],60,'Bordeaux',['Ribeye','Burgers','Aged cheddar']],
    ['sonoma-pinot','United States','Sonoma Coast Pinot Noir','red',['Pinot Noir'],[3,5,12,18],[14,16],30,'Burgundy',['Salmon','Duck','Mushroom']],
    ['oregon-pinot','United States','Willamette Valley Pinot Noir','red',['Pinot Noir'],[3,6,14,20],[14,16],30,'Burgundy',['Salmon','Roast chicken','Beets']],
    ['washington-cab','United States','Washington Cabernet','red',['Cabernet Sauvignon','Merlot'],[4,7,16,22],[16,18],45,'Bordeaux',['Steak','Lamb','Barbecue']],
    ['barossa-shiraz','Australia','Barossa Shiraz','red',['Shiraz'],[4,7,16,24],[16,18],60,'Bordeaux',['Barbecue','Lamb','Strong cheese']],
    ['hunter-semillon','Australia','Hunter Valley Semillon','white',['Sémillon'],[3,7,18,25],[9,11],0,'White',['Fish','Chicken','Citrus dishes']],
    ['marlborough-sb','New Zealand','Marlborough Sauvignon Blanc','white',['Sauvignon Blanc'],[0,1,4,6],[8,10],0,'White',['Goat cheese','Green vegetables','Shellfish']],
    ['central-otago-pinot','New Zealand','Central Otago Pinot Noir','red',['Pinot Noir'],[3,5,13,19],[14,16],30,'Burgundy',['Venison','Duck','Cherry dishes']],
    ['mendoza-malbec','Argentina','Mendoza Malbec','red',['Malbec'],[3,6,14,20],[16,18],45,'Bordeaux',['Grilled beef','Empanadas','Chimichurri']],
    ['chile-cab','Chile','Maipo & Colchagua Cabernet','red',['Cabernet Sauvignon'],[3,6,14,20],[16,18],45,'Bordeaux',['Steak','Beans','Aged cheese']],
    ['stellenbosch-blend','South Africa','Stellenbosch Bordeaux Blend','red',['Cabernet Sauvignon','Merlot'],[4,7,16,22],[16,18],45,'Bordeaux',['Lamb','Braai','Hard cheese']],
    ['sa-chenin','South Africa','South African Chenin Blanc','white',['Chenin Blanc'],[2,3,9,14],[9,11],0,'White',['Pork','Curry','Grilled fish']],
    // The Spain & Portugal batch. Both countries were thin: Spain had no white
    // it could average, and Portugal's only still wines were Douro red and a
    // Vinho Verde white. A region label carries a style suffix wherever the DO
    // name is shared across colours -- Bierzo and Valdeorras each make a Mencía
    // red and a Godello white; Txakoli and Penedès are named for the white
    // being added; Alentejo and Dão are the reds of DOs that also make white;
    // and Vinho Verde already had a white row, so the new red is keyed apart.
    // get() matches a region key before it looks at style, so a bare label
    // would be a drinking window the owner cannot correct.
    ['rueda','Spain','Rueda','white',['Verdejo'],[1,2,5,8],[8,10],0,'White',['Shellfish','Green salads','Goat cheese','White fish']],
    ['bierzo-mencia','Spain','Bierzo — Mencía (Red)','red',['Mencía'],[3,5,12,18],[15,17],30,'Burgundy',['Roast pork','Grilled meats','Mushrooms','Cured ham']],
    ['bierzo-godello','Spain','Bierzo — Godello (White)','white',['Godello'],[1,3,8,12],[9,11],0,'White',['Grilled fish','Poultry','Shellfish','Soft cheese']],
    ['toro','Spain','Toro','red',['Tinta de Toro'],[5,9,20,28],[16,18],90,'Bordeaux',['Roast lamb','Grilled beef','Game','Aged cheese']],
    ['somontano','Spain','Somontano — Red','red',['Moristel','Tempranillo','Cabernet Sauvignon'],[3,5,12,18],[15,17],30,'Bordeaux',['Grilled meats','Roast vegetables','Sausage','Semi-cured cheese']],
    ['txakoli-white','Spain','Txakoli (White)','white',['Hondarrabi Zuri'],[0,1,2,3],[7,9],0,'White',['Anchovies','Grilled sardines','Pintxos','Fried fish']],
    ['jumilla','Spain','Jumilla','red',['Monastrell'],[2,4,10,15],[16,18],30,'Bordeaux',['Grilled lamb','Barbecue','Spiced stews','Aged cheese']],
    ['la-mancha','Spain','La Mancha — Red','red',['Tempranillo'],[1,3,8,11],[15,17],15,'Bordeaux',['Grilled meats','Stews','Chorizo','Manchego']],
    ['penedes-white','Spain','Penedès — White','white',['Xarel·lo','Macabeo','Parellada'],[1,2,6,9],[8,10],0,'White',['Grilled fish','Seafood','Salads','Fresh cheese']],
    ['montsant','Spain','Montsant','red',['Garnacha','Cariñena'],[3,5,14,20],[16,18],45,'Bordeaux',['Grilled lamb','Game','Stews','Strong cheese']],
    ['valdeorras-godello','Spain','Valdeorras — Godello (White)','white',['Godello'],[2,4,10,15],[10,12],0,'White',['Grilled fish','Poultry','Shellfish','Hard cheese']],
    ['alentejo-red','Portugal','Alentejo — Red','red',['Aragonez','Trincadeira','Alicante Bouschet'],[3,5,12,18],[16,18],30,'Bordeaux',['Grilled meats','Roast lamb','Stews','Aged cheese']],
    ['dao-red','Portugal','Dão — Red','red',['Touriga Nacional','Alfrocheiro','Jaen'],[4,7,16,22],[16,18],45,'Bordeaux',['Roast kid','Grilled meats','Game','Hard cheese']],
    ['bairrada','Portugal','Bairrada','red',['Baga'],[5,9,20,30],[16,18],90,'Bordeaux',['Roast suckling pig','Game birds','Braised meat','Aged cheese']],
    ['setubal-moscatel','Portugal','Setúbal — Moscatel','fortified',['Moscatel de Setúbal'],[3,10,50,80],[13,16],0,'Copita',['Dark chocolate','Blue cheese','Dried fruit','Crème brûlée']],
    ['vinho-verde-red','Portugal','Vinho Verde — Red','red',['Vinhão'],[0,1,3,4],[12,14],0,'Burgundy',['Grilled sardines','Charcuterie','Roast pork','Octopus rice']],
    // The Germanic & rest-of-Europe batch -- the thinnest countries in the
    // table. Germany already had two dry/off-dry Riesling whites and a single
    // Spätburgunder red; Austria a lone Grüner; Hungary a lone sweet Tokaji
    // Aszú. Every German row carries a style-bearing label because Pfalz,
    // Rheingau and Baden each make both a dry Riesling and a Spätburgunder, and
    // get() matches a region key before it looks at style, so a bare 'Pfalz'
    // would be a drinking window the owner cannot correct. Dry Furmint is keyed
    // and labelled apart from the sweet Tokaji Aszú for the same reason: both
    // legitimately carry the Furmint grape, so neither is a sole search match,
    // but their labels and decades-apart curves must never be confused.
    // Santorini Assyrtiko is the exception among whites -- a genuinely
    // long-lived, structured mineral white; Chasselas and Fetească are the
    // drink-young rule it breaks.
    ['pfalz-riesling','Germany','Pfalz — Dry Riesling','white',['Riesling'],[2,4,12,20],[9,11],0,'White',['Pork','Schnitzel','Trout','Asian food']],
    ['rheingau-riesling','Germany','Rheingau — Dry Riesling','white',['Riesling'],[3,6,15,24],[9,11],0,'White',['Trout','Roast pork','Poultry','Hard cheese']],
    ['baden-spatburgunder','Germany','Baden — Spätburgunder','red',['Pinot Noir'],[4,7,15,22],[14,16],30,'Burgundy',['Roast duck','Mushroom','Veal','Game birds']],
    ['german-sekt','Germany','German Sekt — Traditional Method','sparkling',['Riesling','Pinot Noir','Chardonnay'],[2,4,10,15],[8,10],0,'Flute or white',['Apéritif','Fried fish','Smoked salmon','Soft cheese']],
    ['blaufraenkisch','Austria','Blaufränkisch','red',['Blaufränkisch'],[3,6,14,20],[15,17],45,'Burgundy',['Venison','Braised beef','Game','Hard cheese']],
    ['austrian-riesling','Austria','Wachau & Kremstal — Riesling','white',['Riesling'],[2,5,13,20],[9,11],0,'White',['Trout','Pork','Poultry','Asian food']],
    ['santorini-assyrtiko','Greece','Santorini — Assyrtiko','white',['Assyrtiko'],[3,7,20,30],[10,12],15,'White',['Grilled octopus','Seafood','Fava','Aged cheese']],
    ['nemea','Greece','Nemea — Agiorgitiko','red',['Agiorgitiko'],[3,5,13,19],[16,18],30,'Bordeaux',['Lamb','Grilled meats','Moussaka','Hard cheese']],
    ['english-sparkling','England','English Sparkling — Traditional Method','sparkling',['Chardonnay','Pinot Noir','Pinot Meunier'],[3,6,15,22],[8,10],0,'Flute or white',['Oysters','Fish and chips','Smoked salmon','Canapés']],
    ['furmint-dry','Hungary','Dry Furmint (Somló & Dry Tokaji)','white',['Furmint','Hárslevelű'],[2,5,14,22],[9,11],15,'White',['Roast pork','Poultry','Smoked fish','Hard cheese']],
    ['feteasca','Romania','Fetească (Regală & Albă)','white',['Fetească Regală','Fetească Albă'],[1,2,6,9],[9,11],0,'White',['Grilled fish','Poultry','Salads','Fresh cheese']],
    ['slovenian-white','Slovenia','Slovenia — White','white',['Rebula','Malvazija','Sauvignon Blanc'],[1,2,7,10],[9,11],0,'White',['Grilled fish','Poultry','Prosciutto','Fresh cheese']],
    ['swiss-chasselas','Switzerland','Swiss Chasselas (Fendant)','white',['Chasselas'],[1,2,6,9],[9,11],0,'White',['Fondue','Raclette','Freshwater fish','Charcuterie']],
    ['lebanese-red','Lebanon','Bekaa Valley — Red','red',['Cabernet Sauvignon','Cinsault','Carignan'],[4,8,18,26],[16,18],60,'Bordeaux',['Roast lamb','Grilled meats','Spiced stews','Aged cheese']],
    // The New World batch. The United States was entirely red, so a US white
    // (Finger Lakes dry Riesling) and the earlier-drinking Zinfandel/Paso reds
    // now shape its spread. A region label carries a style suffix wherever the
    // name is shared across styles the batch or the owner's cellar covers:
    // Margaret River (Cabernet red and a Chardonnay-led white), Hawke's Bay
    // (Bordeaux-blend/Syrah red and a Chardonnay), Yarra Valley (Pinot,
    // Chardonnay and traditional-method sparkling) and Paso Robles (Rhône/Zin
    // reds and whites) all needed disambiguating -- get() matches a region key
    // before it ever looks at style, so a bare label would be a drinking window
    // the owner cannot correct. Canadian icewine is keyed and labelled apart
    // from the dry Ontario Riesling: both can legitimately carry the Riesling
    // grape, but the sweet, decades-lived wine must never be reachable as a dry
    // one, nor a dry Riesling as an icewine. Zinfandel drinks earlier than
    // Cabernet despite its power; the cool-climate Pinots (Santa Barbara,
    // Yarra) are kept modest, not Barossa-scale; Torrontés and Chilean
    // Sauvignon are aromatic wines to drink young; and Uruguayan Tannat is the
    // most tannic, longest-lived red here.
    ['zinfandel','United States','California — Zinfandel','red',['Zinfandel'],[2,4,10,14],[16,18],30,'Bordeaux',['Barbecue ribs','Burgers','Grilled sausage','Aged cheddar']],
    ['santa-barbara-pinot','United States','Santa Barbara — Pinot Noir','red',['Pinot Noir'],[3,5,12,17],[14,16],30,'Burgundy',['Salmon','Duck','Mushroom','Roast chicken']],
    ['paso-robles-red','United States','Paso Robles — Red (Rhône & Zin)','red',['Syrah','Grenache','Mourvèdre'],[3,5,12,18],[16,18],45,'Bordeaux',['Grilled lamb','Barbecue','Braised beef','Aged cheese']],
    ['finger-lakes-riesling','United States','Finger Lakes — Dry Riesling','white',['Riesling'],[2,4,12,18],[8,10],0,'White',['Trout','Pork','Spicy Asian','Goat cheese']],
    ['coonawarra-cab','Australia','Coonawarra Cabernet','red',['Cabernet Sauvignon'],[5,9,18,26],[16,18],60,'Bordeaux',['Roast lamb','Ribeye','Beef','Hard cheese']],
    ['margaret-river-cab','Australia','Margaret River — Cabernet','red',['Cabernet Sauvignon','Merlot'],[5,8,17,24],[16,18],60,'Bordeaux',['Lamb','Ribeye','Beef','Hard cheese']],
    ['margaret-river-white','Australia','Margaret River — White (Chardonnay & SBS)','white',['Chardonnay','Sauvignon Blanc','Sémillon'],[2,4,10,15],[11,13],15,'White',['Lobster','Roast chicken','Grilled fish','Hard cheese']],
    ['clare-riesling','Australia','Clare Valley — Dry Riesling','white',['Riesling'],[2,5,14,22],[8,10],0,'White',['Seafood','Thai food','Pork','Citrus dishes']],
    ['mclaren-vale-shiraz','Australia','McLaren Vale Shiraz','red',['Shiraz'],[4,7,16,23],[16,18],60,'Bordeaux',['Barbecue','Braised beef','Lamb','Strong cheese']],
    ['yarra-pinot','Australia','Yarra Valley — Pinot Noir','red',['Pinot Noir'],[3,5,12,17],[14,16],30,'Burgundy',['Duck','Salmon','Mushroom','Roast chicken']],
    ['tasmanian-sparkling','Australia','Tasmania — Sparkling (Traditional Method)','sparkling',['Chardonnay','Pinot Noir'],[2,5,12,18],[8,10],0,'Flute or white',['Oysters','Canapés','Smoked salmon','Fried food']],
    ['hawkes-bay-red','New Zealand','Hawke\'s Bay — Red (Bordeaux Blend & Syrah)','red',['Merlot','Cabernet Sauvignon','Syrah'],[4,7,16,22],[16,18],45,'Bordeaux',['Lamb','Beef','Venison','Hard cheese']],
    ['hawkes-bay-chardonnay','New Zealand','Hawke\'s Bay — Chardonnay','white',['Chardonnay'],[2,4,10,15],[11,13],15,'White',['Roast chicken','Lobster','Grilled fish','Hard cheese']],
    ['uruguay-tannat','Uruguay','Uruguay — Tannat','red',['Tannat'],[5,9,20,28],[16,18],90,'Bordeaux',['Grilled beef','Lamb','Braised meat','Hard cheese']],
    ['chile-carmenere','Chile','Chile — Carmenère (Red)','red',['Carmenère'],[3,5,12,17],[16,18],45,'Bordeaux',['Grilled meats','Beans','Barbecue','Aged cheese']],
    ['chile-sb','Chile','Chile — Sauvignon Blanc (White)','white',['Sauvignon Blanc'],[0,1,4,6],[8,10],0,'White',['Shellfish','Ceviche','Goat cheese','Green salads']],
    ['torrontes','Argentina','Salta — Torrontés','white',['Torrontés'],[0,1,3,5],[8,10],0,'White',['Spicy Asian','Ceviche','Summer salads','Apéritif']],
    ['pinotage','South Africa','South Africa — Pinotage','red',['Pinotage'],[2,4,10,14],[16,18],30,'Bordeaux',['Braai','Grilled meats','Sausage','Aged cheese']],
    ['sa-syrah','South Africa','South Africa — Syrah','red',['Syrah'],[3,6,14,20],[16,18],45,'Bordeaux',['Grilled lamb','Peppered steak','Braised beef','Hard cheese']],
    ['cap-classique','South Africa','Cap Classique — Sparkling (Traditional Method)','sparkling',['Chardonnay','Pinot Noir'],[2,5,12,18],[8,10],0,'Flute or white',['Oysters','Canapés','Fried food','Smoked salmon']],
    ['canadian-icewine','Canada','Canada — Icewine','sweet',['Vidal','Riesling'],[4,10,35,55],[8,10],0,'Dessert',['Foie gras','Blue cheese','Fruit tart','Crème brûlée']],
    ['ontario-riesling','Canada','Ontario — Dry Riesling','white',['Riesling'],[2,4,12,18],[8,10],0,'White',['Trout','Pork','Spicy Asian','Goat cheese']]
  ];

  var FALLBACK_RAW = [
    ['fallback-red','—','Unlisted region','red',['Unknown'],[2,4,10,15],[16,18],30,'Bordeaux',['Red meat','Hard cheese']],
    ['fallback-white','—','Unlisted region','white',['Unknown'],[1,2,6,9],[9,11],0,'White',['Fish','Poultry']],
    ['fallback-rose','—','Unlisted region','rose',['Unknown'],[0,1,3,4],[8,10],0,'White',['Salad','Grilled fish']],
    ['fallback-sparkling','—','Unlisted region','sparkling',['Unknown'],[1,2,6,9],[7,9],0,'Flute or white',['Aperitif','Fried food']],
    ['fallback-sweet','—','Unlisted region','sweet',['Unknown'],[2,5,15,25],[8,10],0,'Dessert',['Dessert','Blue cheese']],
    ['fallback-fortified','—','Unlisted region','fortified',['Unknown'],[2,5,20,35],[14,17],0,'Copita',['Nuts','Blue cheese']]
  ];

  function hydrate(row, isFallback) {
    return {
      key: row[0], country: row[1], region: row[2], style: row[3], grapes: row[4],
      curve: row[5], tempC: row[6], decantMin: row[7], glass: row[8], pairings: row[9],
      fallback: isFallback
    };
  }

  var profiles = {}, fallbacks = {};
  RAW.forEach(function (r) { profiles[r[0]] = hydrate(r, false); });
  FALLBACK_RAW.forEach(function (r) {
    var p = hydrate(r, true);
    p.basis = 'style';
    fallbacks[r[3]] = p;
  });

  // A country-and-style average, computed from the real profiles and nothing
  // else, so it sharpens on its own as regions are added. Two profiles is the
  // floor: averaging one would present a single region's curve as a national
  // norm, which is worse than an honest generic because it looks specific.
  var COUNTRY_FLOOR = 2;

  function mean(values) {
    return values.reduce(function (sum, v) { return sum + v; }, 0) / values.length;
  }

  function mostCommon(values) {
    var counts = Object.create(null);
    var best = values[0];
    var bestCount = 0;
    values.forEach(function (v) {
      counts[v] = (counts[v] || 0) + 1;
      if (counts[v] > bestCount) { bestCount = counts[v]; best = v; }
    });
    return best;
  }

  function commonPairings(group, howMany) {
    var counts = Object.create(null);
    var order = [];
    group.forEach(function (p) {
      p.pairings.forEach(function (food) {
        if (!(food in counts)) { counts[food] = 0; order.push(food); }
        counts[food] += 1;
      });
    });
    return order.sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, howMany);
  }

  // The style enum is internal (ASCII, grouping/lookup keys); this is what
  // the owner should actually read. Five styles pass through unchanged --
  // only 'rose' needs the accent the rest of the app already uses
  // ('Provence Rosé', 'Corsica — Rosé'). The label and the hedge both read
  // through this map (via the profile's own styleLabel field) so they can
  // never drift out of step with each other.
  var STYLE_DISPLAY = {
    red: 'red', white: 'white', rose: 'rosé',
    sparkling: 'sparkling', sweet: 'sweet', fortified: 'fortified'
  };

  function synthesise(country, style, group) {
    var styleLabel = STYLE_DISPLAY[style] || style;
    return {
      key: 'country-' + country.toLowerCase().replace(/[^a-z]+/g, '-') + '-' + style,
      country: country,
      region: 'Typical ' + styleLabel + ' from ' + country,
      style: style,
      styleLabel: styleLabel,
      grapes: ['Various'],
      curve: [0, 1, 2, 3].map(function (i) {
        return Math.round(mean(group.map(function (p) { return p.curve[i]; })));
      }),
      tempC: [
        Math.round(mean(group.map(function (p) { return p.tempC[0]; }))),
        Math.round(mean(group.map(function (p) { return p.tempC[1]; })))
      ],
      decantMin: Math.round(mean(group.map(function (p) { return p.decantMin; })) / 5) * 5,
      glass: mostCommon(group.map(function (p) { return p.glass; })),
      pairings: commonPairings(group, 3),
      fallback: true,
      basis: 'country'
    };
  }

  var countryProfiles = (function () {
    var groups = Object.create(null);
    Object.keys(profiles).forEach(function (key) {
      var p = profiles[key];
      var groupKey = p.country + '|' + p.style;
      (groups[groupKey] || (groups[groupKey] = [])).push(p);
    });
    var result = Object.create(null);
    Object.keys(groups).forEach(function (groupKey) {
      var group = groups[groupKey];
      if (group.length < COUNTRY_FLOOR) { return; }
      result[groupKey] = synthesise(group[0].country, group[0].style, group);
    });
    return result;
  })();

  function countryProfile(country, style) {
    return countryProfiles[country + '|' + style] || null;
  }

  function get(regionKey, style, country) {
    if (profiles[regionKey]) { return profiles[regionKey]; }
    if (country) {
      var synthetic = countryProfiles[country + '|' + style];
      if (synthetic) { return synthetic; }
    }
    return fallbacks[style] || fallbacks.red;
  }

  function countries() {
    var seen = {};
    Object.keys(profiles).forEach(function (k) { seen[profiles[k].country] = true; });
    return Object.keys(seen).sort();
  }

  function summary(p) {
    return { key: p.key, region: p.region, style: p.style, grapes: p.grapes, country: p.country };
  }

  function regionsFor(country) {
    return Object.keys(profiles)
      .filter(function (k) { return profiles[k].country === country; })
      .map(function (k) { return summary(profiles[k]); })
      .sort(function (a, b) { return a.region.localeCompare(b.region); });
  }

  function search(text) {
    var q = String(text || '').trim().toLowerCase();
    if (!q) { return []; }
    return Object.keys(profiles).filter(function (k) {
      var p = profiles[k];
      return p.region.toLowerCase().indexOf(q) !== -1 ||
        p.country.toLowerCase().indexOf(q) !== -1 ||
        p.grapes.join(' ').toLowerCase().indexOf(q) !== -1;
    }).map(function (k) { return summary(profiles[k]); });
  }

  return {
    profiles: profiles, get: get, countries: countries, regionsFor: regionsFor, search: search,
    countryProfile: countryProfile
  };
})();
