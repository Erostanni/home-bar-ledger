#!/usr/bin/env python3
"""
从 bar-assistant/data (MIT) 抽取家庭调酒消耗账本所需的精简数据集。

输出: bar-data.json
  { recipes: [...], ingredients: {...}, priceHints: {...} }
"""
import json, glob, os, re, collections, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from translations import TR, GLASS_ZH, METHOD_ZH

SRC = os.path.join(os.path.dirname(__file__), '..', 'data')

# ---- 单位归一化 -> ml。0 表示"非计量"(装饰/少量点缀)，不参与库存扣减 ----
UNIT_ML = {
    'ml': 1.0, 'oz': 29.5735, 'dash': 0.9, 'dashes': 0.9,
    'barspoon': 5.0, 'teaspoon': 5.0, 'tsp': 5.0,
    'drop': 0.05, 'drops': 0.05,
    'topup': 0.0, 'part': 0.0,
    'whole': 0.0, 'leaves': 0.0, 'leaf': 0.0, 'sprig': 0.0, 'sprigs': 0.0,
    'slice': 0.0, 'slices': 0.0, 'wedge': 0.0, 'pinch': 0.0, 'cube': 0.0, 'cup': 0.0,
}
NON_METERED = {'topup', 'part', 'whole', 'leaves', 'leaf', 'sprig', 'sprigs',
               'slice', 'slices', 'wedge', 'pinch', 'cube', 'cup'}

# ---- 配方筛选：权威标签 + 家庭酒吧常备经典 ----
KEEP_TAGS = {
    'IBA Cocktail', 'The Unforgettables', 'Contemporary Classics',
    'New Era Drinks', 'Classics', 'Classic',
}
WISHLIST = """
negroni martini dry-martini old-fashioned manhattan boulevardier paper-plane
daiquiri mojito pisco-sour whiskey-sour tom-collins gin-and-tonic french-75
espresso-martini cosmopolitan sidecar corpse-reviver-2 last-word aviation
vieux-carre sazerac black-manhattan blood-and-sand rusty-nail muddler
americano aperol-spritz negroni-sour amaretto-sour mai-tai zombie cuba-libre
pina-colada mimosa bellini bloody-mary sea-breeze planter-s-punch
jungle-bird navy-grog gin-fizz ramos-gin-fizz harvey-wallbanger
john-collins michelada bodega-bay old-competitor gold-rush
""".split()


def load_recipes():
    out = {}
    for f in glob.glob(os.path.join(SRC, 'data', 'cocktails', '*', 'data.json')):
        d = json.load(open(f, encoding='utf-8'))
        if d.get('name') and d.get('ingredients'):
            out[d['_id']] = d
    return out


def load_ingredients():
    out = {}
    for f in glob.glob(os.path.join(SRC, 'data', 'ingredients', '*', 'data.json')):
        d = json.load(open(f, encoding='utf-8'))
        if d.get('name'):
            out[d['name']] = d
    return out


def shorten(desc, limit=240):
    """描述只保留首句，用于小票展示。"""
    if not desc:
        return ''
    desc = re.sub(r'\s+', ' ', desc).strip()
    m = re.match(r'^(.+?[.!?])\s', desc + ' ')
    s = m.group(1) if m else desc
    if len(s) > limit:
        s = s[:limit].rsplit(' ', 1)[0] + '…'
    return s


def convert_recipe(d):
    ings = []
    for i in d.get('ingredients') or []:
        u = (i.get('units') or 'ml').lower().strip()
        amt = i.get('amount')
        if amt is None:
            continue
        factor = UNIT_ML.get(u, 1.0 if u == 'ml' else 0.0)
        ml = round(float(amt) * factor, 2)
        non_metered = u in NON_METERED or factor == 0.0
        ings.append({
            'n': i.get('name'),
            'ml': 0 if non_metered else ml,
            'amt': float(amt),
            'u': u,
            'opt': bool(i.get('optional')),
            'nonmetered': non_metered,
            'note': i.get('note'),
        })
    if not any(not i['nonmetered'] and i['ml'] > 0 for i in ings):
        return None  # 全是装饰料的配方，剔除

    # ---- 中文翻译 ----
    glass = d.get('glass')
    method = d.get('method')
    tr = TR.get(d['_id'])
    out = {
        'id': d['_id'],
        'name': d['name'],
        'tier': d.get('_tier', 0),
        'zh': bool(tr),
        'desc': (tr.get('d') if tr else '') or shorten(d.get('description')),
        'garnish': (tr.get('g') if tr and 'g' in tr else '') or d.get('garnish'),
        'abv': d.get('abv'),
        'glass': glass,
        'glassZh': GLASS_ZH.get(glass, glass),
        'method': method,
        'methodZh': METHOD_ZH.get(method, method),
        'tags': [t for t in (d.get('tags') or []) if t not in ('IBA Cocktail',)][:4],
        'steps': (tr.get('s') if tr else '') or [s.strip() for s in re.split(r'\n+', d.get('instructions') or '') if s.strip()][:6],
        'ings': ings,
    }
    styles, mstyle, base, lineage = classify(d.get('tags'), ings, ING_META)
    out['styles'] = styles
    out['style'] = mstyle
    out['base'] = base
    out['lineage'] = lineage
    out['stepsEn'] = [s.strip() for s in re.split(r'\n+', d.get('instructions') or '') if s.strip()][:6] if (tr and tr.get('s')) else []
    out['descEn'] = shorten(d.get('description')) if (tr and tr.get('d')) else ''
    out['garnishEn'] = d.get('garnish') if (tr and tr.get('g')) else ''
    return out


