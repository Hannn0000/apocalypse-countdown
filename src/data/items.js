// 物品数据。体积单位：升（L），1 m³ = 1000 L。使用整数避免浮点误差。
export const CATEGORIES = ['食物', '饮水', '医疗', '工具', '日用品', '其他'];

export const CATEGORY_COLORS = {
  食物: '#f0a24a',
  饮水: '#4fb3ff',
  医疗: '#ff5d6c',
  工具: '#a4adb8',
  日用品: '#e8d3a2',
  其他: '#b18cff',
};

export const ITEMS = {
  // 购物 App
  rice: { name: '大米 10kg', short: '大米', price: 55, vol: 200, cat: '食物', icon: '🌾', unit: '袋', desc: '一袋 10 公斤装东北大米。' },
  water: { name: '矿泉水 24瓶', short: '矿泉水', price: 24, vol: 250, cat: '饮水', icon: '💧', unit: '箱', desc: '24 瓶装矿泉水，末日里最珍贵的东西之一。' },
  noodles: { name: '方便面 1箱', short: '方便面', price: 48, vol: 300, cat: '食物', icon: '🍜', unit: '箱', desc: '一箱 24 包方便面。' },
  cans: { name: '罐头 1箱', short: '罐头', price: 120, vol: 200, cat: '食物', icon: '🥫', unit: '箱', desc: '午餐肉、黄桃、鱼罐头混合装。' },
  tissue: { name: '卫生纸 1提', short: '卫生纸', price: 28, vol: 350, cat: '日用品', icon: '🧻', unit: '提', desc: '一提 10 卷卫生纸。' },
  medkit: { name: '医疗箱', short: '医疗箱', price: 180, vol: 150, cat: '医疗', icon: '🩹', unit: '个', desc: '绷带、消毒液、退烧药和常用药品。' },
  flashlight: { name: '手电筒', short: '手电筒', price: 60, vol: 20, cat: '工具', icon: '🔦', unit: '个', desc: '强光充电手电筒。' },
  toolbox: { name: '工具箱', short: '工具箱', price: 350, vol: 300, cat: '工具', icon: '🧰', unit: '个', desc: '锤子、扳手、螺丝刀等全套工具。' },
  // 外卖 App
  friedrice: { name: '炒饭', short: '炒饭', price: 15, vol: 10, cat: '食物', icon: '🍛', unit: '份', desc: '热腾腾的扬州炒饭。在空间里永远不会凉。' },
  chickenrice: { name: '鸡腿饭', short: '鸡腿饭', price: 22, vol: 10, cat: '食物', icon: '🍱', unit: '份', desc: '大鸡腿配米饭和青菜。' },
  roastchicken: { name: '烧鸡', short: '烧鸡', price: 45, vol: 20, cat: '食物', icon: '🍗', unit: '只', desc: '整只烧鸡，香气扑鼻。' },
  baozi: { name: '包子（10个）', short: '包子', price: 25, vol: 15, cat: '食物', icon: '🥟', unit: '袋', desc: '十个猪肉白菜包子。' },
  hotpot: { name: '火锅套餐', short: '火锅套餐', price: 128, vol: 80, cat: '食物', icon: '🍲', unit: '份', desc: '双人火锅套餐，锅底和配菜齐全。' },
  // 其他
  photo: { name: '全家福相框', short: '全家福', price: 0, vol: 2, cat: '其他', icon: '🖼️', unit: '个', desc: '和爸妈的合影。这一世，一定要守住重要的东西。', noShop: true },
};

export const SHOP_ITEMS = ['rice', 'water', 'noodles', 'cans', 'tissue', 'medkit', 'flashlight', 'toolbox'];
export const FOOD_ITEMS = ['friedrice', 'chickenrice', 'roastchicken', 'baozi', 'hotpot'];

// 配送时间（游戏分钟）。探索时 1 秒现实时间 = 2 游戏分钟，因此约 25~45 秒送达。
export const DELIVERY_MINUTES = { food: 50, shop: 90 };

export function formatVolume(liters) {
  return String(Number((liters / 1000).toFixed(2)));
}

export function formatMoney(n) {
  return '¥' + Math.round(n).toLocaleString('en-US');
}
