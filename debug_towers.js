// 簡化的塔測試代碼
console.log('開始測試新塔功能...');

// 測試塔定義
const towerTypes = {
    flame: {
        cost: 170, damage: 45, range: 95, fireRate: 1300, color: '#ff4400',
        type: 'flame', upgradeCost: 255, maxLevel: 3,
        description: '火焰塔，噴射火焰造成持續燃燒傷害'
    },
    tornado: {
        cost: 190, damage: 50, range: 85, fireRate: 1800, color: '#88ff88',
        type: 'tornado', upgradeCost: 285, maxLevel: 3,
        description: '旋風塔，在周圍旋轉攻擊所有敵人'
    }
};

console.log('塔定義:', towerTypes);

// 測試建造邏輯
function testPlaceTower(towerType) {
    console.log('嘗試建造塔:', towerType);
    
    if (!towerTypes[towerType]) {
        console.error('塔類型不存在:', towerType);
        return false;
    }
    
    const tower = towerTypes[towerType];
    console.log('塔數據:', tower);
    
    // 模擬建造檢查
    const mockMoney = 500;
    if (mockMoney >= tower.cost) {
        console.log('資金足夠，可以建造');
        return true;
    } else {
        console.log('資金不足');
        return false;
    }
}

// 測試火焰塔
console.log('=== 測試火焰塔 ===');
testPlaceTower('flame');

// 測試旋風塔
console.log('=== 測試旋風塔 ===');
testPlaceTower('tornado');

// 測試不存在的塔
console.log('=== 測試不存在的塔 ===');
testPlaceTower('nonexistent');

console.log('測試完成');