# ---- 预置参考价（CNY）。仅作为开箱即用的估算值，用户可在库存里改。 ----
# 格式: 原料名: (参考容量ml, 参考价元)
PRICE_HINTS = {
    'Gin': (750, 180), 'Vodka': (750, 120), 'Light Rum': (750, 120),
    'White Rum': (750, 120), 'Dark Rum': (750, 140), 'Jamaican Rum': (750, 180),
    'Bourbon Whiskey': (750, 220), 'Rye whiskey': (750, 280),
    'Scotch whiskey': (750, 300), 'Tequila Blanco': (750, 180),
    'Mezcal': (750, 320), 'Cognac': (750, 280), 'Apple Brandy': (750, 180),
    'Campari': (750, 130), 'Aperol': (750, 120), 'Cointreau': (750, 130),
    'Triple Sec': (750, 100), 'Sweet Vermouth': (750, 100), 'Dry Vermouth': (750, 110),
    'Green Chartreuse': (750, 260), 'Yellow Chartreuse': (750, 260),
    'St-Germain': (750, 180), 'Maraschino': (750, 220), 'Benedictine': (750, 220),
    'Coffee liqueur': (750, 130), 'Baileys': (750, 150), 'Advocaat': (750, 130),
    'Fernet-Branca': (750, 150), 'Frangelico': (750, 120), 'Limoncello': (750, 130),
    'Cynar': (750, 150), 'Amaro Montenegro': (750, 180), 'Absinthe': (750, 260),
    'Angostura aromatic bitters': (100, 60), 'Orange bitters': (100, 90),
    'Peychaud\'s Bitters': (100, 90), 'Regans\' No. 6': (100, 80),
    'Club soda': (1000, 25), 'Soda water': (1000, 25), 'Tonic water': (1000, 30),
    'Ginger beer': (330, 12), 'Ginger ale': (1000, 28), 'Cola': (1000, 22),
    'Lemon juice': (500, 18), 'Lime juice': (500, 18), 'Orange juice': (1000, 30),
    'Pineapple juice': (1000, 32), 'Grapefruit juice': (1000, 38),
    'Cranberry juice': (1000, 30), 'Pomegranate juice': (1000, 40),
    'Coconut cream': (400, 28), 'Cream': (500, 22), 'Milk': (1000, 20),
    'Egg White': (100, 15), 'Simple Syrup': (500, 0), 'Demerara Syrup': (500, 0),
    'Honey Syrup': (500, 0), 'Agave Syrup': (500, 0), 'Grenadine Syrup': (500, 0),
    'Orgeat Syrup': (500, 0), 'Passionfruit syrup': (500, 0),
    'Raspberry Syrup': (500, 0), 'Strawberry Syrup': (500, 0),
    'Mint': (50, 5), 'Lemon zest': (50, 5), 'Orange zest': (50, 5),
    'Mint leaves': (50, 5), 'Lemon peel': (50, 5), 'Orange peel': (50, 5),
    'Coffee': (250, 40), 'Espresso': (50, 30), 'Cold brew coffee': (1000, 45),
}


