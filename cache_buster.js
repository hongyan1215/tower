// 緩存破壞器 - 強制瀏覽器重新加載資源
(function() {
    'use strict';
    
    // 添加版本號到URL參數來破壞緩存
    const version = Date.now();
    
    // 檢查是否需要重新加載
    const currentVersion = localStorage.getItem('gameVersion');
    const expectedVersion = '2024.12.17.001'; // 更新這個版本號
    
    if (currentVersion !== expectedVersion) {
        console.log('檢測到新版本，清除緩存...');
        
        // 清除localStorage緩存
        localStorage.setItem('gameVersion', expectedVersion);
        
        // 強制重新加載頁面（帶緩存破壞參數）
        if (!window.location.search.includes('v=')) {
            window.location.href = window.location.href + '?v=' + version;
            return;
        }
    }
    
    console.log('遊戲版本:', expectedVersion);
})();