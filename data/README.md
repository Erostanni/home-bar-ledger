# 数据来源说明

本目录的文件改编自 **[bar-assistant/data](https://github.com/bar-assistant/data)**，
原作者 Bar Assistant，MIT 协议（完整许可见本目录 `LICENSE`）。

## 包含什么

| 文件 | 用途 |
|---|---|
| `schema.json` | 上游的鸡尾酒配方 JSON Schema（draft-02），构建脚本的字段依据 |
| `data/base_*.json` | 杯型、技法、器具、分类、价格类别、风味描述等基础词表 |
| `data/calculators.json` | 上游的换算计算器定义 |

## 构建流程

`build/build_data.py` 从上游仓库解压后的完整数据中抽取 129 款经典配方，做以下处理：

1. **筛选** —— 优先取 `IBA Cocktail` / `The Unforgettables` / `Contemporary Classics` / `New Era Drinks` 标签
2. **单位归一** —— oz → ml、barspoon → 5ml、dash → 0.9ml；slice / wedge 等装饰类标记为「非计量」，不参与库存扣减
3. **中文化** —— 原料名、分类、杯型、技法、配方描述、做法、装饰（见 `build/translations.py`）
4. **参考价** —— 预置常见规格的粗略估价（可在酒柜里改），来源 `build/build_data.py` 的 `PRICE_HINTS`

产物是仓库根目录的 `bar-data.json`，再由 `build/compile.py` 注入 `index.html`。

## 重新获取上游数据

```bash
curl -sSL -o /tmp/ba.tar.gz https://github.com/bar-assistant/data/archive/refs/heads/data-5.tar.gz
tar xzf /tmp/ba.tar.gz --strip-components=1 -C data/ --wildcards 'data-5/data/*/data.json' 'data-5/data/*.json' 'data-5/LICENSE' 'data-5/schema.json'
python3 build/build_data.py
```

> 上游默认分支是 `data-5`，不是 `master`。命令里别写错。

## 许可

上游 MIT，分发时请保留 `data/LICENSE` 与本目录说明。