# ---- 中文别名：让中文用户能搜到、能看懂 ----
ZH = {
    'Gin': '金酒', 'Vodka': '伏特加', 'Light Rum': '白朗姆', 'White Rum': '白朗姆',
    'Dark Rum': '黑朗姆', 'Brown Rum': '褐朗姆', 'Demerara Rum': '德梅拉拉朗姆',
    'Jamaican Rum': '牙买加朗姆', 'Overproof Rum': '高酒精度朗姆',
    'Bourbon Whiskey': '波本威士忌', 'Rye whiskey': '黑麦威士忌',
    'Scotch whiskey': '苏格兰威士忌', 'Islay Scotch Whiskey': '艾雷岛威士忌',
    'Irish whiskey': '爱尔兰威士忌', 'Whiskey': '威士忌',
    'Tequila Blanco': '龙舌兰(白)', 'Mezcal': '梅斯卡尔', 'Cognac': '干邑',
    'Brandy': '白兰地', 'Apple Brandy': '苹果白兰地', 'Apricot Brandy': '杏子白兰地',
    'Cachaça': '甘蔗酒', 'Pisco': '皮斯科',
    'Sweet Vermouth': '甜味美思', 'Dry Vermouth': '干味美思', 'Vermouth Bianco': '白味美思',
    'Campari': '金巴利', 'Aperol': '阿佩罗尔', 'Cointreau': '君度', 'Triple Sec': '橙味利口酒',
    'Orange Curaçao': '橙味库拉索', 'Grand Marnier': '君度橙酒', 'Curaçao': '库拉索',
    'Green Chartreuse': '绿查特酒', 'Yellow Chartreuse': '黄查特酒',
    'St-Germain': '圣日耳曼', 'Bénédictine': '本笃会', 'Galliano': '加利安奴',
    'Maraschino': '黑樱桃利口酒', 'Amaretto': '杏仁利口酒', 'Fernet Branca': ' Fernet 苦艾',
    'Crème de menthe': '薄荷利口酒', 'Crème de cassis': '黑醋栗利口酒',
    'Crème de Violette': '紫罗兰利口酒', 'Crème de mûre': '黑莓利口酒',
    'Crème de Cacao (White)': '白可可利口酒', 'Crème de Cacao (Dark)': '黑可可利口酒',
    'Absinthe': '苦艾酒', 'Orange Curaçao ': '橙味库拉索',
    'Coffee liqueur': '咖啡利口酒', 'Cherry heering': '樱桃酒',
    'Angostura aromatic bitters': '安高天娜苦精', 'Orange bitters': '橙味苦精',
    'Peychauds Bitters': '佩乔苦精', 'Regans No. 6': 'Regan 苦精',
    'Lemon juice': '柠檬汁', 'Lime juice': '青柠汁', 'Orange juice': '橙汁',
    'Pineapple juice': '菠萝汁', 'Grapefruit juice': '西柚汁', 'Cranberry juice': '蔓越莓汁',
    'Pomegranate juice': '石榴汁', 'Tomato juice': '番茄汁', 'Apple juice': '苹果汁',
    'Simple Syrup': '糖浆', 'Demerara Syrup': '德梅拉拉糖浆', 'Honey Syrup': '蜂蜜糖浆',
    'Agave Syrup': '龙舌兰糖浆', 'Grenadine Syrup': '石榴糖浆', 'Orgeat Syrup': '杏仁糖浆',
    'Passionfruit syrup': '百香果糖浆', 'Raspberry Syrup': '覆盆子糖浆',
    'Strawberry Syrup': '草莓糖浆', 'Maple syrup': '枫糖浆', 'Sugar': '糖',
    'Club soda': '苏打水', 'Soda water': '苏打水', 'Tonic water': '汤力水',
    'Ginger beer': '姜汁啤酒', 'Ginger ale': '姜汁汽水', 'Cola': '可乐', 'Water': '水',
    'Egg White': '蛋清', 'Cream': '淡奶油', 'Milk': '牛奶', 'Coconut cream': '椰浆',
    'Prosecco': '普罗塞克起泡酒', 'Champagne': '香槟', 'Red wine': '红酒', 'White wine': '白酒',
    'Mint': '薄荷', 'Mint leaves': '薄荷叶', 'Lemon zest': '柠檬皮屑', 'Orange zest': '橙皮屑',
    'Lemon peel': '柠檬皮', 'Orange peel': '橙皮', 'Coffee': '咖啡', 'Espresso': '浓缩咖啡',
    'Worcestershire Sauce': '辣酱油', 'Tabasco': '塔巴斯科辣酱', 'Falernum': '法勒南糖浆',
    'Bacon Fat-Infused bourbon': '猪油浸波本', 'White Peach Puree': '白桃果泥',
    'Apple juice ': '苹果汁', 'Lillet Blanc': '白丽尔酒', 'Sherry': '雪莉酒',
    'Aquavit': '阿夸维特', 'Sake': '清酒', 'Soju': '烧酒', 'Pisco Sour': '皮斯科酸酒',
    'Grapefruit': '西柚', 'Lemon': '柠檬', 'Lime': '青柠', 'Orange': '橙子',
    'Soda': '苏打水', 'Soda ': '苏打水', 'Ice': '冰',
    'Amaro Averna': '艾玛罗阿韦尔纳', 'Amaro Nonino': '诺尼诺艾玛罗',
    'Amaro Montenegro': '蒙特内格罗艾玛罗', 'Cynar': '希那尔', 'Chambord': '尚柏堡',
    'Malört': '玛乐', 'Pernod': '潘诺', 'Pimm’s #1': '品酒一号',
    'Rhum agricole': '农业朗姆', 'Beer': '啤酒', 'Tea': '茶',
    'Rosé wine': '桃红葡萄酒', 'Grappa': '格拉帕', 'Drambuie': '德伦布依',
    'Peach liqueur': '桃味利口酒', 'Chamomile Liqueur': '洋甘菊利口酒',
    'Pamplemousse Liqueur': '葡萄柚利口酒', 'Dry Curaçao': '干味库拉索',
    'Donn’s Mix': '唐氏混合酒', "Donn's Mix": '唐氏混合酒',
    'Allspice dram': '多香果糖浆', 'Cream of Coconut': '椰奶油',
    'Orange Flower Water': '橙花水', 'Lemon soda': '柠檬汽水',
    'Crushed ice': '碎冰', 'Olive brine': '橄榄盐水', 'Onion brine': '洋葱盐水',
    'Soy sauce': '酱油', 'Ting': '汤力水',
    'Egg': '全蛋', 'Cream of Coconut': '椰奶油', 'Ouzo': '茴香酒',
    'Aquavit': 'Aquavit', 'Sake': '清酒', 'Soju': '烧酒',
    'Pisco': '皮斯科', 'Schnapps': '果味烈酒', 'Sherry': '雪莉酒',
    'Tawny Port': '波特酒', 'White Port': '白波特', 'Vermouth Bianco': '白味美思',
    'Bitter Orange': '橙味苦精', 'Bitter Peach': '桃味苦精', 'Bitter Lemon': '柠檬苦精',
    'Pepper': '胡椒', 'Salt': '盐', 'Ginger': '姜', 'Cucumber': '黄瓜',
    'Strawberry': '草莓', 'Chilli Pepper': '辣椒', 'Malört': '玛乐',
    # —— 配方实际用到的原料（补齐，避免出现英文名） ——
    'Tonic': '汤力水', 'Ginger syrup': '姜糖浆', 'Saline solution': '盐水',
    'Tequila Reposado': '龙舌兰(陈年)', 'Cinnamon syrup': '肉桂糖浆',
    'Italicus Rosolio di Bergamotto': 'Italicus 佛手柑利口酒', 'Suze': '苏兹酒',
    'Cocchi Aperitivo Americano': 'Cocchi 美式开胃酒', 'Pear Brandy (Williams)': '威廉姆斯梨白兰地',
    'Crème de banane': '香蕉利口酒', 'Angostura cocoa bitters': '安高天娜可可苦精',
    'Mole Bitters': '莫勒苦精', 'Coconut water': '椰子水', 'Punt e Mes': 'Punt e Mes 苦酒',
    'Pineapple Syrup': '菠萝糖浆', 'Gentian Liqueur': '龙胆利口酒', 'Grapefruit bitters': '西柚苦精',
    'Ancho Reyes': 'Ancho Reyes 辣椒利口酒', 'Apple Cider': '苹果西打', 'Basil': '罗勒',
    'Navy Strength Gin': '海军 strength 金酒', 'Sparkling wine': '起泡酒', 'Jägermeister': '野格',
    'Vanilla syrup': '香草糖浆', 'Coconut Rum': '椰子朗姆', 'Amaro Ramazzotti': 'Amaro Ramazzotti 苦味酒',
    'Coconut Syrup': '椰子糖浆', 'Limoncello': '柠檬利口酒', 'Blended Scotch Whisky': '调和苏格兰威士忌',
    'Baileys Irish Cream': '百利甜', 'Fino': '菲诺雪莉', 'Walnut Liqueur': '核桃利口酒',
    'Cold brew coffee': '冷萃咖啡', 'Cilantro': '香菜', 'Strega': '斯特雷加利口酒',
    'Bitters': '苦精', 'Cask-Proof Whiskey': '原桶强度威士忌', 'Rose syrup': '玫瑰糖浆',
    'Ice cream': '冰淇淋', 'Honey liqueur': '蜂蜜利口酒', 'Amaro': '苦味酒',
    'Blue Curaçao': '蓝色库拉索', 'Marmalade': '橘子酱', 'Licor 43': 'Licor 43',
    'Fig jam': '无花果酱', 'Passoã': 'Passoã 坚果利口酒', 'Grapes': '葡萄',
    'Peach syrup': '桃子糖浆', 'Swedish punsch': '瑞典潘趣', 'Carrot juice': '胡萝卜汁',
    'Malört': '玛乐', 'Honey': '蜂蜜', 'Vanilla Extract': '香草精', 'Kiwi': '猕猴桃',
    'Orange Soda': '橙味汽水', 'Star anise': '八角', 'Pear liqueur': '梨利口酒',
    'Grapefruit soda': '西柚汽水', 'Grape Brandy': '葡萄白兰地', 'Amaro Meletti': 'Amaro Meletti 苦味酒',
    'Amaro Lazzaroni': 'Amaro Lazzaroni 苦味酒', 'Amaro CioCiaro': 'Amaro CioCiaro 苦味酒',
    'Amaro Sibilla': 'Amaro Sibilla 苦味酒', 'Apricot liqueur': '杏子利口酒', 'Banana': '香蕉',
    'Beet juice': '甜菜汁', 'Bigallet China China': 'Bigallet 苦酒', 'Becherovka': '贝赫罗夫卡',
    'Pedro Ximénez': '佩德罗·希梅内斯', 'Salers': '萨莱尔斯', 'Blackberries': '黑莓',
    'Clamato juice': '蛤蜊番茄汁', 'Horseradish': '辣根', 'Barbados Rum': '巴巴多斯朗姆',
    'Celery': '芹菜', 'Fig-infused mezcal': '无花果浸梅斯卡尔', 'Old Tom Gin': 'Old Tom 金酒',
    'Lime cordial': '青柠甜露', 'Underberg': 'Underberg 苦酒', 'Japanese Whiskey': '日威',
    'Spiced brown nectar': '香料棕 nectar', 'Génépy': '热甘菊利口酒', 'Hot honey-clove syrup': '热蜜丁香糖浆',
    'Sanbitter': 'Sanbitter 苦酒', 'Batter': '面糊', 'Amargo-Vallet': 'Amargo-Vallet 苦酒',
    'Lavender syrup': '薰衣草糖浆', 'Mango puree': '芒果泥', 'Cardamom bitters': '小豆蔻苦精',
    'Honey ginger syrup': '蜂蜜姜糖浆', 'Clove': '丁香', 'Candied Ginger': '糖渍姜',
    'Gardenia Mix': '栀子花调饮液', 'Apple cider vinegar': '苹果西打醋', 'Aquafaba': '鹰嘴豆蛋白',
    'Spiced wine syrup': '香料酒糖浆', 'Vanilla Vodka': '香草伏特加', 'Cherry juice': '樱桃汁',
    'Balsamic vinegar': '意大利香醋', 'Arugula': '芝麻菜', 'Sage-infused vodka': '鼠尾草浸伏特加',
    'Blood Orange Juice': '血橙汁', 'Apple': '苹果', 'Celery bitters': '芹菜苦精',
    'Arrack': '阿拉克酒', 'Chinola (Passionfruit)': '奇诺拉(百香果)', 'Passionfruit puree': '百香果泥',
    'Plum Brandy': '李子白兰地', 'Tequila': '龙舌兰', 'Strawberry shrub syrup': '草莓灌木糖浆',
    'Rosemary': '迷迭香', 'Cinnamon': '肉桂', 'Cranberries': '蔓越莓', 'Pineapple Rum': '菠萝朗姆',
    'Strawberry soda': '草莓汽水', 'Bouquet bitters': '花束苦精', 'Rum': '朗姆',
    'Rose water': '玫瑰水', 'Sage': '鼠尾草', 'Manzanilla sherry': '曼萨尼利亚雪莉',
    'Tangerine juice': '橘子汁', 'Umeshu': '梅酒', 'Hot chocolate': '热巧克力', 'Peach': '桃',
    'Avéze': 'Avéze 苦酒', 'Cocktail cherry': '鸡尾酒樱桃', 'Root beer': '根汁汽水',
    'Activated charcoal': '活性炭', 'Lillet Rose': 'Lillet Rose 桃红利口酒', 'Pelinkovac': '佩林科瓦茨',
    'Domaine La Bohème Gentiane Extra Bitter Aperitif': 'La Bohème 龙胆特苦开胃酒',
}


