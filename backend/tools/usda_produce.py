# Builds the ING_PRODUCE table for app.js from the USDA FoodData Central SR Legacy CSV release (April 2018,
# FoodData_Central_sr_legacy_food_csv_2018-04.zip from https://fdc.nal.usda.gov/download-datasets).
import csv, json, sys, os, re
D = sys.argv[1]
foods = {r['fdc_id']: r['description'] for r in csv.DictReader(open(os.path.join(D, 'food.csv')))}
want = {'1008': 0, '1003': 1, '1005': 2, '1004': 3, '1079': 4}   # kcal, protein, carbohydrate (by difference), total fat, fiber (total dietary)
nut, por = {}, {}
for r in csv.DictReader(open(os.path.join(D, 'food_nutrient.csv'))):
    if r['nutrient_id'] in want: nut.setdefault(r['fdc_id'], [None] * 5)[want[r['nutrient_id']]] = float(r['amount'])
for r in csv.DictReader(open(os.path.join(D, 'food_portion.csv'))):
    por.setdefault(r['fdc_id'], []).append((float(r['amount']), r['modifier'].strip(), float(r['gram_weight'])))
GP = 170427   # green bell pepper portions (USDA lists only "large" + strips for yellow; a chopped cup / medium pepper weighs the same)
ON = [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup chopped', 'cup, chopped', 'cup'), ('1 cup sliced', 'cup, sliced', 'cup'), ('1 tbsp chopped', 'tbsp', 'tbsp')]
BP = [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup chopped', 'cup, chopped', 'cup'), ('1 cup sliced', 'cup, sliced', 'cup'), ('1 tbsp', 't', 'tbsp')]
S = [
 ('pepper_green', 'Green bell pepper', 170427, 'bellpepper', ['green bell pepper', 'green pepper', 'bell pepper', 'sweet pepper', 'pepper', 'capsicum'], BP),
 ('pepper_red', 'Red bell pepper', 170108, 'bellpepper', ['red bell pepper', 'red pepper', 'red sweet pepper', 'red capsicum', 'red yellow bell pepper', 'yellow red bell pepper', 'mixed bell pepper', 'tri color bell pepper', 'tricolor bell pepper', 'rainbow bell pepper'], BP),
 ('pepper_yellow', 'Yellow bell pepper', 169383, 'bellpepper', ['yellow bell pepper', 'yellow pepper', 'orange bell pepper', 'orange pepper', 'yellow sweet pepper'],
   [('1 large', 'pepper, large', 'each'), ('1 medium', ('medium', GP), 'each'), ('1 cup chopped', ('cup, chopped', GP), 'cup'), ('1 cup sliced', ('cup, sliced', GP), 'cup')]),
 ('onion', 'Onion', 170000, 'onion', ['onion'], ON),
 ('onion_yellow', 'Yellow onion', 170000, 'onion', ['yellow onion', 'brown onion', 'spanish onion'], ON),
 ('onion_white', 'White onion', 170000, 'onion', ['white onion'], ON),
 ('onion_red', 'Red onion', 170000, 'onion', ['red onion', 'purple onion'], ON),
 ('onion_sweet', 'Sweet onion', 170008, 'onion', ['sweet onion', 'vidalia onion', 'walla walla onion', 'maui onion'], [('1 onion', 'onion', 'each'), ('1 NLEA serving', 'NLEA', 'serving')]),
 ('scallion', 'Green onion', 170005, 'onion', ['green onion', 'scallion', 'spring onion'], [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup chopped', 'cup', 'cup'), ('1 tbsp chopped', 'tbsp', 'tbsp')]),
 ('shallot', 'Shallot', 170499, 'onion', ['shallot'], [('1 tbsp chopped', 'tbsp', 'tbsp')]),
 ('leek', 'Leek', 169246, 'onion', ['leek'], [('1 leek', 'leek', 'each'), ('1 cup', 'cup', 'cup')]),
 ('chives', 'Chives', 169994, 'herb', ['chive'], [('1 tbsp chopped', 'tbsp', 'tbsp'), ('1 tsp chopped', 'tsp', 'tsp')]),
 ('garlic', 'Garlic', 169230, 'garlic', ['garlic', 'garlic clove'], [('1 clove', 'clove', 'each'), ('1 tsp', 'tsp', 'tsp'), ('1 cup', 'cup', 'cup')]),
 ('ginger', 'Ginger', 169231, 'herb', ['ginger', 'ginger root'], [('1 tsp', 'tsp', 'tsp'), ('5 slices (1" dia)', 'slices', 'each')]),
 ('tomato', 'Tomato', 170457, 'tomato', ['tomato', 'red tomato', 'roma tomato', 'plum tomato', 'beefsteak tomato', 'vine tomato'], [('1 medium', 'medium whole', 'each'), ('1 large', 'large whole', 'each'), ('1 small', 'small whole', 'each'), ('1 roma / plum', 'plum tomato', 'each'), ('1 cup chopped', 'cup, chopped', 'cup'), ('1 slice', 'slice, medium', 'each')]),
 ('cherry_tomato', 'Cherry tomatoes', 170457, 'tomato', ['cherry tomato', 'grape tomato'], [('1 cherry tomato', 'cherry', 'each'), ('1 cup', 'cup cherry', 'cup')]),
 ('tomatillo', 'Tomatillo', 168566, 'tomato', ['tomatillo'], [('1 medium', 'medium', 'each'), ('1 cup chopped', 'cup', 'cup')]),
 ('potato', 'Potato', 170026, 'potato', ['potato', 'russet potato', 'russet', 'yukon gold potato', 'yukon potato', 'gold potato', 'red potato', 'white potato'], [('1 medium', 'Potato medium', 'each'), ('1 large', 'Potato large', 'each'), ('1 small', 'Potato small', 'each'), ('1 cup diced', 'cup, diced', 'cup')]),
 ('sweet_potato', 'Sweet potato', 168482, 'potato', ['sweet potato', 'sweetpotato', 'yam'], [('1 sweet potato (5")', 'sweetpotato', 'each'), ('1 cup cubes', 'cup', 'cup')]),
 ('carrot', 'Carrot', 170393, 'root', ['carrot', 'baby carrot'], [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup chopped', 'cup chopped', 'cup'), ('1 cup grated', 'cup grated', 'cup')]),
 ('celery', 'Celery', 169988, 'celery', ['celery', 'celery stalk', 'celery rib'], [('1 medium stalk', 'stalk, medium', 'each'), ('1 large stalk', 'stalk, large', 'each'), ('1 cup chopped', 'cup', 'cup'), ('1 tbsp', 'tbsp', 'tbsp')]),
 ('beet', 'Beet', 169145, 'root', ['beet', 'beetroot'], [('1 beet (2")', 'beet', 'each'), ('1 cup', 'cup', 'cup')]),
 ('radish', 'Radish', 169276, 'root', ['radish'], [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 cup sliced', 'cup slices', 'cup')]),
 ('broccoli', 'Broccoli', 170379, 'brassica', ['broccoli', 'broccoli floret', 'broccoli crown'], [('1 cup chopped', 'cup chopped', 'cup'), ('1 spear', 'spear', 'each'), ('1 stalk', 'stalk', 'each'), ('1 bunch', 'bunch', 'each')]),
 ('cauliflower', 'Cauliflower', 169986, 'brassica', ['cauliflower', 'cauliflower floret'], [('1 cup chopped', 'cup', 'cup'), ('1 floweret', 'floweret', 'each'), ('1 medium head', 'head medium', 'each')]),
 ('brussels', 'Brussels sprouts', 170383, 'brassica', ['brussels sprout', 'brussel sprout'], [('1 sprout', 'sprout', 'each'), ('1 cup', 'cup', 'cup')]),
 ('cabbage', 'Cabbage', 169335, 'cabbage', ['cabbage', 'green cabbage', 'white cabbage'], [('1 cup shredded', 'cup, shredded', 'cup'), ('1 head', 'head', 'each')]),
 ('red_cabbage', 'Red cabbage', 169977, 'cabbage', ['red cabbage', 'purple cabbage'], [('1 cup chopped', 'cup, chopped', 'cup'), ('1 cup shredded', 'cup, shredded', 'cup'), ('1 leaf', 'leaf', 'each'), ('1 medium head', 'head, medium', 'each')]),
 ('bok_choy', 'Bok choy', 170390, 'cabbage', ['bok choy', 'pak choi', 'pak choy', 'baby bok choy'], [('1 cup shredded', 'cup', 'cup'), ('1 leaf', 'leaf', 'each'), ('1 head', 'head', 'each')]),
 ('zucchini', 'Zucchini', 169291, 'squash', ['zucchini', 'courgette', 'green squash'], [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup chopped', 'cup, chopped', 'cup'), ('1 cup sliced', 'cup, sliced', 'cup')]),
 ('yellow_squash', 'Yellow squash', 168464, 'squash', ['yellow squash', 'summer squash', 'crookneck squash', 'straightneck squash'], [('1 cup sliced', 'cup', 'cup')]),
 ('butternut', 'Butternut squash', 169295, 'squash', ['butternut squash', 'butternut'], [('1 cup cubes', 'cup', 'cup')]),
 ('eggplant', 'Eggplant', 169228, 'squash', ['eggplant', 'aubergine'], [('1 cup cubes', 'cup', 'cup'), ('1 eggplant (1-1/4 lb)', 'eggplant, unpeeled', 'each')]),
 ('cucumber', 'Cucumber', 168409, 'cucumber', ['cucumber', 'english cucumber', 'persian cucumber'], [('1 cucumber (8")', 'cucumber', 'each'), ('1 cup sliced', 'cup slices', 'cup')]),
 ('spinach', 'Spinach', 168462, 'greens', ['spinach', 'baby spinach'], [('1 cup', 'cup', 'cup'), ('1 leaf', 'leaf', 'each'), ('1 bunch', 'bunch', 'each'), ('1 package (10 oz)', 'package', 'each')]),
 ('kale', 'Kale', 168421, 'greens', ['kale', 'baby kale', 'lacinato kale', 'curly kale'], [('1 cup', 'cup', 'cup')]),
 ('arugula', 'Arugula', 169387, 'greens', ['arugula', 'rocket', 'baby arugula'], [('1 cup', 'cup', 'cup'), ('1 leaf', 'leaf', 'each')]),
 ('romaine', 'Romaine lettuce', 169247, 'lettuce', ['romaine', 'romaine lettuce', 'cos lettuce', 'romaine heart', 'lettuce'], [('1 cup shredded', 'cup', 'cup'), ('1 outer leaf', 'leaf outer', 'each'), ('1 inner leaf', 'leaf inner', 'each'), ('1 head', 'head', 'each')]),
 ('iceberg', 'Iceberg lettuce', 169248, 'lettuce', ['iceberg', 'iceberg lettuce', 'head lettuce'], [('1 cup shredded', 'cup shredded', 'cup'), ('1 medium leaf', 'leaf, medium', 'each'), ('1 medium head', 'head, medium', 'each')]),
 ('green_leaf', 'Green leaf lettuce', 169249, 'lettuce', ['green leaf lettuce', 'leaf lettuce', 'red leaf lettuce', 'butter lettuce', 'bibb lettuce'], [('1 cup shredded', 'cup', 'cup'), ('1 outer leaf', 'leaf outer', 'each'), ('1 head', 'head', 'each')]),
 ('mixed_greens', 'Mixed greens', 169249, 'lettuce', ['mixed green', 'spring mix', 'salad mix', 'mesclun', 'salad green', 'baby green'], [('1 cup', 'cup', 'cup')]),
 ('mushroom', 'Mushrooms', 169251, 'mushroom', ['mushroom', 'white mushroom', 'button mushroom'], [('1 cup sliced', 'cup, pieces', 'cup'), ('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 cup whole', 'cup, whole', 'cup')]),
 ('cremini', 'Cremini mushrooms', 168434, 'mushroom', ['cremini mushroom', 'crimini mushroom', 'baby bella', 'baby bella mushroom', 'cremini', 'crimini', 'brown mushroom'], [('1 cup sliced', 'cup sliced', 'cup'), ('1 mushroom', 'piece', 'each'), ('1 cup whole', 'cup whole', 'cup')]),
 ('jalapeno', 'Jalape\u00f1o', 168576, 'chile', ['jalapeno', 'jalapeno pepper'], [('1 pepper', 'pepper', 'each'), ('1 cup sliced', 'cup', 'cup')]),
 ('serrano', 'Serrano pepper', 169395, 'chile', ['serrano', 'serrano pepper', 'serrano chile'], [('1 pepper', 'pepper', 'each'), ('1 cup chopped', 'cup', 'cup')]),
 ('chili_green', 'Green chile', 170497, 'chile', ['green chile', 'green chili', 'green chili pepper', 'anaheim pepper', 'hatch chile', 'hot pepper'], [('1 pepper', 'pepper', 'each'), ('1 cup chopped', 'cup', 'cup')]),
 ('chili_red', 'Red chile', 170106, 'chile', ['red chile', 'red chili', 'red chili pepper', 'fresno pepper', 'thai chili'], [('1 pepper', 'pepper', 'each'), ('1 cup chopped', 'cup', 'cup')]),
 ('avocado', 'Avocado', 171705, 'avocado', ['avocado', 'hass avocado'], [('1 avocado', 'avocado', 'each'), ('1 cup cubes', 'cup, cubes', 'cup'), ('1 cup mashed', 'cup, pureed', 'cup'), ('1 NLEA serving (1/3 fruit)', 'NLEA', 'serving')]),
 ('corn', 'Corn', 169998, 'corn', ['corn', 'sweet corn', 'corn on the cob', 'corn kernel', 'yellow corn'], [('1 medium ear', 'ear, medium', 'each'), ('1 large ear', 'ear, large', 'each'), ('1 cup kernels', 'cup', 'cup')]),
 ('green_beans', 'Green beans', 169961, 'beans', ['green bean', 'string bean', 'snap bean', 'haricot vert'], [('1 cup', 'cup', 'cup'), ('10 beans (4")', 'beans', 'each')]),
 ('peas', 'Green peas', 170419, 'peas', ['pea', 'green pea', 'garden pea', 'english pea'], [('1 cup', 'cup', 'cup')]),
 ('peas_frozen', 'Frozen peas', 170016, 'peas', ['frozen pea', 'frozen green pea'], [('1 cup', 'cup', 'cup'), ('1 package', 'package', 'each')]),
 ('asparagus', 'Asparagus', 168389, 'asparagus', ['asparagus', 'asparagus spear'], [('1 medium spear', 'spear, medium', 'each'), ('1 large spear', 'spear, large', 'each'), ('1 cup', 'cup', 'cup')]),
 ('okra', 'Okra', 169260, 'beans', ['okra'], [('1 cup', 'cup', 'cup'), ('8 pods (3")', 'pods', 'each')]),
 ('cilantro', 'Cilantro', 169997, 'herb', ['cilantro', 'coriander leaf', 'fresh coriander'], [('1/4 cup', 'cup', 'cup'), ('9 sprigs', 'sprigs', 'each')]),
 ('parsley', 'Parsley', 170416, 'herb', ['parsley', 'italian parsley', 'flat leaf parsley', 'curly parsley'], [('1 tbsp', 'tbsp', 'tbsp'), ('1 cup chopped', 'cup', 'cup'), ('10 sprigs', 'sprigs', 'each')]),
 ('basil', 'Basil', 172232, 'herb', ['basil', 'sweet basil', 'thai basil'], [('5 leaves', 'leaves', 'each'), ('2 tbsp chopped', 'tbsp', 'tbsp'), ('1/4 cup leaves', 'cup', 'cup')]),
 ('lemon', 'Lemon', 167746, 'citrus', ['lemon'], [('1 lemon', 'fruit (2-1/8', 'each'), ('1 wedge', 'wedge', 'each'), ('1 cup sections', 'cup', 'cup')]),
 ('lemon_juice', 'Lemon juice', 167747, 'citrus', ['lemon juice', 'fresh lemon juice'], [('1 tbsp', None, 'tbsp'), ('1 fl oz', 'fl oz', 'floz'), ('juice of 1 lemon', 'lemon yields', 'each'), ('1 cup', 'cup', 'cup')]),
 ('lime', 'Lime', 168155, 'citrus', ['lime'], [('1 lime', 'fruit', 'each')]),
 ('lime_juice', 'Lime juice', 168156, 'citrus', ['lime juice', 'fresh lime juice'], [('1 tbsp', None, 'tbsp'), ('1 fl oz', 'fl oz', 'floz'), ('juice of 1 lime', 'lime yields', 'each'), ('1 cup', 'cup', 'cup')]),
 ('orange', 'Orange', 169097, 'citrus', ['orange', 'navel orange', 'valencia orange'], [('1 orange (2-5/8")', 'fruit', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup sections', 'cup', 'cup')]),
 ('apple', 'Apple', 171688, 'fruit', ['apple', 'gala apple', 'fuji apple', 'honeycrisp apple', 'granny smith apple', 'red apple', 'green apple'], [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup chopped', 'cup, quartered', 'cup'), ('1 cup sliced', 'cup slices', 'cup')]),
 ('banana', 'Banana', 173944, 'fruit', ['banana'], [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup sliced', 'cup, sliced', 'cup'), ('1 cup mashed', 'cup, mashed', 'cup')]),
 ('strawberry', 'Strawberries', 167762, 'berry', ['strawberry'], [('1 cup whole', 'cup, whole', 'cup'), ('1 cup sliced', 'cup, sliced', 'cup'), ('1 medium berry', 'medium', 'each'), ('1 large berry', 'large', 'each')]),
 ('blueberry', 'Blueberries', 171711, 'berry', ['blueberry'], [('1 cup', 'cup', 'cup'), ('50 berries', 'berries', 'each')]),
 ('raspberry', 'Raspberries', 167755, 'berry', ['raspberry'], [('1 cup', 'cup', 'cup'), ('10 berries', 'raspberries', 'each')]),
 ('grape', 'Grapes', 174683, 'fruit', ['grape', 'red grape', 'green grape', 'seedless grape'], [('1 cup', 'cup', 'cup'), ('10 grapes', 'grapes', 'each')]),
 ('pineapple', 'Pineapple', 169124, 'fruit', ['pineapple'], [('1 cup chunks', 'cup', 'cup'), ('1 slice (3-1/2")', 'slice (3-1/2', 'each')]),
 ('mango', 'Mango', 169910, 'fruit', ['mango'], [('1 mango', 'fruit', 'each'), ('1 cup pieces', 'cup', 'cup')]),
 ('peach', 'Peach', 169928, 'fruit', ['peach', 'yellow peach'], [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup sliced', 'cup', 'cup')]),
 ('pear', 'Pear', 169118, 'fruit', ['pear'], [('1 medium', 'medium', 'each'), ('1 large', 'large', 'each'), ('1 small', 'small', 'each'), ('1 cup sliced', 'cup, slices', 'cup')]),
 ('watermelon', 'Watermelon', 167765, 'melon', ['watermelon'], [('1 cup diced', 'cup, diced', 'cup'), ('1 wedge (1/16 melon)', 'wedge', 'each')]),
 ('cantaloupe', 'Cantaloupe', 169092, 'melon', ['cantaloupe', 'muskmelon'], [('1 cup cubes', 'cup, cubes', 'cup'), ('1 medium wedge (1/8)', 'wedge, medium', 'each'), ('1 medium melon', 'melon, medium', 'each')]),
]
def pick(fdc, spec, label):
    pre = spec; src = fdc
    if isinstance(spec, tuple): pre, src = spec
    src = str(src)
    if pre is None:   # 1 tbsp from the USDA fl oz (2 tbsp)
        h = [p for p in por[src] if p[1].lower().startswith('fl oz')]; assert len(h) == 1, (label, src)
        return round(h[0][2] / h[0][0] / 2, 2)
    h = [p for p in por[src] if p[1].lower().startswith(pre.lower())]
    assert len(h) >= 1, (label, src, pre, por[src])
    if len(h) > 1: h = [p for p in h if p[1].lower() == pre.lower()] or h[:1]
    a, m, g = h[0]
    n = float(label.split(' ')[0].replace('1/4', '0.25').replace('juice', '1')) if label[0].isdigit() else 1.0
    if 'juice of' in label: n = 1.0
    return round(g / a * n, 2)
rows = []
for key, name, fdc, grp, al, ps in S:
    n = nut[str(fdc)]; assert None not in n, key
    out = []
    for lab, pre, unit in ps:
        g = pick(fdc, pre, lab)
        n0 = float(lab.split(' ')[0].replace('1/4', '0.25')) if lab[0].isdigit() else 1
        out.append([lab, n0, unit, g])
    rows.append([key, name, fdc, foods[str(fdc)], grp, n, al, out])
for r in rows: r[3] = re.sub(r'\s*\(Includes foods for USDA.s Food Distribution Program\)', '', r[3])
js = ',\n'.join('    ' + json.dumps(r, ensure_ascii=True, separators=(', ', ': ')) for r in rows)
open(sys.argv[2] if len(sys.argv) > 2 else 'ing_produce_table.js', 'w').write(js)
for r in rows: print(r[0], r[5], [(p[0], p[3]) for p in r[7]])