# ---- 原料分类中文 ----
CAT_ZH = {
    'Liqueurs': '利口酒', 'Other': '其他', 'Beverages': '饮料', 'Spirits': '烈酒',
    'Fruits and vegetables': '果蔬', 'Crème de': '奶油利口酒', 'Bitters': '苦精',
    'Dairy': '乳制品', 'Juices': '果汁', 'Wines': '葡萄酒', 'Apéritif': '开胃酒',
    'Fortified wine': '加强酒', 'Sweeteners': '甜味剂', 'Spices': '香料',
    'Spirits > Sugarcane-based spirits > Rum': '烈酒 › 甘蔗基 › 朗姆',
    'Spirits > Sugarcane-based spirits': '烈酒 › 甘蔗基',
    'Spirits > Sugarcane-based spirits > Rum > Dark Rum': '烈酒 › 甘蔗基 › 朗姆 › 黑朗姆',
    'Sweeteners > Syrups': '甜味剂 › 糖浆',
    'Sweeteners > Syrups > Simple Syrup': '甜味剂 › 糖浆 › 基础糖浆',
    'Apéritif > Amaro': '开胃酒 › 苦味酒',
    'Juices > Citrus juice': '果汁 › 柑橘汁',
    'Spirits > Brandy > Fruit brandy': '烈酒 › 白兰地 › 果酒白兰地',
    'Spirits > Brandy': '烈酒 › 白兰地',
    'Spirits > Whiskey': '烈酒 › 威士忌',
    'Spirits > Whiskey > Bourbon Whiskey': '烈酒 › 威士忌 › 波本',
    'Spirits > Whiskey > Scotch whiskey': '烈酒 › 威士忌 › 苏格兰',
    'Spirits > Mezcal > Tequila': '烈酒 › 梅斯卡尔 › 龙舌兰',
    'Liqueurs > Orange Curaçao': '利口酒 › 橙味库拉索',
    'Wines > Sparkling wine': '葡萄酒 › 起泡酒',
    'Beverages > Coffee': '饮料 › 咖啡',
}


# ---- 风格标签中文映射（多选） ----
STYLE_ZH = {
    'Citrusy': '柑橘', 'Bitter': '苦味', 'Sweet': '甜', 'Fruity': '果味', 'Sour': '酸',
    'Tiki': '提基', 'Smokey': '烟熏', 'Herbacious': '草本', 'Herbal': '草本',
    'Coffee': '咖啡', 'Summer': '夏饮', 'Negroni': '尼格罗尼系', 'Tropical': '热带',
    'Savory': '咸鲜', 'Refreshing': '清爽', 'Spritz': '气泡', 'Brandy': '白兰地',
    'Wine': '葡萄酒', 'Spicy': '辛香', 'Floral': '花香', 'Dry': '干爽',
    'Dessert': '餐后甜', 'Virgin': '无酒精', 'Classic': '经典', 'Light': '轻盈',
    'Complex': '复杂层次', 'The Unforgettables': '不可忘 classics', 'Contemporary Classics': '当代经典',
    'New Era Drinks': '新时代', 'IBA Cocktail': 'IBA 官方', 'Classics': '经典',
    'Sour': '酸', 'Tiki': '提基',
    'Mule': '骡子', 'Old Fashioned': '古典', 'Margarita': '玛格丽特', 'Punch': '餐酒',
    'Fizz': '气泡', 'Flip': '飘香', 'Winter': '冬饮', 'Clarified': '澄清',
    'Batch': '批量', 'Minty': '薄荷', 'Hot': '热饮', 'Autumn': '秋饮',
    'Mojito': '莫吉托', 'Swizzle': '搅打', 'Julep': '朱莉普', 'Manhattan': '曼哈顿',
}
# ---- 主风格判定优先级（互斥，命中即止） ----
STYLE_PRIORITY = [
    ('无酒精', ['无酒精']),
    ('提基', ['提基']),
    ('咖啡', ['咖啡']),
    ('烟熏', ['烟熏']),
    ('尼格罗尼系', ['尼格罗尼系']),
    ('苦味', ['苦味']),
    ('辛香', ['辛香']),
    ('餐后甜', ['餐后甜']),
    ('咸鲜', ['咸鲜']),
    ('酸', ['酸']),
    ('花香', ['花香']),
    ('草本', ['草本']),
    ('果味', ['果味']),
    ('甜', ['甜']),
    ('气泡', ['气泡']),
    ('清爽', ['清爽', '柑橘']),
    ('热带', ['热带']),
    ('夏饮', ['夏饮']),
    ('轻盈', ['轻盈']),
    ('复杂层次', ['复杂层次']),
]
# ---- 基酒推断关键词 ----
BASE_RULES = [
    ('金酒',   ['gin']),
    ('伏特加', ['vodka']),
    ('朗姆',   ['rum']),
    ('威士忌', ['whiskey', 'bourbon', 'scotch', 'rye', 'irish whiskey']),
    ('龙舌兰', ['tequila', 'mezcal']),
    ('白兰地', ['cognac', 'brandy', 'apple brandy', 'calvados', 'pisco', 'grappa', 'cherry brandy']),
    ('葡萄酒', ['vermouth', 'wine', 'sherry', 'port', 'champagne', 'prosecco', 'marsala']),
    ('其他',   []),
]


ING_META = {}   # 原料元信息缓存，main() 填充


def classify(recipe_tags, ings, ing_meta):
    """返回 (风格列表, 主风格, 基酒, 谱系)。

    风格：多选（来自标签），主风格互斥（标签优先，无标签时按用料推断）
    基酒：从原料推断
    谱系：经典 / 当代 / 提基
    """
    tags = recipe_tags or []
    styles = []
    for t in tags:
        zh = STYLE_ZH.get(t)
        if zh and zh not in styles:
            styles.append(zh)

    names = [i.get('n') or '' for i in ings]
    low = ' '.join(names).lower()
    cats = ' '.join((ing_meta.get(n) or {}).get('catTop', '') for n in names)

    # ---------- 基酒 ----------
    base = '其他'
    for name, keys in BASE_RULES:
        if any(k in low for k in keys):
            base = name
            break

    # ---------- 谱系 ----------
    lineage = '现代'
    if 'The Unforgettables' in tags or 'Contemporary Classics' in tags \
       or 'New Era Drinks' in tags or 'Classics' in tags or 'Classic' in tags \
       or 'Old Fashioned' in tags or 'IBA Cocktail' in tags:
        lineage = '经典'
    if 'Tiki' in tags:
        lineage = '提基'

    # ---------- 主风格 ----------
    main_style = ''
    for name, keys in STYLE_PRIORITY:
        if any(k in styles for k in keys):
            main_style = name
            break
    if not main_style:
        # 无标签 → 按用料推断
        has_spirit = any(c in cats for c in ('Spirits', 'Liqueurs', 'Brandy', 'Wine', 'Fortified wine'))
        has_citrus = ('lemon juice' in low) or ('lime juice' in low)
        has_juice = 'Juices' in cats
        has_syrup = 'Sweeteners' in cats
        has_soda = any(k in low for k in ('soda water', 'tonic water', 'ginger beer', 'champagne', 'prosecco', 'sparkling'))
        has_coffee = 'coffee' in low or 'espresso' in low
        bitter_n = sum(1 for k in ('bitter', 'amaro', 'campari', 'vermouth') if k in low)
        if not has_spirit:
            main_style = '无酒精'
        elif has_coffee:
            main_style = '咖啡'
        elif bitter_n >= 2:
            main_style = '苦味'
        elif has_citrus and not has_soda:
            main_style = '酸'
        elif has_juice:
            main_style = '果味'
        elif has_soda:
            main_style = '清爽'
        elif has_syrup:
            main_style = '甜'
        else:
            main_style = '经典'
    return styles, main_style, base, lineage


SCHEMA_VER = 2
R_FIELDS = ['id', 'name', 'desc', 'garnish', 'steps', 'abv', 'glass', 'glassZh',
            'method', 'methodZh', 'tags', 'styles', 'style', 'base', 'lineage',
            'tier', 'zh', 'ings']
I_FIELDS = ['ml', 'amt', 'u', 'opt', 'nonmetered', 'note']
IL_FIELDS = ['n', 'zh', 'refSize', 'refPrice']   # 原料全局表（n/zh/refSize/refPrice 与配方无关）
M_FIELDS = ['cat', 'catZh', 'catTop', 'catTopZh', 'abv', 'zh', 'desc']


def pack(recipes, ing_meta):
    """紧凑编码：顶层数组 + 原料全局表 + 引用数组。
    原料名/中文名/规格/参考价与配方无关，提到全局表按索引引用（无损）。
    实测 gzip 228 KB -> ~120 KB，解码在 app 侧完成，业务代码零改动。"""
    il = []            # 原料全局表
    il_idx = {}        # key -> 索引
    packed_r = []
    for r in recipes:
        ings = []
        for i in r['ings']:
            n = i.get('n', '')
            key = (n, i.get('zh') or '', i.get('refSize') or 0,
                   i.get('refPrice') if i.get('refPrice') is not None else None)
            if key not in il_idx:
                il_idx[key] = len(il)
                il.append(list(key))
            ings.append([
                il_idx[key], i.get('ml', 0), i.get('amt', 0), i.get('u', 'ml'),
                1 if i.get('opt') else 0, 1 if i.get('nonmetered') else 0,
                i.get('note') or None,
            ])
        packed_r.append([
            r.get('id', ''), r.get('name', ''), r.get('desc', ''), r.get('garnish', ''),
            r.get('steps', []), r.get('abv'), r.get('glass', ''), r.get('glassZh', ''),
            r.get('method', ''), r.get('methodZh', ''), r.get('tags', []), r.get('styles', []),
            r.get('style', ''), r.get('base', ''), r.get('lineage', ''), r.get('tier', 0),
            1 if r.get('zh') else 0, ings,
        ])
    packed_m = {}
    for k, v in ing_meta.items():
        packed_m[k] = [v.get('cat'), v.get('catZh'), v.get('catTop'), v.get('catTopZh'),
                       v.get('abv'), v.get('zh'), v.get('desc')]
    return {'v': SCHEMA_VER, 'fi': R_FIELDS, 'ii': I_FIELDS, 'il': IL_FIELDS, 'mi': M_FIELDS,
            'r': packed_r, 'm': packed_m, 'il_table': il}


def main():
    recs_raw = load_recipes()
    ings_raw = load_ingredients()

    # 数据缺失时必须大声报错 —— 之前静默产出 0 条配方，差点把整个项目清空
    if len(recs_raw) < 100 or len(ings_raw) < 50:
        print('❌ 上游数据缺失或异常：配方 %d 条 / 原料 %d 种' % (len(recs_raw), len(ings_raw)), file=sys.stderr)
        print('   请先按 data/README.md 的说明拉取 bar-assistant/data 仓库', file=sys.stderr)
        sys.exit(1)

    # 全量收录所有「可计量」的配方（不再只取经典 129 款）
    # tier=1 表示 IBA 经典 / 不可忘 classics，UI 里可按此筛选
    selected = {}
    for rid, d in recs_raw.items():
        tags = set(d.get('tags') or [])
        d['_tier'] = 1 if (tags & KEEP_TAGS or rid in WISHLIST) else 0
        selected[rid] = d

    # 先建原料元信息表（分类要用）
    global ING_META
    ING_META = {}
    for _n, _v in ings_raw.items():
        ING_META[_n] = {
            'cat': _v.get('category') or 'Other',
            'catTop': (_v.get('category') or 'Other').split('>')[0].strip(),
            'zh': _v.get('zh') or ZH.get(_n, ''),
        }

    recipes, used_ings = [], collections.OrderedDict()
    for rid, d in sorted(selected.items(), key=lambda kv: kv[1]['name'].lower()):
        r = convert_recipe(d)
        if not r:
            continue
        recipes.append(r)
        for i in r['ings']:
            if i['n']:
                used_ings.setdefault(i['n'], {'name': i['n']})

    # 原料目录：合并配方里用到的 + 数据仓库里的元信息
    ingredients = {}
    for name in used_ings:
        src = ings_raw.get(name, {})
        ingredients[name] = {
            'cat': src.get('category') or 'Other',
            'catZh': CAT_ZH.get(src.get('category') or 'Other', '其他'),
            # 一级分类（把 "Spirits > Whiskey > Bourbon" 拍平成 "烈酒"）
            'catTop': (src.get('category') or 'Other').split('>')[0].strip(),
            'catTopZh': CAT_ZH.get((src.get('category') or 'Other').split('>')[0].strip(), '其他'),
            'abv': src.get('strength'),
            'desc': shorten(src.get('description'), 80),
            'zh': ZH.get(name, ''),
        }

    # 归一化名称（大小写/空格差异），把 priceHints 挂到配方里实际用的名字上
    def norm(s):
        return (s or '').lower().strip().replace('-', ' ').replace("'", '')

    hint_by_norm = {norm(k): v for k, v in PRICE_HINTS.items()}
    zh_by_norm = {norm(k): v for k, v in ZH.items() if v.strip()}
    for r in recipes:
        for i in r['ings']:
            key = norm(i['n'])
            if key in hint_by_norm:
                size, price = hint_by_norm[key]
                i['refSize'] = size
                i['refPrice'] = price
            i['zh'] = zh_by_norm.get(key, '')

    # 英文原文（descEn/stepsEn/garnishEn）拆出去，页面上点「英文原文」时才加载
    english = {}
    for r in recipes:
        e = {}
        if r.get('descEn'):    e['descEn'] = r['descEn']
        if r.get('stepsEn'):   e['stepsEn'] = r['stepsEn']
        if r.get('garnishEn'): e['garnishEn'] = r['garnishEn']
        if e:
            english[r['id']] = e
    for r in recipes:
        r.pop('descEn', None); r.pop('stepsEn', None); r.pop('garnishEn', None)

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    packed = pack(recipes, ingredients)
    packed['meta'] = {
        'source': 'bar-assistant/data (MIT) — https://github.com/bar-assistant/data',
        'generated': '2026-10-23',
    }

    out = os.path.join(root, 'bar-data.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(packed, f, ensure_ascii=False, separators=(',', ':'))

    en_out = os.path.join(root, 'bar-data.en.json')
    with open(en_out, 'w', encoding='utf-8') as f:
        json.dump(english, f, ensure_ascii=False, separators=(',', ':'))

    # 可读版（供开发者查看 / 二次开发），不入库
    with open(os.path.join(root, 'bar-data.pretty.json'), 'w', encoding='utf-8') as f:
        json.dump({'recipes': recipes, 'ingredients': ingredients}, f, ensure_ascii=False, indent=1)

    size_kb = os.path.getsize(out) / 1024
    print(f'配方 {len(recipes)} 条 · 原料 {len(ingredients)} 种 · {size_kb:.0f} KB → {out}')

    # 覆盖度自检
    metered = collections.Counter()
    for r in recipes:
        for i in r['ings']:
            if not i['nonmetered']:
                metered[i['n']] += 1
    print(f'可计量原料种类: {len(metered)}')
    print('Top15:', ', '.join(f'{n}({c})' for n, c in metered.most_common(15)))


if __name__ == '__main__':
    main()
