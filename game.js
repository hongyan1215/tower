class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.gameState = {
            health: 100,
            money: 800,
            wave: 1,
            displayWave: 0, // UI顯示的波次，在第一個敵人出現時更新
            selectedTower: null,
            selectedTowerObj: null,
            waveInProgress: false,
            timeBetweenWaves: 10000,
            waveTimer: 0,
            currentMission: null,
            missionProgress: {},
            completedMissions: 0,
            lastHealTime: 0, // 全局治療冷卻
            healCooldown: 2000, // 2秒治療冷卻
            gameOver: false // 遊戲結束標記
        };
        
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.beams = []; // 雷射光束效果
        this.explosions = []; // 爆炸效果
        this.path = this.generatePath();
        
        this.lastTime = 0;
        this.enemySpawnTimer = 0;
        this.waveEnemyCount = 8;
        this.enemiesSpawned = 0;
        this.waveData = this.generateWaveData();
        this.currentWaveEnemies = [];
        this.mouseX = 0;
        this.mouseY = 0;
        
        // 特效變量
        this.damageFlash = 0;
        this.screenShake = 0;
        this.gameOverEffect = false;
        
        // 任務系統
        this.missions = this.initializeMissions();
        this.generateNewMission();
        
        this.setupEventListeners();
        this.updateUI(); // 初始化UI顯示
        this.updateNextWaveInfo(); // 初始化波次信息顯示
        this.gameLoop();
    }
    
    generatePath() {
        const path = [];
        const width = this.canvas.width;
        const height = this.canvas.height;
        const uiWidth = 350; // UI區域寬度
        const margin = 30; // 一般邊距
        
        // 路徑可用區域：從UI右側開始到畫布右邊
        const pathStartX = uiWidth + 20; // UI右側留20像素間隔
        const pathWidth = width - pathStartX - margin;
        const pathHeight = height - margin * 2;
        
        // 創建不與UI重疊的路徑
        const pathType = Math.floor(Math.random() * 3);
        
        switch(pathType) {
            case 0: // S型路徑
                for (let i = 0; i <= 25; i++) {
                    const progress = i / 25;
                    const x = pathStartX + progress * pathWidth;
                    const amplitude = Math.min(80, pathHeight / 3);
                    const y = height / 2 + Math.sin(progress * Math.PI * 3) * amplitude;
                    path.push({ x, y });
                }
                break;
                
            case 1: // 螺旋路徑
                const centerX = pathStartX + pathWidth / 2;
                const centerY = height / 2;
                const maxRadius = Math.min(pathWidth / 3, pathHeight / 3, 100);
                
                for (let i = 0; i <= 25; i++) {
                    const progress = i / 25;
                    const angle = progress * Math.PI * 3;
                    const radius = maxRadius - progress * (maxRadius * 0.7);
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    path.push({ x, y });
                }
                break;
                
            case 2: // 之字形路徑
                for (let i = 0; i <= 20; i++) {
                    const progress = i / 20;
                    const x = pathStartX + progress * pathWidth;
                    const zigzag = Math.floor(progress * 8) % 2 === 0 ? 1 : -1;
                    const amplitude = Math.min(80, pathHeight / 3);
                    const y = height / 2 + zigzag * amplitude;
                    path.push({ x, y });
                }
                break;
        }
        
        // 確保路徑點都在有效範圍內
        return path.filter(point => 
            point.x >= pathStartX && point.x <= width - margin &&
            point.y >= margin && point.y <= height - margin
        );
    }
    
    initializeMissions() {
        return [
            {
                id: 'build_towers',
                name: '建造大師',
                description: '建造 {target} 座塔',
                type: 'build',
                targets: [3, 5, 8, 10, 15],
                rewards: {
                    money: [150, 220, 300, 450, 700],
                    special: ['none', 'none', 'none', 'none', 'none']
                }
            },
            {
                id: 'kill_enemies',
                name: '殲滅者',
                description: '擊殺 {target} 個敵人',
                type: 'kill',
                targets: [20, 50, 100, 200, 500],
                rewards: {
                    money: [120, 180, 270, 380, 600],
                    special: ['none', 'none', 'none', 'none', 'none']
                }
            },
            {
                id: 'build_specific_towers',
                name: '專業建造師',
                description: '建造 {target} 座 {towerType} 塔',
                type: 'build_specific',
                towerTypes: ['machinegun', 'sniper', 'cannon', 'freeze', 'chain', 'poison', 'multishot', 'debuff', 'money', 'heal'],
                towerNames: {
                    machinegun: '機槍',
                    sniper: '狙擊',
                    cannon: '加農砲',
                    freeze: '冰凍',
                    chain: '連鎖',
                    poison: '毒氣',
                    multishot: '多管',
                    debuff: '詛咒',
                    money: '金錢',
                    heal: '治療'
                },
                targets: [2, 3, 5],
                rewards: {
                    money: [180, 300, 500],
                    special: ['none', 'none', 'none']
                }
            },
            {
                id: 'upgrade_towers',
                name: '升級專家',
                description: '升級 {target} 座塔',
                type: 'upgrade',
                targets: [2, 4, 6, 8, 12],
                rewards: {
                    money: [220, 380, 600, 900, 1300],
                    special: ['none', 'none', 'none', 'none', 'none']
                }
            },

        ];
    }
    
    generateNewMission() {
        if (this.gameState.currentMission) return;
        
        const availableMissions = this.missions.filter(mission => {
            // 根據遊戲進度過濾任務
            if (mission.type === 'build_specific' && this.gameState.wave < 2) return false;
            if (mission.type === 'upgrade' && this.gameState.wave < 3) return false;
            return true;
        });
        
        if (availableMissions.length === 0) return;
        
        const mission = availableMissions[Math.floor(Math.random() * availableMissions.length)];
        const difficulty = Math.min(Math.floor(this.gameState.wave / 5), mission.targets.length - 1);
        
        this.gameState.currentMission = {
            ...mission,
            target: mission.targets[difficulty],
            reward: mission.rewards.money[difficulty],
            specialReward: mission.rewards.special[difficulty],
            progress: 0,
            startWave: this.gameState.wave
        };
        
        // 特殊任務設置
        if (mission.type === 'build_specific') {
            const selectedTowerType = mission.towerTypes[Math.floor(Math.random() * mission.towerTypes.length)];
            this.gameState.currentMission.towerType = selectedTowerType;
            this.gameState.currentMission.towerName = mission.towerNames[selectedTowerType];
        }
        
        // 重置任務進度
        this.gameState.missionProgress = {};
        
        this.updateMissionUI();
    }
    

    
    setupEventListeners() {
        // 塔選擇
        document.querySelectorAll('.tower-button[data-tower]').forEach(button => {
            button.addEventListener('click', (e) => {
                document.querySelectorAll('.tower-button').forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');
                this.gameState.selectedTower = e.target.dataset.tower;
                this.gameState.selectedTowerObj = null;
            });
        });
        
        // 升級塔
        document.getElementById('upgradeBtn').addEventListener('click', () => {
            if (this.gameState.selectedTowerObj) {
                this.upgradeTower(this.gameState.selectedTowerObj);
            }
        });
        
        // 出售塔
        document.getElementById('sellBtn').addEventListener('click', () => {
            if (this.gameState.selectedTowerObj) {
                this.sellTower(this.gameState.selectedTowerObj);
            }
        });
        
        // 提前開始波次
        document.getElementById('startWaveBtn').addEventListener('click', () => {
            if (!this.gameState.waveInProgress) {
                this.gameState.money += 50;
                
                // 檢查是否觸發隨機事件
                this.checkRandomEvent();
            }
        });
        
        // 放置塔或選擇塔
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 檢查是否點擊了現有的塔
            const clickedTower = this.towers.find(tower => {
                const dist = Math.sqrt((tower.x - x) ** 2 + (tower.y - y) ** 2);
                return dist <= 20;
            });
            
            if (clickedTower) {
                this.selectTower(clickedTower);
            } else if (this.gameState.selectedTower) {
                this.placeTower(x, y);
            }
        });
        
        // 添加鼠標移動事件來顯示建造預覽（節流處理）
        let mouseUpdateTimer = null;
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.gameState.selectedTower) {
                // 節流處理，避免過於頻繁的更新
                if (mouseUpdateTimer) return;
                
                mouseUpdateTimer = setTimeout(() => {
                    const rect = this.canvas.getBoundingClientRect();
                    this.mouseX = e.clientX - rect.left;
                    this.mouseY = e.clientY - rect.top;
                    mouseUpdateTimer = null;
                }, 16); // 約60FPS
            } else {
                this.mouseX = 0;
                this.mouseY = 0;
            }
        });
        
        // 添加鼠標離開事件
        this.canvas.addEventListener('mouseleave', () => {
            this.mouseX = 0;
            this.mouseY = 0;
        });
    }
    
    generateWaveData() {
        const wave = this.gameState.wave;
        const enemyTypes = [];
        
        // 基礎敵人 - 第一波減少數量
        if (wave === 1) {
            enemyTypes.push({ type: 'basic', count: 4 }); // 第一波只有4個敵人
        } else {
            enemyTypes.push({ type: 'basic', count: Math.floor(5 + wave * 1.5) });
        }
        
        // 從第2波開始出現快速敵人
        if (wave >= 2) {
            enemyTypes.push({ type: 'fast', count: Math.floor(2 + wave * 0.8) });
        }
        
        // 從第3波開始出現重裝敵人
        if (wave >= 3) {
            enemyTypes.push({ type: 'heavy', count: Math.floor(1 + wave * 0.5) });
        }
        
        // 從第5波開始出現飛行敵人
        if (wave >= 5) {
            enemyTypes.push({ type: 'flying', count: Math.floor(wave * 0.3) });
        }
        
        // 從第7波開始出現隱形敵人
        if (wave >= 7) {
            enemyTypes.push({ type: 'stealth', count: Math.floor(wave * 0.2) });
        }
        
        // 從第10波開始出現BOSS
        if (wave >= 10 && wave % 5 === 0) {
            enemyTypes.push({ type: 'boss', count: 1 });
        }
        
        return enemyTypes;
    }
    
    placeTower(x, y) {
        const towerTypes = {
            machinegun: { 
                cost: 80, damage: 12, range: 90, fireRate: 200, color: '#00ff00',
                type: 'machinegun', upgradeCost: 120, maxLevel: 4,
                description: '快速連射機槍，適合清理大量弱敵'
            },
            sniper: { 
                cost: 200, damage: 320, range: 280, fireRate: 1800, color: '#ff0000',
                type: 'sniper', upgradeCost: 300, maxLevel: 3,
                description: '超遠射程狙擊，單發超高傷害'
            },
            cannon: { 
                cost: 180, damage: 100, range: 130, fireRate: 1400, color: '#ffaa00',
                type: 'cannon', upgradeCost: 270, maxLevel: 3,
                description: '範圍爆炸攻擊，對群體敵人有效'
            },
            freeze: {
                cost: 100, damage: 25, range: 100, fireRate: 700, color: '#00ffff',
                type: 'freeze', upgradeCost: 150, maxLevel: 3,
                description: '冰凍攻擊，大幅減速敵人'
            },
            chain: {
                cost: 220, damage: 70, range: 120, fireRate: 900, color: '#9900ff',
                type: 'chain', upgradeCost: 330, maxLevel: 3,
                description: '連鎖閃電，可跳躍攻擊多個敵人'
            },
            poison: {
                cost: 140, damage: 35, range: 100, fireRate: 1100, color: '#99ff00',
                type: 'poison', upgradeCost: 210, maxLevel: 3,
                description: '毒氣雲攻擊，對範圍內所有敵人造成傷害'
            },
            multishot: {
                cost: 250, damage: 60, range: 115, fireRate: 750, color: '#ff6600',
                type: 'multishot', upgradeCost: 375, maxLevel: 3,
                description: '多管齊射，同時攻擊多個目標'
            },
            debuff: {
                cost: 150, damage: 45, range: 95, fireRate: 900, color: '#cc00cc',
                type: 'debuff', upgradeCost: 225, maxLevel: 3,
                description: '詛咒攻擊，增加敵人受到的傷害'
            },
            money: {
                cost: 150, damage: 0, range: 0, fireRate: 6000, color: '#ffff00',
                type: 'money', upgradeCost: 225, maxLevel: 3,
                description: '戰術經濟塔，根據戰況提供金錢獎勵'
            },
            heal: {
                cost: 160, damage: 50, range: 70, fireRate: 3500, color: '#00ff88',
                type: 'heal', upgradeCost: 240, maxLevel: 3,
                description: '增強治療塔，攻擊敵人並提供強力治療'
            }
        };
        
        const towerType = towerTypes[this.gameState.selectedTower];
        
        if (this.gameState.money >= towerType.cost) {
            // 檢查建造條件
            const canBuild = this.canBuildAt(x, y);
            if (canBuild.allowed) {
                const tower = new Tower(x, y, towerType);
                this.towers.push(tower);
                this.gameState.money -= towerType.cost;
                this.updateUI();
                
                // 更新任務進度
                this.updateMissionProgress('build', { towerType: towerType.type });
            }
        }
    }
    
    canBuildAt(x, y) {
        // 檢查是否在畫布範圍內
        if (x < 15 || x > this.canvas.width - 15 || y < 15 || y > this.canvas.height - 15) {
            return { allowed: false, reason: '超出邊界' };
        }
        
        // 檢查是否在UI區域內（左側UI面板）
        if (x < 350) {
            return { allowed: false, reason: '在UI區域內' };
        }
        
        // 檢查是否在路徑上（進一步減少檢測半徑）
        if (this.isOnPath(x, y, 15)) {
            return { allowed: false, reason: '在路徑上' };
        }
        
        // 檢查是否太靠近其他塔
        if (this.isTooCloseToTower(x, y)) {
            return { allowed: false, reason: '太靠近其他塔' };
        }
        return { allowed: true, reason: '可以建造' };
    }
    
    isTooCloseToTower(x, y) {
        for (const tower of this.towers) {
            const dist = Math.sqrt((tower.x - x) ** 2 + (tower.y - y) ** 2);
            if (dist < 25) return true;
        }
        return false;
    }
    

    
    selectTower(tower) {
        // 取消選擇塔類型
        document.querySelectorAll('.tower-button').forEach(b => b.classList.remove('selected'));
        this.gameState.selectedTower = null;
        this.gameState.selectedTowerObj = tower;
        
        // 高亮選中的塔
        this.towers.forEach(t => t.selected = false);
        tower.selected = true;
    }
    
    upgradeTower(tower) {
        let upgradeCost = tower.upgradeCost;
        
        // 檢查升級折扣
        if (this.gameState.upgradeDiscount && Date.now() < this.gameState.discountExpiry) {
            upgradeCost = Math.floor(upgradeCost * this.gameState.upgradeDiscount);
        }
        
        if (tower.level < tower.maxLevel && this.gameState.money >= upgradeCost) {
            this.gameState.money -= upgradeCost;
            tower.upgrade();
            
            // 如果使用了折扣，清除折扣狀態
            if (this.gameState.upgradeDiscount && Date.now() < this.gameState.discountExpiry) {
                this.gameState.upgradeDiscount = null;
                this.gameState.discountExpiry = null;
            }
            
            // 更新升級任務進度
            this.updateMissionProgress('upgrade', { towerType: tower.type });
            
            this.updateUI();
        }
    }
    
    sellTower(tower) {
        const sellPrice = Math.floor(tower.totalCost * 0.7);
        this.gameState.money += sellPrice;
        
        const index = this.towers.indexOf(tower);
        if (index > -1) {
            this.towers.splice(index, 1);
        }
        
        this.gameState.selectedTowerObj = null;
        this.updateUI();
    }
    
    isOnPath(x, y, radius = 15) {
        // 檢查是否太靠近路徑
        if (this.path.length < 2) return false;
        
        for (let i = 0; i < this.path.length - 1; i++) {
            const p1 = this.path[i];
            const p2 = this.path[i + 1];
            
            // 跳過無效的路徑點
            if (!p1 || !p2 || isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) {
                continue;
            }
            
            const dist = this.distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
            if (dist < radius) return true;
        }
        return false;
    }
    
    distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }
    
    startNextWave() {
        this.gameState.waveInProgress = true;
        this.gameState.allEnemiesSpawned = false; // 重置敵人生成完成狀態
        this.waveData = this.generateWaveData();
        this.currentWaveEnemies = [];
        
        // 記錄波次開始時間（用於閃電戰任務）
        this.gameState.waveStartTime = Date.now();
        
        // 準備當前波次的所有敵人
        this.waveData.forEach(enemyGroup => {
            for (let i = 0; i < enemyGroup.count; i++) {
                this.currentWaveEnemies.push(enemyGroup.type);
            }
        });
        
        // 打亂敵人順序
        this.currentWaveEnemies.sort(() => Math.random() - 0.5);
        this.enemiesSpawned = 0;
        this.updateUI();
    }
    
    spawnEnemy() {
        if (this.gameState.waveInProgress && this.enemiesSpawned < this.currentWaveEnemies.length) {
            const enemyType = this.currentWaveEnemies[this.enemiesSpawned];
            this.enemies.push(new Enemy(this.path, this.gameState.wave, enemyType));
            this.enemiesSpawned++;
            
            // 第一個敵人出現時更新UI顯示的波次數字
            if (this.enemiesSpawned === 1) {
                this.gameState.displayWave = this.gameState.wave;
                this.updateUI();
            }
        }
    }
    
    updateUI() {
        document.getElementById('health').textContent = this.gameState.health;
        document.getElementById('money').textContent = this.gameState.money;
        document.getElementById('wave').textContent = this.gameState.displayWave;
    }
    
    updateMissionUI() {
        const mission = this.gameState.currentMission;
        
        if (!mission) {
            document.getElementById('missionName').textContent = '無任務';
            document.getElementById('missionDesc').textContent = '等待新任務...';
            document.getElementById('missionProgress').textContent = '進度: 0/0';
            document.getElementById('missionReward').textContent = '獎勵: 0金';
            return;
        }
        
        document.getElementById('missionName').textContent = mission.name;
        
        let description = mission.description.replace('{target}', mission.target);
        
        // 處理特定塔類型任務的描述
        if (mission.towerName) {
            description = description.replace('{towerType}', mission.towerName);
        }
        
        document.getElementById('missionDesc').textContent = description;
        document.getElementById('missionProgress').textContent = `進度: ${mission.progress}/${mission.target}`;
        
        // 一般任務只顯示金錢獎勵
        const rewardText = `獎勵: ${mission.reward}金`;
        document.getElementById('missionReward').textContent = rewardText;
    }
    
    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        
        // 限制FPS到60，避免過度渲染
        if (deltaTime < 16.67) {
            requestAnimationFrame((time) => this.gameLoop(time));
            return;
        }
        
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update(deltaTime) {
        // 如果遊戲已結束，停止更新遊戲邏輯
        if (this.gameState.gameOver) {
            // 只更新粒子效果，讓死亡特效播放完
            this.particles.forEach((particle, index) => {
                particle.update(deltaTime);
                if (particle.life <= 0) {
                    this.particles.splice(index, 1);
                }
            });
            return;
        }
        
        // 波次管理
        if (!this.gameState.waveInProgress) {
            this.gameState.waveTimer += deltaTime;
            // 第一波給更長的準備時間，其他波次維持10秒
            const waveInterval = this.gameState.displayWave === 0 ? 15000 : this.gameState.timeBetweenWaves;
            if (this.gameState.waveTimer >= waveInterval) {
                this.startNextWave();
                this.gameState.waveTimer = 0;
            }
        } else {
            // 生成敵人
            this.enemySpawnTimer += deltaTime;
            // 第一波給更長的生成間隔
            const baseInterval = this.gameState.wave === 1 ? 1500 : 1000;
            const spawnInterval = Math.max(300, baseInterval - this.gameState.wave * 50);
            if (this.enemySpawnTimer > spawnInterval) {
                this.spawnEnemy();
                this.enemySpawnTimer = 0;
            }
        }
        
        // 更新敵人
        this.enemies.forEach((enemy, index) => {
            enemy.update(deltaTime);
            if (enemy.reachedEnd) {
                let damage = enemy.damage;
                
                // 檢查治療塔3級神聖祝福效果
                if (this.gameState.blessedUntil && Date.now() < this.gameState.blessedUntil) {
                    damage = Math.floor(damage * 0.5); // 減少50%傷害
                    // 祝福抵擋傷害的視覺效果
                    for (let i = 0; i < 8; i++) {
                        this.particles.push(new Particle(enemy.x, enemy.y, '#ffff88', 1.5));
                    }
                }
                
                this.gameState.health -= damage;
                
                // 受傷特效
                for (let i = 0; i < 15; i++) {
                    const x = Math.random() * this.canvas.width;
                    const y = Math.random() * this.canvas.height;
                    this.particles.push(new Particle(x, y, '#ff0000', 2.0, 'damage'));
                }
                
                // 屏幕邊緣紅色閃爍效果
                this.damageFlash = 0.5; // 添加受傷閃爍
                
                this.enemies.splice(index, 1);
                this.updateUI();
                
                if (this.gameState.health <= 0 && !this.gameState.gameOver) {
                    this.gameState.gameOver = true; // 標記遊戲結束，防止重複觸發
                    this.gameOver();
                }
            } else if (enemy.health <= 0) {
                this.gameState.money += enemy.reward;
                this.enemies.splice(index, 1);
                this.updateUI();
                // 死亡粒子效果
                this.createDeathParticles(enemy.x, enemy.y, enemy.color);
                
                // 檢查是否是特殊敵人
                if (this.gameState.specialEvent && 
                    (enemy.type === 'elite_special' || enemy.type === 'giant_special' || enemy.type === 'speedster_special')) {
                    // 特殊敵人被擊殺，檢查事件完成
                    setTimeout(() => this.checkSpecialEventCompletion(), 100);
                }
                
                // 通知金錢塔獲得擊殺獎勵
                this.towers.forEach(tower => {
                    if (tower.type === 'money') {
                        tower.lastKillBonus = Date.now();
                    }
                });
                
                // 更新任務進度
                this.updateMissionProgress('kill', { enemy, killedBy: enemy.killedBy || 'unknown' });
            }
        });
        
        // 更新塔
        this.towers.forEach(tower => {
            tower.update(deltaTime, this.enemies, this.projectiles, this.particles);
        });
        
        // 更新子彈
        this.projectiles.forEach((projectile, index) => {
            projectile.update(deltaTime, this.enemies, this.particles);
            if (projectile.shouldRemove) {
                this.projectiles.splice(index, 1);
            }
        });
        
        // 更新粒子
        this.particles.forEach((particle, index) => {
            particle.update(deltaTime);
            if (particle.life <= 0) {
                this.particles.splice(index, 1);
            }
        });
        
        // 更新雷射光束
        this.beams.forEach((beam, index) => {
            beam.update(deltaTime);
            if (beam.life <= 0) {
                this.beams.splice(index, 1);
            }
        });
        
        // 更新爆炸效果
        this.explosions.forEach((explosion, index) => {
            explosion.update(deltaTime);
            if (explosion.life <= 0) {
                this.explosions.splice(index, 1);
            }
        });
        

        
        // 檢查波次結束
        if (this.gameState.waveInProgress) {
            if (this.enemiesSpawned >= this.currentWaveEnemies.length) {
                // 所有敵人已生成，立即進入下一波並開始計時
                this.completeCurrentWave();
            }
        }
        

        
        // 檢查是否所有敵人都被擊殺
        if (this.gameState.allEnemiesSpawned && this.enemies.length === 0 && !this.gameState.waveCompleted) {
            // 標記波次完成，但繼續計時
            this.gameState.waveCompleted = true;
        }
        
        this.updateNextWaveInfo();
    }
    

    
    createDeathParticles(x, y, color = '#ff4444') {
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(x, y, color, 1.5));
        }
    }
    
    completeCurrentWave() {
        // 敵人生成完畢，立即進入下一波
        this.gameState.wave++;
        // 注意：displayWave會在下一波第一個敵人出現時更新
        this.gameState.allEnemiesSpawned = true;
        this.gameState.waveInProgress = false;
        this.gameState.waveTimer = 0;
        this.gameState.waveCompleted = false;
        
        // 給予波次完成獎勵
        this.gameState.money += 100 + this.gameState.wave * 10;
        
        // 更新任務進度
        this.updateMissionProgress('kill', {}); // 觸發任務完成檢查
        
        // 有機會生成新任務
        if (!this.gameState.currentMission && Math.random() < 0.7) {
            this.generateNewMission();
        }
        
        this.updateUI();
    }
    
    nextWave() {
        // 重置狀態，準備開始新波次
        this.gameState.waveInProgress = false;
        this.gameState.waveTimer = 0;
        this.enemiesSpawned = 0;
        this.gameState.allEnemiesSpawned = false;
        this.gameState.waveCompleted = false;
        
        this.updateUI();
    }
    
    updateMissionProgress(type, data) {
        if (!this.gameState.currentMission) return;
        
        const mission = this.gameState.currentMission;
        
        switch(mission.type) {
            case 'build':
                if (type === 'build') {
                    mission.progress++;
                }
                break;
                
            case 'kill':
                if (type === 'kill') {
                    mission.progress++;
                }
                break;
                
            case 'build_specific':
                if (type === 'build' && data.towerType === mission.towerType) {
                    mission.progress++;
                }
                break;
                
            case 'upgrade':
                if (type === 'upgrade') {
                    mission.progress++;
                }
                break;
                
            case 'speed_clear':
                // 這個會在波次開始時記錄時間，結束時檢查
                break;
        }
        
        this.checkMissionCompletion();
        this.updateMissionUI();
    }
    
    checkMissionCompletion() {
        if (!this.gameState.currentMission) return;
        
        const mission = this.gameState.currentMission;
        let completed = false;
        
        switch(mission.type) {
            case 'build':
            case 'kill':
            case 'build_specific':
            case 'upgrade':
                completed = mission.progress >= mission.target;
                break;
        }
        
        if (completed) {
            this.completeMission();
        }
    }
    
    completeMission() {
        const mission = this.gameState.currentMission;
        
        // 給予獎勵
        this.gameState.money += mission.reward;
        this.gameState.completedMissions++;
        
        // 一般任務不再有特殊獎勵，只給金錢
        
        // 顯示完成消息
        this.showMissionComplete(mission);
        
        // 清除當前任務
        this.gameState.currentMission = null;
        
        this.updateUI();
        this.updateMissionUI();
    }
    
    applySpecialReward(reward) {
        switch(reward) {
            case 'health_boost':
                this.gameState.health = Math.min(100, this.gameState.health + 10); // 從20降到10
                break;
            case 'damage_boost':
                // 臨時增加所有塔的傷害（進一步降低強度）
                this.towers.forEach(tower => {
                    tower.tempDamageBoost = 1.15; // 從1.25降到1.15
                    tower.boostDuration = 15000; // 從20秒降到15秒
                });
                break;
            case 'upgrade_boost':
                // 給予升級折扣而不是免費升級
                this.gameState.upgradeDiscount = 0.5; // 50%升級折扣
                this.gameState.discountExpiry = Date.now() + 30000; // 30秒內有效
                break;
            case 'mega_bonus':
                this.gameState.money += 200; // 從300降到200
                this.gameState.health = Math.min(100, this.gameState.health + 20); // 從30降到20
                break;
        }
    }
    
    showMissionComplete(mission) {
        // 創建任務完成的視覺效果
        for (let i = 0; i < 50; i++) {
            this.particles.push(new Particle(
                this.canvas.width / 2 + (Math.random() - 0.5) * 200,
                this.canvas.height / 2 + (Math.random() - 0.5) * 100,
                '#ffff00',
                2
            ));
        }
    }
    
    updateNextWaveInfo() {
        const nextWaveElement = document.getElementById('nextWaveInfo');
        const startWaveBtn = document.getElementById('startWaveBtn');
        
        if (this.gameState.waveInProgress) {
            const remaining = this.currentWaveEnemies.length - this.enemiesSpawned + this.enemies.length;
            nextWaveElement.textContent = `剩餘敵人: ${remaining}`;
            startWaveBtn.style.display = 'none';
        } else if (this.gameState.allEnemiesSpawned && this.enemies.length > 0) {
            // 當前波次敵人還有存活，顯示剩餘敵人數和計時
            const timeLeft = Math.ceil((this.gameState.timeBetweenWaves - this.gameState.waveTimer) / 1000);
            nextWaveElement.textContent = `第${this.gameState.displayWave}波剩餘${this.enemies.length}敵人，${timeLeft}秒後第${this.gameState.wave}波`;
            // 第一波不顯示提前開始按鈕
            startWaveBtn.style.display = this.gameState.displayWave === 1 ? 'none' : 'inline-block';
        } else if (this.gameState.waveCompleted) {
            // 當前波次完成，顯示計時
            const timeLeft = Math.ceil((this.gameState.timeBetweenWaves - this.gameState.waveTimer) / 1000);
            nextWaveElement.textContent = `第${this.gameState.displayWave}波完成！${timeLeft}秒後第${this.gameState.wave}波`;
            // 第一波不顯示提前開始按鈕
            startWaveBtn.style.display = this.gameState.displayWave === 1 ? 'none' : 'inline-block';
        } else {
            // 準備階段，顯示即將開始的波次
            const waveInterval = this.gameState.displayWave === 0 ? 15000 : this.gameState.timeBetweenWaves;
            const timeLeft = Math.ceil((waveInterval - this.gameState.waveTimer) / 1000);
            const nextWave = this.gameState.displayWave === 0 ? 1 : this.gameState.wave;
            nextWaveElement.textContent = `${timeLeft}秒後開始第${nextWave}波`;
            // 第一波不顯示提前開始按鈕
            startWaveBtn.style.display = this.gameState.displayWave === 0 ? 'none' : 'inline-block';
        }
    }
    
    checkRandomEvent() {
        // 30%機率觸發隨機事件（第3波後）
        if (this.gameState.wave >= 3 && Math.random() < 0.3) {
            this.showRandomEventDialog();
        } else {
            this.startNextWave();
        }
    }
    
    showRandomEventDialog() {
        const events = [
            {
                name: '精英入侵',
                description: '一隻強大的精英敵人出現！擊敗它可獲得豐厚獎勵。',
                enemy: 'elite',
                reward: { money: 80 + this.gameState.wave * 15, special: 'damage_boost' }
            },
            {
                name: '巨型威脅',
                description: '巨型敵人來襲！血量極高但獎勵豐厚。',
                enemy: 'giant',
                reward: { money: 100 + this.gameState.wave * 20, special: 'upgrade_boost' }
            },
            {
                name: '速度惡魔',
                description: '超快速敵人出現！難以命中但獎勵不錯。',
                enemy: 'speedster',
                reward: { money: 60 + this.gameState.wave * 12, special: 'health_boost' }
            }
        ];
        
        const event = events[Math.floor(Math.random() * events.length)];
        
        const accept = confirm(`🎲 隨機事件：${event.name}\n\n${event.description}\n\n獎勵：${event.reward.money}金 + 特殊獎勵\n\n接受挑戰嗎？`);
        
        if (accept) {
            this.startSpecialEvent(event);
        } else {
            this.startNextWave();
        }
    }
    
    startSpecialEvent(event) {
        // 設置特殊事件狀態
        this.gameState.specialEvent = event;
        
        // 開始正常波次
        this.startNextWave();
        
        // 在正常敵人基礎上添加特殊敵人到當前波次
        this.currentWaveEnemies.push(event.enemy + '_special');
        
        // 重新打亂敵人順序，讓特殊敵人隨機出現
        this.currentWaveEnemies.sort(() => Math.random() - 0.5);
        
        // 顯示事件開始消息
        this.showEventMessage(`${event.name}開始！精英敵人加入本波！`);
    }
    
    createSpecialEnemy(type) {
        const wave = this.gameState.wave;
        const baseMultiplier = 1 + wave * 0.3;
        
        switch(type) {
            case 'elite':
                return new Enemy(this.path, wave, 'elite_special');
            case 'giant':
                return new Enemy(this.path, wave, 'giant_special');
            case 'speedster':
                return new Enemy(this.path, wave, 'speedster_special');
            default:
                return new Enemy(this.path, wave, 'elite_special');
        }
    }
    
    showEventMessage(message) {
        // 創建視覺效果
        for (let i = 0; i < 100; i++) {
            this.particles.push(new Particle(
                this.canvas.width / 2 + (Math.random() - 0.5) * 300,
                this.canvas.height / 2 + (Math.random() - 0.5) * 200,
                '#ffaa00',
                3
            ));
        }
        
        // 可以在這裡添加更多視覺效果或UI提示
        console.log(message);
    }
    
    checkSpecialEventCompletion() {
        if (this.gameState.specialEvent) {
            // 檢查是否還有特殊敵人存活
            const hasSpecialEnemies = this.enemies.some(enemy => 
                enemy.type === 'elite_special' || 
                enemy.type === 'giant_special' || 
                enemy.type === 'speedster_special'
            );
            
            if (!hasSpecialEnemies) {
                const event = this.gameState.specialEvent;
                
                // 給予獎勵
                this.gameState.money += event.reward.money;
                this.applySpecialReward(event.reward.special);
                
                // 顯示完成消息
                this.showEventMessage(`${event.name}完成！獲得${event.reward.money}金幣和特殊獎勵！`);
                
                // 清除事件狀態
                this.gameState.specialEvent = null;
                
                this.updateUI();
            }
        }
    }
    
    gameOver() {
        // 防止重複執行
        if (this.gameOverEffect) return;
        
        // 遊戲結束特效
        this.gameOverEffect = true;
        
        // 停止遊戲更新
        this.gameState.gameOver = true;
        
        // 創建大量爆炸粒子
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            this.particles.push(new Particle(x, y, '#ff0000', 3.0, 'damage'));
        }
        
        // 屏幕震動效果
        this.screenShake = 2.0;
        
        // 延遲顯示遊戲結束對話框
        setTimeout(() => {
            if (this.gameState.gameOver) { // 再次確認遊戲已結束
                alert(`遊戲結束！你堅持到了第 ${this.gameState.wave} 波！`);
                location.reload();
            }
        }, 1500);
    }
    
    render() {
        // 屏幕震動效果
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake * 10;
            const shakeY = (Math.random() - 0.5) * this.screenShake * 10;
            this.ctx.save();
            this.ctx.translate(shakeX, shakeY);
            this.screenShake *= 0.95; // 震動衰減
        }
        
        // 完全清除畫布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 受傷閃爍效果
        if (this.damageFlash > 0) {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${this.damageFlash * 0.3})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.damageFlash -= 0.02; // 閃爍衰減
        }
        
        // 繪製背景
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 繪製遊戲區域背景（稍微亮一點）
        this.ctx.fillStyle = '#0f0f0f';
        this.ctx.fillRect(350, 0, this.canvas.width - 350, this.canvas.height);
        

        
        // 繪製路徑
        this.drawPath();
        
        // 繪製雷射光束（在其他物體下方）
        this.beams.forEach(beam => beam.render(this.ctx));
        
        // 繪製塔
        this.towers.forEach(tower => tower.render(this.ctx));
        
        // 繪製敵人
        this.enemies.forEach(enemy => enemy.render(this.ctx));
        
        // 繪製子彈
        this.projectiles.forEach(projectile => projectile.render(this.ctx));
        
        // 繪製爆炸效果
        this.explosions.forEach(explosion => explosion.render(this.ctx));
        
        // 繪製粒子
        this.particles.forEach(particle => particle.render(this.ctx));
        
        // 繪製建造預覽
        this.drawBuildPreview();
        
        // 繪製UI區域邊界（調試用）
        if (this.gameState.selectedTower) {
            this.drawUIBoundary();
        }
        
        // 恢復屏幕震動變換
        if (this.screenShake > 0) {
            this.ctx.restore();
        }
    }
    
    drawUIBoundary() {
        // 繪製UI區域邊界線
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.rect(15, 15, 315, this.canvas.height - 30); // UI區域邊界（整個左側）
        this.ctx.stroke();
        
        // 繪製UI與遊戲區域的分隔線
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(350, 0);
        this.ctx.lineTo(350, this.canvas.height);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawBuildPreview() {
        if (!this.gameState.selectedTower || !this.mouseX || !this.mouseY || 
            this.mouseX < 0 || this.mouseY < 0) return;
        
        const canBuild = this.canBuildAt(this.mouseX, this.mouseY);
        
        // 簡單的顏色選擇
        const color = canBuild.allowed ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
        const borderColor = canBuild.allowed ? '#00ff00' : '#ff0000';
        
        // 繪製建造預覽圓圈
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(this.mouseX, this.mouseY, 15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 繪製邊框
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // 顯示射程預覽
        const towerTypes = {
            machinegun: { range: 90 },
            sniper: { range: 250 },
            cannon: { range: 130 },
            freeze: { range: 100 },
            chain: { range: 120 },
            poison: { range: 100 },
            multishot: { range: 110 },
            debuff: { range: 95 }
        };
        
        const towerType = towerTypes[this.gameState.selectedTower];
        if (towerType) {
            this.ctx.strokeStyle = canBuild.allowed ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 0, 0, 0.2)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, towerType.range, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // 顯示錯誤信息
        if (!canBuild.allowed) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(canBuild.reason, this.mouseX + 20, this.mouseY - 20);
        }
    }
    

    
    drawPath() {
        if (this.path.length < 2) return;
        
        // 路徑底色
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 40;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(this.path[0].x, this.path[0].y);
        
        for (let i = 1; i < this.path.length; i++) {
            this.ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        this.ctx.stroke();
        
        // 路徑邊框
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 36;
        this.ctx.stroke();
        
        // 路徑中心線
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([8, 4]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // 繪製路徑起點和終點標記
        if (this.path.length > 0) {
            // 起點
            this.ctx.fillStyle = '#00ff00';
            this.ctx.beginPath();
            this.ctx.arc(this.path[0].x, this.path[0].y, 8, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 終點
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(this.path[this.path.length - 1].x, this.path[this.path.length - 1].y, 8, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
}

class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.baseDamage = type.damage;
        this.baseRange = type.range;
        this.baseFireRate = type.fireRate;
        this.color = type.color;
        this.type = type.type;
        this.level = 1;
        this.maxLevel = type.maxLevel;
        this.upgradeCost = type.upgradeCost;
        this.totalCost = type.cost;
        this.selected = false;
        
        // 特殊屬性
        this.splash = type.splash || false;
        this.slowEffect = type.slowEffect || 0;
        this.chainLightning = type.chainLightning || false;

        
        this.lastFire = 0;
        this.target = null;
        this.targets = []; // 多目標攻擊
        this.particles = [];
        this.muzzleFlash = 0; // 槍口閃光效果
        
        this.updateStats();
    }
    
    createPoisonCloud(gameParticles) {
        // 在塔周圍創建毒氣雲粒子效果
        const cloudRadius = this.range;
        const particleCount = 20 + this.level * 10;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = Math.random() * cloudRadius;
            const x = this.x + Math.cos(angle) * radius;
            const y = this.y + Math.sin(angle) * radius;
            
            gameParticles.push(new Particle(x, y, this.color, 1.5));
        }
        
        // 在塔本身創建更多粒子
        for (let i = 0; i < 15; i++) {
            this.particles.push(new Particle(this.x, this.y, this.color, 1.2));
        }
    }
    
    updateStats() {
        const multiplier = 1 + (this.level - 1) * 0.5;
        this.damage = Math.floor(this.baseDamage * multiplier);
        
        // 毒氣塔不增加射程，因為它是AoE攻擊會過強
        if (this.type === 'poison') {
            this.range = this.baseRange; // 射程保持不變
        } else {
            this.range = Math.floor(this.baseRange * (1 + (this.level - 1) * 0.2));
        }
        
        this.fireRate = Math.floor(this.baseFireRate / (1 + (this.level - 1) * 0.3));
    }
    
    upgrade() {
        if (this.level < this.maxLevel) {
            this.level++;
            this.totalCost += this.upgradeCost;
            this.upgradeCost = Math.floor(this.upgradeCost * 1.5);
            this.updateStats();
        }
    }
    
    update(deltaTime, enemies, projectiles, gameParticles) {
        this.lastFire += deltaTime;
        this.muzzleFlash = Math.max(0, this.muzzleFlash - deltaTime / 100);
        
        // 金錢塔特殊邏輯 - 戰術經濟系統
        if (this.type === 'money') {
            if (!this.lastMoneyTime) this.lastMoneyTime = 0;
            this.lastMoneyTime += deltaTime;
            
            if (this.lastMoneyTime >= this.fireRate) {
                if (typeof game !== 'undefined') {
                    // 基礎金錢生成（較少）
                    let baseIncome = 3 + this.level;
                    
                    // 戰術獎勵系統：根據遊戲狀況給予額外金錢
                    let bonusIncome = 0;
                    
                    // 1. 敵人擊殺獎勵：附近有敵人被擊殺時獲得額外金錢
                    if (!this.lastKillBonus) this.lastKillBonus = 0;
                    if (Date.now() - this.lastKillBonus < 3000) {
                        bonusIncome += 8 + this.level * 2; // 擊殺獎勵
                    }
                    
                    // 2. 波次完成獎勵：每波結束時獲得大額獎勵
                    if (game.gameState.allEnemiesSpawned && game.enemies.length === 0) {
                        bonusIncome += 15 + game.gameState.wave * 3; // 波次獎勵
                    }
                    
                    // 3. 危機獎勵：生命值低時獲得額外金錢
                    if (game.gameState.health <= 30) {
                        bonusIncome += 10 + this.level * 3; // 危機獎勵
                    }
                    
                    // 4. 3級特殊：投資回報，每存在的其他塔提供小額獎勵
                    if (this.level >= 3) {
                        const otherTowers = game.towers.filter(t => t !== this && t.type !== 'money').length;
                        bonusIncome += Math.floor(otherTowers * 0.5); // 每座其他塔+0.5金
                        
                        // 黃金時代：20%機率所有獎勵翻倍
                        if (Math.random() < 0.2) {
                            bonusIncome *= 2;
                            // 黃金暴擊視覺效果
                            for (let i = 0; i < 15; i++) {
                                this.particles.push(new Particle(this.x, this.y, '#ffd700', 2.5, 'money'));
                            }
                            // 額外的黃金爆發效果
                            for (let i = 0; i < 10; i++) {
                                gameParticles.push(new Particle(this.x, this.y, '#ffff00', 3.0, 'money'));
                            }
                        }
                    }
                    
                    const totalIncome = baseIncome + bonusIncome;
                    game.gameState.money += totalIncome;
                    game.updateUI();
                    
                    // 金錢生成特效：根據收入多少調整粒子效果
                    const particleCount = Math.min(15, 5 + Math.floor(totalIncome / 3));
                    for (let i = 0; i < particleCount; i++) {
                        const color = bonusIncome > baseIncome ? '#ffd700' : this.color;
                        this.particles.push(new Particle(this.x, this.y, color, 1.5, 'money'));
                    }
                    
                    // 額外的金幣飄散效果
                    if (totalIncome > 10) {
                        for (let i = 0; i < 5; i++) {
                            gameParticles.push(new Particle(this.x, this.y, '#ffd700', 2.0, 'money'));
                        }
                    }
                }
                
                this.lastMoneyTime = 0;
            }
            return; // 金錢塔不需要尋找目標和射擊
        }
        
        // 治療塔特殊邏輯 - 全局冷卻治療機制
        if (this.type === 'heal') {
            if (!this.lastHealAttempt) this.lastHealAttempt = 0;
            this.lastHealAttempt += deltaTime;
            
            // 每3秒嘗試治療一次 - 增強版
            const healInterval = 3000;
            if (this.lastHealAttempt >= healInterval) {
                // 檢查全局治療冷卻
                if (typeof game !== 'undefined') {
                    const currentTime = Date.now();
                    if (currentTime - game.gameState.lastHealTime >= game.gameState.healCooldown) {
                        // 治療量隨等級遞增 - 增強版
                        let healAmount = this.level * 2; // 1級=2HP, 2級=4HP, 3級=6HP
                        
                        // 3級：神聖祝福，25%機率額外恢復4HP並減少下次受傷
                        if (this.level >= 3 && Math.random() < 0.25) {
                            healAmount += 4;
                            // 給予短暫的傷害減免效果
                            if (!game.gameState.blessedUntil) {
                                game.gameState.blessedUntil = currentTime + 5000; // 5秒祝福效果
                            }
                            // 神聖祝福視覺效果
                            for (let i = 0; i < 12; i++) {
                                this.particles.push(new Particle(this.x, this.y, '#ffff88', 2.0, 'heal'));
                            }
                            // 神聖光環效果
                            for (let i = 0; i < 8; i++) {
                                const angle = (i / 8) * Math.PI * 2;
                                const x = this.x + Math.cos(angle) * 30;
                                const y = this.y + Math.sin(angle) * 30;
                                gameParticles.push(new Particle(x, y, '#ffd700', 1.8, 'heal'));
                            }
                        }
                        
                        game.gameState.health = Math.min(100, game.gameState.health + healAmount);
                        game.gameState.lastHealTime = currentTime; // 更新全局治療時間
                        game.updateUI();
                        
                        // 治療成功特效
                        for (let i = 0; i < 8; i++) {
                            this.particles.push(new Particle(this.x, this.y, '#00ff88', 1.5, 'heal'));
                        }
                        // 額外的治療光芒
                        for (let i = 0; i < 6; i++) {
                            gameParticles.push(new Particle(this.x, this.y, '#ffffff', 2.0, 'heal'));
                        }
                    } else {
                        // 冷卻中的視覺效果（較弱）
                        for (let i = 0; i < 2; i++) {
                            this.particles.push(new Particle(this.x, this.y, '#888888', 0.8));
                        }
                    }
                }
                
                this.lastHealAttempt = 0;
            }
        }
        
        // 尋找目標
        this.findTarget(enemies);
        
        // 射擊
        if (this.target && this.lastFire >= this.fireRate) {
            this.fire(projectiles, enemies, gameParticles);
            this.lastFire = 0;
            this.muzzleFlash = 1; // 觸發槍口閃光
        }
        
        // 更新粒子效果
        this.particles.forEach((particle, index) => {
            particle.update(deltaTime);
            if (particle.life <= 0) {
                this.particles.splice(index, 1);
            }
        });
    }
    
    findTarget(enemies) {
        const enemiesInRange = enemies.filter(enemy => {
            const distance = Math.sqrt((enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2);
            return distance <= this.range;
        });
        
        if (enemiesInRange.length === 0) {
            this.target = null;
            this.targets = [];
            return;
        }
        
        // 不同塔類型的目標選擇策略
        switch(this.type) {
            case 'sniper':
                // 狙擊塔優先攻擊血量最高的敵人
                this.target = enemiesInRange.reduce((prev, current) => 
                    current.health > prev.health ? current : prev
                );
                break;
                
            case 'multishot':
                // 多管塔可以同時攻擊多個目標
                this.targets = enemiesInRange
                    .sort((a, b) => b.pathProgress - a.pathProgress)
                    .slice(0, 2 + this.level);
                this.target = this.targets[0];
                break;
                
            case 'poison':
                // 毒氣塔攻擊範圍內所有敵人
                this.targets = enemiesInRange;
                this.target = enemiesInRange[0]; // 用於瞄準線顯示
                break;
                
            case 'chain':
                // 連鎖塔優先攻擊周圍敵人最多的目標
                let bestTarget = null;
                let maxNearbyEnemies = 0;
                
                enemiesInRange.forEach(enemy => {
                    const nearbyCount = enemiesInRange.filter(other => {
                        const dist = Math.sqrt((enemy.x - other.x) ** 2 + (enemy.y - other.y) ** 2);
                        return dist <= 80 && other !== enemy;
                    }).length;
                    
                    if (nearbyCount > maxNearbyEnemies) {
                        maxNearbyEnemies = nearbyCount;
                        bestTarget = enemy;
                    }
                });
                
                this.target = bestTarget || enemiesInRange[0];
                break;
                
            default:
                // 默認策略：優先攻擊進度最高的敵人
                this.target = enemiesInRange.reduce((prev, current) => 
                    current.pathProgress > prev.pathProgress ? current : prev
                );
                break;
        }
    }
    
    fire(projectiles, enemies, gameParticles) {
        if (this.target) {
            const projectileData = {
                damage: this.damage,
                color: this.color,
                type: this.type,
                splash: this.splash,
                slowEffect: this.slowEffect,
                chainLightning: this.chainLightning,

                level: this.level,
                towerX: this.x,
                towerY: this.y
            };
            
            // 不同類型塔的特殊攻擊效果
            switch(this.type) {
                case 'machinegun':
                    // 機槍塔：快速連射
                    projectiles.push(new Projectile(this.x, this.y, this.target, projectileData));
                    
                    // 3級：精準射擊，25%機率造成雙倍傷害
                    if (this.level >= 3 && Math.random() < 0.25) {
                        projectileData.damage *= 2;
                        // 暴擊視覺效果
                        for (let i = 0; i < 5; i++) {
                            this.particles.push(new Particle(this.x, this.y, '#ffff00', 1.0));
                        }
                    }
                    
                    // 機槍塔增強射擊效果
                    for (let i = 0; i < 5; i++) {
                        this.particles.push(new Particle(this.x, this.y, this.color, 0.8));
                    }
                    // 槍口火焰效果
                    for (let i = 0; i < 3; i++) {
                        gameParticles.push(new Particle(this.x, this.y, '#ffff00', 1.2));
                    }
                    break;
                    
                case 'sniper':
                    // 狙擊塔：即時命中，超高傷害
                    let sniperDamage = this.damage;
                    
                    // 3級：致命一擊，對血量低於30%的敵人造成額外傷害
                    if (this.level >= 3 && this.target.health / this.target.maxHealth <= 0.3) {
                        sniperDamage *= 1.8; // 對低血量敵人額外80%傷害
                        // 致命一擊視覺效果
                        for (let i = 0; i < 15; i++) {
                            gameParticles.push(new Particle(this.target.x, this.target.y, '#ff0000', 2.0));
                        }
                    }
                    
                    this.target.takeDamage(sniperDamage, 'normal', this.type);
                    
                    // 創建更強烈的狙擊軌跡
                    const dx = this.target.x - this.x;
                    const dy = this.target.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const steps = Math.floor(distance / 6);
                    for (let i = 0; i < steps; i++) {
                        const progress = i / steps;
                        const x = this.x + dx * progress;
                        const y = this.y + dy * progress;
                        gameParticles.push(new Particle(x, y, this.color, 0.6));
                        // 添加白色軌跡增強效果
                        gameParticles.push(new Particle(x, y, '#ffffff', 0.3));
                    }
                    
                    // 強化狙擊閃光
                    for (let i = 0; i < 25; i++) {
                        this.particles.push(new Particle(this.x, this.y, '#ffffff', 2));
                    }
                    
                    // 目標命中爆炸效果
                    for (let i = 0; i < 15; i++) {
                        gameParticles.push(new Particle(this.target.x, this.target.y, '#ffff00', 1.5));
                    }
                    break;
                    
                case 'cannon':
                    // 加農砲：範圍爆炸
                    projectileData.splash = true;
                    projectileData.splashRadius = 85 + this.level * 25;
                    
                    // 3級：強化爆炸，濺射傷害提升且範圍+30%
                    if (this.level >= 3) {
                        projectileData.enhancedSplash = true;
                        projectileData.splashRadius *= 1.3;
                        projectileData.splashDamageMultiplier = 0.9; // 濺射傷害從70%提升到90%
                    }
                    
                    projectiles.push(new Projectile(this.x, this.y, this.target, projectileData));
                    for (let i = 0; i < 8; i++) {
                        this.particles.push(new Particle(this.x, this.y, '#888888', 1.2));
                    }
                    break;
                    
                case 'freeze':
                    // 冰凍塔：減速效果
                    projectileData.slowEffect = 0.3 - this.level * 0.05;
                    projectileData.slowDuration = 3000 + this.level * 1000;
                    
                    // 3級：深度冰凍，減速效果更強且有機率完全凍結敵人
                    if (this.level >= 3) {
                        projectileData.deepFreeze = true;
                        projectileData.freezeChance = 0.15; // 15%機率完全凍結1秒
                        projectileData.slowEffect = Math.max(0.1, projectileData.slowEffect - 0.1); // 更強減速
                    }
                    
                    projectiles.push(new Projectile(this.x, this.y, this.target, projectileData));
                    // 冰凍塔增強效果：冰晶飛散
                    for (let i = 0; i < 10; i++) {
                        this.particles.push(new Particle(this.x, this.y, this.color, 1.2));
                    }
                    // 冰霧效果
                    for (let i = 0; i < 8; i++) {
                        gameParticles.push(new Particle(this.x, this.y, '#aaffff', 1.5));
                    }
                    break;
                    
                case 'chain':
                    // 連鎖塔：連鎖閃電
                    projectileData.chainLightning = true;
                    projectileData.chainRange = 80 + this.level * 20;
                    projectileData.maxChains = 2 + this.level;
                    projectiles.push(new Projectile(this.x, this.y, this.target, projectileData));
                    // 連鎖塔增強效果：電弧飛散
                    for (let i = 0; i < 15; i++) {
                        this.particles.push(new Particle(this.x, this.y, this.color, 1.5));
                    }
                    // 電光效果
                    for (let i = 0; i < 10; i++) {
                        gameParticles.push(new Particle(this.x, this.y, '#ffffff', 1.8));
                    }
                    break;
                    
                case 'poison':
                    // 毒氣塔：群體攻擊，直接對範圍內所有敵人造成傷害
                    if (this.targets && this.targets.length > 0) {
                        let poisonDamage = this.damage;
                        
                        // 3級：腐蝕毒素，降低敵人護甲並造成持續傷害
                        let hasCorrosion = false;
                        if (this.level >= 3) {
                            hasCorrosion = true;
                        }
                        
                        this.targets.forEach(enemy => {
                            enemy.takeDamage(poisonDamage, 'poison', this.type);
                            
                            // 3級特效：腐蝕效果，降低護甲20%並造成持續傷害
                            if (hasCorrosion) {
                                if (!enemy.statusEffects.corrosion) {
                                    enemy.statusEffects.corrosion = {
                                        active: true,
                                        duration: 4000,
                                        armorReduction: 0.2,
                                        dotDamage: poisonDamage * 0.1,
                                        tickTimer: 0
                                    };
                                } else {
                                    // 刷新持續時間
                                    enemy.statusEffects.corrosion.duration = 4000;
                                }
                            }
                        });
                        
                        // 創建毒氣雲效果
                        this.createPoisonCloud(gameParticles);
                    }
                    break;
                    
                case 'multishot':
                    // 多管塔：攻擊多個目標
                    if (this.targets && this.targets.length > 0) {
                        this.targets.forEach(target => {
                            const multiProjectileData = { ...projectileData };
                            
                            // 3級：追蹤彈藥，子彈會輕微追蹤目標且傷害+20%
                            if (this.level >= 3) {
                                multiProjectileData.tracking = true;
                                multiProjectileData.damage *= 1.2;
                            }
                            
                            projectiles.push(new Projectile(this.x, this.y, target, multiProjectileData));
                        });
                        for (let i = 0; i < 10; i++) {
                            this.particles.push(new Particle(this.x, this.y, this.color, 1.0));
                        }
                    }
                    break;
                    
                case 'debuff':
                    // 詛咒塔：增加易傷效果
                    projectileData.vulnerability = true;
                    projectileData.vulnerabilityMultiplier = 1.5 + this.level * 0.2;
                    projectileData.vulnerabilityDuration = 5000 + this.level * 1000;
                    projectiles.push(new Projectile(this.x, this.y, this.target, projectileData));
                    
                    // 詛咒塔增強視覺效果
                    for (let i = 0; i < 12; i++) {
                        this.particles.push(new Particle(this.x, this.y, this.color, 1.5, 'curse'));
                    }
                    // 詛咒軌跡效果
                    for (let i = 0; i < 8; i++) {
                        gameParticles.push(new Particle(this.x, this.y, '#cc00cc', 1.2, 'curse'));
                    }
                    break;
                    
                case 'money':
                    // 金錢塔不應該進入fire方法，這裡不應該執行
                    console.error('金錢塔不應該進入fire方法');
                    break;
                    
                case 'heal':
                    // 治療塔：只攻擊敵人，治療是獨立機制
                    projectiles.push(new Projectile(this.x, this.y, this.target, projectileData));
                    
                    // 攻擊視覺效果
                    for (let i = 0; i < 6; i++) {
                        this.particles.push(new Particle(this.x, this.y, this.color, 1.0));
                    }
                    break;
                    
                default:
                    projectiles.push(new Projectile(this.x, this.y, this.target, projectileData));
                    for (let i = 0; i < 6; i++) {
                        this.particles.push(new Particle(this.x, this.y, this.color));
                    }
                    break;
            }
        }
    }
    
    render(ctx) {
        // 如果被選中，繪製射程範圍
        if (this.selected) {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            
            // 選中邊框
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 25, 0, Math.PI * 2);
            ctx.stroke();
        }
        

        
        // 繪製塔身（根據等級和類型調整外觀）
        const size = 12 + this.level * 3;
        
        // 槍口閃光效果
        if (this.muzzleFlash > 0) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 20 * this.muzzleFlash;
        }
        
        // 不同類型塔的特殊外觀
        switch(this.type) {
            case 'machinegun':
                // 機槍塔 - 圓形，多個小炮管
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
                ctx.fill();
                // 多個炮管
                for (let i = 0; i < 4; i++) {
                    const angle = (i * Math.PI) / 2;
                    const barrelX = this.x + Math.cos(angle) * size * 0.7;
                    const barrelY = this.y + Math.sin(angle) * size * 0.7;
                    ctx.fillStyle = '#333';
                    ctx.beginPath();
                    ctx.arc(barrelX, barrelY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
                
            case 'sniper':
                // 狙擊塔 - 更威武的外觀
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
                ctx.fill();
                
                // 更粗更長的炮管
                if (this.target) {
                    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(angle);
                    
                    // 炮管主體
                    ctx.fillStyle = '#444';
                    ctx.fillRect(0, -3, size * 2, 6);
                    
                    // 炮管頂部
                    ctx.fillStyle = '#666';
                    ctx.fillRect(0, -2, size * 2, 4);
                    
                    // 炮口
                    ctx.fillStyle = '#222';
                    ctx.fillRect(size * 1.8, -2, 4, 4);
                    
                    ctx.restore();
                }
                
                // 瞄準鏡
                ctx.fillStyle = '#00ffff';
                ctx.beginPath();
                ctx.arc(this.x - 3, this.y - 3, 2, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'cannon':
                // 加農砲 - 方形底座，粗炮管
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x - size, this.y - size, size * 2, size * 2);
                ctx.fillStyle = '#333';
                ctx.fillRect(this.x - 4, this.y - 4, size, 8);
                break;
                
            case 'freeze':
                // 冰凍塔 - 六邊形，冰晶效果
                ctx.fillStyle = this.color;
                ctx.beginPath();
                const sides = 6;
                ctx.moveTo(this.x + size, this.y);
                for (let i = 1; i <= sides; i++) {
                    const angle = (i * 2 * Math.PI) / sides;
                    ctx.lineTo(this.x + size * Math.cos(angle), this.y + size * Math.sin(angle));
                }
                ctx.closePath();
                ctx.fill();
                // 冰晶裝飾
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            case 'chain':
                // 連鎖塔 - 八邊形，電弧效果
                ctx.fillStyle = this.color;
                ctx.beginPath();
                const chainSides = 8;
                ctx.moveTo(this.x + size, this.y);
                for (let i = 1; i <= chainSides; i++) {
                    const angle = (i * 2 * Math.PI) / chainSides;
                    ctx.lineTo(this.x + size * Math.cos(angle), this.y + size * Math.sin(angle));
                }
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'poison':
                // 毒氣塔 - 圓形，毒氣效果
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
                ctx.fill();
                
                // 毒氣雲範圍指示（當有目標時）
                if (this.targets && this.targets.length > 0) {
                    ctx.globalAlpha = 0.2;
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.range * 0.8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
                
                // 毒氣噴嘴
                for (let i = 0; i < 4; i++) {
                    const angle = (i * Math.PI) / 2;
                    const nozzleX = this.x + Math.cos(angle) * size * 0.8;
                    const nozzleY = this.y + Math.sin(angle) * size * 0.8;
                    ctx.fillStyle = '#66cc00';
                    ctx.beginPath();
                    ctx.arc(nozzleX, nozzleY, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
                
            case 'multishot':
                // 多管塔 - 圓形，多個炮管
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
                ctx.fill();
                // 多個大炮管
                for (let i = 0; i < 3; i++) {
                    const angle = (i * 2 * Math.PI) / 3;
                    const barrelX = this.x + Math.cos(angle) * size * 0.8;
                    const barrelY = this.y + Math.sin(angle) * size * 0.8;
                    ctx.fillStyle = '#333';
                    ctx.beginPath();
                    ctx.arc(barrelX, barrelY, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
                
            case 'debuff':
                // 詛咒塔 - 五角星形狀
                ctx.fillStyle = this.color;
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    const radius = i % 2 === 0 ? size : size * 0.5;
                    const x = this.x + Math.cos(angle) * radius;
                    const y = this.y + Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'money':
                // 金錢塔 - 鑽石形狀
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - size);
                ctx.lineTo(this.x + size * 0.7, this.y - size * 0.3);
                ctx.lineTo(this.x + size * 0.7, this.y + size * 0.3);
                ctx.lineTo(this.x, this.y + size);
                ctx.lineTo(this.x - size * 0.7, this.y + size * 0.3);
                ctx.lineTo(this.x - size * 0.7, this.y - size * 0.3);
                ctx.closePath();
                ctx.fill();
                
                // 金錢符號
                ctx.fillStyle = '#000000';
                ctx.font = `${size}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText('$', this.x, this.y + size * 0.3);
                break;
                
            case 'heal':
                // 治療塔 - 十字形狀
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
                ctx.fill();
                
                // 十字標記
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(this.x - size * 0.6, this.y - size * 0.2, size * 1.2, size * 0.4);
                ctx.fillRect(this.x - size * 0.2, this.y - size * 0.6, size * 0.4, size * 1.2);
                break;
                
            default:
                // 默認圓形
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
        
        ctx.shadowBlur = 0; // 重置陰影
        
        // 繪製等級指示器
        for (let i = 0; i < this.level; i++) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x - 8 + i * 8, this.y - size - 8, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 繪製塔頂
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // 如果有目標，繪製瞄準線
        if (this.target) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.target.x, this.target.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // 繪製粒子
        this.particles.forEach(particle => particle.render(ctx));
    }
}

class Enemy {
    constructor(path, wave, type = 'basic') {
        this.path = path;
        this.pathIndex = 0;
        this.x = path[0].x;
        this.y = path[0].y;
        this.type = type;
        this.wave = wave;
        this.reachedEnd = false;
        this.particles = [];
        this.statusEffects = {
            slow: { active: false, duration: 0, strength: 1 },
            vulnerability: { active: false, duration: 0, multiplier: 1 }
        };
        this.pathProgress = 0;
        
        this.setupEnemyType(type, wave);
    }
    
    setupEnemyType(type, wave) {
        const baseMultiplier = 1 + wave * 0.3;
        
        switch(type) {
            case 'basic':
                this.speed = (40 + wave * 3) * baseMultiplier;
                this.maxHealth = Math.floor((200 + wave * 40) * baseMultiplier);
                this.reward = 8 + wave;
                this.damage = 8 + Math.floor(wave * 0.5);
                this.size = 8;
                this.color = '#ff6666';
                break;
                
            case 'fast':
                this.speed = (80 + wave * 5) * baseMultiplier;
                this.maxHealth = Math.floor((120 + wave * 25) * baseMultiplier);
                this.reward = 12 + wave;
                this.damage = 6 + Math.floor(wave * 0.3);
                this.size = 6;
                this.color = '#66ff66';
                break;
                
            case 'heavy':
                this.speed = (20 + wave * 2) * baseMultiplier;
                this.maxHealth = Math.floor((500 + wave * 120) * baseMultiplier);
                this.reward = 20 + wave * 2;
                this.damage = 15 + Math.floor(wave * 0.8);
                this.size = 12;
                this.color = '#6666ff';
                this.armor = 0.3; // 減少30%傷害
                break;
                
            case 'flying':
                this.speed = (60 + wave * 4) * baseMultiplier;
                this.maxHealth = Math.floor((150 + wave * 35) * baseMultiplier);
                this.reward = 15 + wave;
                this.damage = 8 + Math.floor(wave * 0.4);
                this.size = 7;
                this.color = '#ffff66';
                this.flying = true;
                break;
                
            case 'stealth':
                this.speed = (50 + wave * 3) * baseMultiplier;
                this.maxHealth = Math.floor((180 + wave * 40) * baseMultiplier);
                this.reward = 18 + wave;
                this.damage = 10 + Math.floor(wave * 0.6);
                this.size = 8;
                this.color = '#ff66ff';
                this.stealth = true;
                this.visibility = 0.3;
                break;
                
            case 'boss':
                this.speed = (30 + wave * 2) * baseMultiplier;
                this.maxHealth = Math.floor((1500 + wave * 300) * baseMultiplier);
                this.reward = 100 + wave * 5;
                this.damage = 25 + Math.floor(wave * 1.5);
                this.size = 20;
                this.color = '#ff0000';
                this.boss = true;
                this.armor = 0.5;
                break;
                
            // 特殊事件敵人
            case 'elite_special':
                this.speed = (45 + wave * 3) * baseMultiplier;
                this.maxHealth = Math.floor((500 + wave * 100) * baseMultiplier); // +100血量，+20每波
                this.reward = 0; // 獎勵由事件系統處理
                this.damage = 25 + Math.floor(wave * 1.5); // +5基礎傷害，+0.3每波
                this.size = 15;
                this.color = '#ffaa00';
                this.special = true;
                this.armor = 0.25; // 護甲從20%提升到25%
                this.specialType = 'elite';
                break;
                
            case 'giant_special':
                this.speed = (15 + wave * 1) * baseMultiplier;
                this.maxHealth = Math.floor((1000 + wave * 200) * baseMultiplier); // +200血量，+50每波
                this.reward = 0;
                this.damage = 35 + Math.floor(wave * 2.5); // +5基礎傷害，+0.5每波
                this.size = 25;
                this.color = '#aa00ff';
                this.special = true;
                this.armor = 0.5; // 護甲從40%提升到50%
                this.specialType = 'giant';
                break;
                
            case 'speedster_special':
                this.speed = (130 + wave * 10) * baseMultiplier; // +10基礎速度，+2每波
                this.maxHealth = Math.floor((250 + wave * 50) * baseMultiplier); // +50血量，+10每波
                this.reward = 0;
                this.damage = 15 + Math.floor(wave * 1.0); // +3基礎傷害，+0.2每波
                this.size = 10;
                this.color = '#00ffaa';
                this.special = true;
                this.specialType = 'speedster';
                // 速度惡魔有更強的閃避能力
                this.dodgeChance = 0.3; // 閃避機率從25%提升到30%
                break;
        }
        
        this.health = this.maxHealth;
    }
    
    update(deltaTime) {
        if (this.pathIndex >= this.path.length - 1) {
            this.reachedEnd = true;
            return;
        }
        
        // 更新狀態效果
        this.updateStatusEffects(deltaTime);
        
        const target = this.path[this.pathIndex + 1];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
            this.pathIndex++;
        } else {
            let currentSpeed = this.speed;
            
            // 應用減速效果
            if (this.statusEffects.slow.active) {
                currentSpeed *= this.statusEffects.slow.strength;
            }
            
            // 應用完全凍結效果
            if (this.statusEffects.freeze && this.statusEffects.freeze.active) {
                currentSpeed = 0; // 完全無法移動
            }
            
            const moveDistance = currentSpeed * (deltaTime / 1000);
            this.x += (dx / distance) * moveDistance;
            this.y += (dy / distance) * moveDistance;
        }
        
        // 計算路徑進度
        this.pathProgress = (this.pathIndex + 1) / this.path.length;
        
        // 移動粒子軌跡
        if (Math.random() < 0.4) {
            this.particles.push(new Particle(this.x, this.y, this.color, 0.5));
        }
        
        // 更新粒子
        this.particles.forEach((particle, index) => {
            particle.update(deltaTime);
            if (particle.life <= 0) {
                this.particles.splice(index, 1);
            }
        });
    }
    
    updateStatusEffects(deltaTime) {
        // 減速效果
        if (this.statusEffects.slow.active) {
            this.statusEffects.slow.duration -= deltaTime;
            if (this.statusEffects.slow.duration <= 0) {
                this.statusEffects.slow.active = false;
            }
        }
        

        
        // 易傷效果
        if (this.statusEffects.vulnerability.active) {
            this.statusEffects.vulnerability.duration -= deltaTime;
            if (this.statusEffects.vulnerability.duration <= 0) {
                this.statusEffects.vulnerability.active = false;
                this.statusEffects.vulnerability.multiplier = 1;
            }
        }
        
        // 腐蝕效果（3級毒氣塔）
        if (this.statusEffects.corrosion && this.statusEffects.corrosion.active) {
            this.statusEffects.corrosion.duration -= deltaTime;
            this.statusEffects.corrosion.tickTimer += deltaTime;
            
            // 每0.5秒造成一次持續傷害
            if (this.statusEffects.corrosion.tickTimer >= 500) {
                this.takeDamage(this.statusEffects.corrosion.dotDamage, 'poison', 'poison');
                this.statusEffects.corrosion.tickTimer = 0;
                
                // 腐蝕傷害粒子效果
                for (let i = 0; i < 3; i++) {
                    this.particles.push(new Particle(this.x, this.y, '#99ff00', 0.8));
                }
            }
            
            if (this.statusEffects.corrosion.duration <= 0) {
                this.statusEffects.corrosion.active = false;
            }
        }
        
        // 完全凍結效果（3級冰凍塔）
        if (this.statusEffects.freeze && this.statusEffects.freeze.active) {
            this.statusEffects.freeze.duration -= deltaTime;
            if (this.statusEffects.freeze.duration <= 0) {
                this.statusEffects.freeze.active = false;
            }
        }
    }
    
    applyStatusEffect(type, data) {
        switch(type) {
            case 'slow':
                this.statusEffects.slow = {
                    active: true,
                    duration: data.duration,
                    strength: data.strength
                };
                break;

            case 'vulnerability':
                this.statusEffects.vulnerability = {
                    active: true,
                    duration: data.duration,
                    multiplier: data.multiplier
                };
                break;
        }
    }
    
    takeDamage(damage, damageType = 'normal', source = null) {
        // 速度惡魔的閃避檢查
        if (this.dodgeChance && Math.random() < this.dodgeChance) {
            // 閃避成功，顯示閃避效果
            for (let i = 0; i < 8; i++) {
                this.particles.push(new Particle(this.x, this.y, '#ffffff', 1.5));
            }
            return 0; // 沒有造成傷害
        }
        
        let finalDamage = damage;
        
        // 應用易傷效果
        if (this.statusEffects.vulnerability.active) {
            finalDamage *= this.statusEffects.vulnerability.multiplier;
        }
        
        // 應用護甲減免
        let effectiveArmor = this.armor || 0;
        
        // 腐蝕效果降低護甲
        if (this.statusEffects.corrosion && this.statusEffects.corrosion.active) {
            effectiveArmor = Math.max(0, effectiveArmor - this.statusEffects.corrosion.armorReduction);
        }
        
        if (effectiveArmor > 0) {
            finalDamage *= (1 - effectiveArmor);
        }
        
        this.health -= finalDamage;
        
        // 記錄擊殺來源
        if (this.health <= 0 && source) {
            this.killedBy = source;
        }
        
        // 受傷粒子效果
        const particleColor = damageType === 'poison' ? '#99ff00' : 
                            this.statusEffects.vulnerability.active ? '#cc00cc' : '#ff0000';
        const particleCount = this.statusEffects.vulnerability.active ? 8 : 5;
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(new Particle(this.x, this.y, particleColor));
        }
        
        return finalDamage;
    }
    
    render(ctx) {
        // 隱形敵人的透明度效果
        if (this.stealth) {
            ctx.globalAlpha = this.visibility;
        }
        
        // 繪製敵人
        ctx.fillStyle = this.color;
        ctx.beginPath();
        
        if (this.flying) {
            // 飛行敵人繪製為三角形
            ctx.moveTo(this.x, this.y - this.size);
            ctx.lineTo(this.x - this.size, this.y + this.size);
            ctx.lineTo(this.x + this.size, this.y + this.size);
            ctx.closePath();
        } else if (this.boss) {
            // BOSS繪製為六邊形
            const sides = 6;
            ctx.moveTo(this.x + this.size, this.y);
            for (let i = 1; i <= sides; i++) {
                const angle = (i * 2 * Math.PI) / sides;
                ctx.lineTo(this.x + this.size * Math.cos(angle), this.y + this.size * Math.sin(angle));
            }
            ctx.closePath();
        } else if (this.special) {
            // 特殊事件敵人繪製為特殊形狀
            switch(this.specialType) {
                case 'elite':
                    // 精英敵人 - 八角星
                    for (let i = 0; i < 8; i++) {
                        const angle = (i * Math.PI) / 4;
                        const radius = i % 2 === 0 ? this.size : this.size * 0.6;
                        const x = this.x + Math.cos(angle) * radius;
                        const y = this.y + Math.sin(angle) * radius;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    break;
                case 'giant':
                    // 巨型敵人 - 大方形
                    ctx.rect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
                    break;
                case 'speedster':
                    // 速度惡魔 - 菱形
                    ctx.moveTo(this.x, this.y - this.size);
                    ctx.lineTo(this.x + this.size, this.y);
                    ctx.lineTo(this.x, this.y + this.size);
                    ctx.lineTo(this.x - this.size, this.y);
                    ctx.closePath();
                    break;
                default:
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    break;
            }
        } else {
            // 普通敵人繪製為圓形
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        }
        ctx.fill();
        
        // 特殊敵人的光環效果
        if (this.special) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // 繪製狀態效果指示
        if (this.statusEffects.slow.active) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (this.statusEffects.vulnerability.active) {
            // 詛咒效果增強：紫色光環和螺旋效果
            ctx.strokeStyle = '#cc00cc';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // 詛咒螺旋效果
            const time = Date.now() * 0.005;
            for (let i = 0; i < 3; i++) {
                const angle = time + (i * Math.PI * 2 / 3);
                const radius = this.size + 8 + Math.sin(time * 2) * 3;
                const spiralX = this.x + Math.cos(angle) * radius;
                const spiralY = this.y + Math.sin(angle) * radius;
                
                ctx.fillStyle = '#cc00cc';
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.arc(spiralX, spiralY, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
        
        // 繪製血條
        const barWidth = this.size * 2.5;
        const barHeight = 4;
        const healthPercent = this.health / this.maxHealth;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.size - 12, barWidth, barHeight);
        
        ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.size - 12, barWidth * healthPercent, barHeight);
        
        // 如果有護甲，繪製護甲指示
        if (this.armor) {
            ctx.fillStyle = '#cccccc';
            ctx.fillRect(this.x - barWidth / 2, this.y - this.size - 16, barWidth, 2);
        }
        
        ctx.globalAlpha = 1; // 重置透明度
        
        // 繪製粒子軌跡
        this.particles.forEach(particle => particle.render(ctx));
    }
}

class Projectile {
    constructor(x, y, target, projectileData) {
        this.x = x;
        this.y = y;
        this.targetX = target.x;
        this.targetY = target.y;
        this.target = target;
        this.damage = projectileData.damage;
        this.color = projectileData.color;
        this.type = projectileData.type;
        this.level = projectileData.level;
        
        // 各種特殊效果
        this.splash = projectileData.splash || false;
        this.splashRadius = projectileData.splashRadius || 60;
        this.slowEffect = projectileData.slowEffect || 0;
        this.slowDuration = projectileData.slowDuration || 2000;
        this.chainLightning = projectileData.chainLightning || false;
        this.chainRange = projectileData.chainRange || 80;
        this.maxChains = projectileData.maxChains || 2;

        this.vulnerability = projectileData.vulnerability || false;
        this.vulnerabilityMultiplier = projectileData.vulnerabilityMultiplier || 1.5;
        this.vulnerabilityDuration = projectileData.vulnerabilityDuration || 5000;
        
        // 不同類型子彈的速度
        switch(this.type) {
            case 'cannon': this.speed = 180; break;

            case 'freeze': this.speed = 250; break;
            case 'chain': this.speed = 350; break;
            case 'debuff': this.speed = 300; break;
            default: this.speed = 400; break;
        }
        this.shouldRemove = false;
        this.particles = [];
        this.hasHit = false;
    }
    
    update(deltaTime, enemies, gameParticles) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10 && !this.hasHit) {
            this.hasHit = true;
            this.handleHit(enemies, gameParticles);
            this.shouldRemove = true;
            return;
        }
        
        const moveDistance = this.speed * (deltaTime / 1000);
        this.x += (dx / distance) * moveDistance;
        this.y += (dy / distance) * moveDistance;
        
        // 不同類型的軌跡粒子
        if (this.type === 'electric') {
            // 電磁軌跡
            if (Math.random() < 0.8) {
                this.particles.push(new Particle(this.x, this.y, this.color, 0.5));
            }
        } else {
            // 普通軌跡
            this.particles.push(new Particle(this.x, this.y, this.color, 0.3));
        }
        
        // 更新粒子
        this.particles.forEach((particle, index) => {
            particle.update(deltaTime);
            if (particle.life <= 0) {
                this.particles.splice(index, 1);
            }
        });
    }
    
    handleHit(enemies, gameParticles) {
        if (!this.target || this.target.health <= 0) return;
        
        // 基礎傷害
        this.target.takeDamage(this.damage, 'normal', this.type);
        
        // 特殊效果處理
        if (this.slowEffect > 0) {
            this.target.applyStatusEffect('slow', {
                duration: this.slowDuration,
                strength: this.slowEffect
            });
        }
        

        
        if (this.vulnerability) {
            this.target.applyStatusEffect('vulnerability', {
                duration: this.vulnerabilityDuration,
                multiplier: this.vulnerabilityMultiplier
            });
        }
        
        if (this.splash) {
            this.handleSplashDamage(enemies, gameParticles);
        }
        
        if (this.chainLightning) {
            this.handleChainLightning(enemies, gameParticles);
        }
        
        // 新的3級特殊效果
        if (this.enhancedSplash) {
            this.handleEnhancedSplash(enemies, gameParticles);
        }
        
        if (this.deepFreeze) {
            this.handleDeepFreeze(enemies, gameParticles);
        }
    }
    
    handleSplashDamage(enemies, gameParticles) {
        const splashDamage = this.damage * 0.7;
        
        enemies.forEach(enemy => {
            if (enemy === this.target) return;
            
            const dist = Math.sqrt((enemy.x - this.targetX) ** 2 + (enemy.y - this.targetY) ** 2);
            if (dist <= this.splashRadius) {
                const damageReduction = dist / this.splashRadius;
                const finalDamage = splashDamage * (1 - damageReduction * 0.5);
                enemy.takeDamage(finalDamage, 'normal', this.type);
            }
        });
        
        // 爆炸粒子效果
        for (let i = 0; i < 35; i++) {
            gameParticles.push(new Particle(this.targetX, this.targetY, '#ffaa00', 3));
        }
        
        // 爆炸衝擊波
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const x = this.targetX + Math.cos(angle) * this.splashRadius;
            const y = this.targetY + Math.sin(angle) * this.splashRadius;
            gameParticles.push(new Particle(x, y, '#ff6600', 1.5));
        }
    }
    
    handleChainLightning(enemies, gameParticles) {
        const chainDamage = this.damage * 0.8;
        let currentTarget = this.target;
        let chainCount = 0;
        const hitTargets = new Set([this.target]);
        
        while (chainCount < this.maxChains) {
            let nextTarget = null;
            let closestDistance = Infinity;
            
            enemies.forEach(enemy => {
                if (hitTargets.has(enemy)) return;
                
                const dist = Math.sqrt((enemy.x - currentTarget.x) ** 2 + (enemy.y - currentTarget.y) ** 2);
                if (dist <= this.chainRange && dist < closestDistance) {
                    closestDistance = dist;
                    nextTarget = enemy;
                }
            });
            
            if (!nextTarget) break;
            
            const finalDamage = chainDamage * Math.pow(0.85, chainCount);
            nextTarget.takeDamage(finalDamage, 'normal', this.type);
            hitTargets.add(nextTarget);
            
            // 創建閃電連鎖視覺效果
            const steps = Math.floor(closestDistance / 8);
            for (let i = 0; i < steps; i++) {
                const progress = i / steps;
                const x = currentTarget.x + (nextTarget.x - currentTarget.x) * progress;
                const y = currentTarget.y + (nextTarget.y - currentTarget.y) * progress;
                // 添加隨機偏移模擬閃電效果
                const offsetX = (Math.random() - 0.5) * 10;
                const offsetY = (Math.random() - 0.5) * 10;
                gameParticles.push(new Particle(x + offsetX, y + offsetY, this.color, 1.2));
            }
            
            // 目標命中效果
            for (let i = 0; i < 12; i++) {
                gameParticles.push(new Particle(nextTarget.x, nextTarget.y, this.color, 1.5));
            }
            
            currentTarget = nextTarget;
            chainCount++;
        }
    }
    
    // 3級加農砲：強化爆炸
    handleEnhancedSplash(enemies, gameParticles) {
        const splashDamage = this.damage * (this.splashDamageMultiplier || 0.7);
        
        enemies.forEach(enemy => {
            if (enemy === this.target) return;
            
            const dist = Math.sqrt((enemy.x - this.targetX) ** 2 + (enemy.y - this.targetY) ** 2);
            if (dist <= this.splashRadius) {
                const damageReduction = dist / this.splashRadius;
                const finalDamage = splashDamage * (1 - damageReduction * 0.3); // 減少傷害衰減
                enemy.takeDamage(finalDamage, 'normal', this.type);
            }
        });
        
        // 強化爆炸粒子效果
        for (let i = 0; i < 40; i++) {
            gameParticles.push(new Particle(this.targetX, this.targetY, '#ffaa00', 2.5));
        }
    }
    
    // 3級冰凍塔：深度冰凍
    handleDeepFreeze(enemies, gameParticles) {
        // 檢查是否觸發完全凍結
        if (Math.random() < this.freezeChance) {
            this.target.applyStatusEffect('freeze', {
                duration: 1000, // 完全凍結1秒
                strength: 0 // 完全無法移動
            });
            
            // 完全凍結視覺效果
            for (let i = 0; i < 20; i++) {
                gameParticles.push(new Particle(this.target.x, this.target.y, '#aaffff', 2.0));
            }
        }
    }
    
    render(ctx) {
        // 繪製子彈
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 繪製軌跡粒子
        this.particles.forEach(particle => particle.render(ctx));
    }
}

class Particle {
    constructor(x, y, color, scale = 1, type = 'normal') {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 100 * scale;
        this.vy = (Math.random() - 0.5) * 100 * scale;
        this.life = 1;
        this.maxLife = 1;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.type = type;
        
        // 特殊粒子類型
        if (type === 'money') {
            this.vy = -Math.abs(this.vy) - 20; // 向上飄
            this.life = 1.5;
            this.maxLife = 1.5;
            this.size = 4;
        } else if (type === 'heal') {
            this.vy = -Math.abs(this.vy) - 15; // 向上飄
            this.life = 1.2;
            this.maxLife = 1.2;
            this.size = 3;
        } else if (type === 'damage') {
            this.vy = -Math.abs(this.vy) - 30; // 快速向上
            this.life = 0.8;
            this.maxLife = 0.8;
            this.size = 5;
        } else if (type === 'curse') {
            this.vx *= 0.3;
            this.vy *= 0.3;
            this.life = 2;
            this.maxLife = 2;
            this.size = 2;
        }
    }
    
    update(deltaTime) {
        this.x += this.vx * (deltaTime / 1000);
        this.y += this.vy * (deltaTime / 1000);
        this.life -= deltaTime / 1000;
        this.vx *= 0.98;
        this.vy *= 0.98;
        
        // 特殊效果
        if (this.type === 'money') {
            this.vy += 10 * (deltaTime / 1000); // 重力效果
        }
    }
    
    render(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        
        if (this.type === 'money') {
            // 金幣效果 - 閃亮的圓形
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
            ctx.fill();
            
            // 內部高亮
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x - 1, this.y - 1, (this.size * alpha) * 0.3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'heal') {
            // 治療效果 - 十字形
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2 * alpha;
            ctx.beginPath();
            const size = this.size * alpha;
            ctx.moveTo(this.x - size, this.y);
            ctx.lineTo(this.x + size, this.y);
            ctx.moveTo(this.x, this.y - size);
            ctx.lineTo(this.x, this.y + size);
            ctx.stroke();
        } else if (this.type === 'damage') {
            // 受傷效果 - 尖銳的星形
            ctx.fillStyle = this.color;
            ctx.beginPath();
            const size = this.size * alpha;
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const radius = i % 2 === 0 ? size : size * 0.5;
                const x = this.x + Math.cos(angle) * radius;
                const y = this.y + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'curse') {
            // 詛咒效果 - 螺旋形
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1.5 * alpha;
            ctx.beginPath();
            const size = this.size * alpha;
            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * Math.PI * 4;
                const radius = size * (1 - i / 20);
                const x = this.x + Math.cos(angle) * radius;
                const y = this.y + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else {
            // 普通粒子
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1;
    }
}

class LaserBeam {
    constructor(x1, y1, x2, y2, color) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.color = color;
        this.life = 0.2; // 雷射持續時間
        this.maxLife = 0.2;
        this.width = 3;
    }
    
    update(deltaTime) {
        this.life -= deltaTime / 1000;
    }
    
    render(ctx) {
        const alpha = this.life / this.maxLife;
        
        // 雷射光束主體
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
        
        // 雷射光暈
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = this.width * 0.5;
        ctx.stroke();
        
        ctx.globalAlpha = 1;
    }
}

class Explosion {
    constructor(x, y, color, size = 50) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.currentSize = 0;
        this.life = 0.5;
        this.maxLife = 0.5;
        this.particles = [];
        
        // 創建爆炸粒子
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(x, y, color, 2));
        }
    }
    
    update(deltaTime) {
        this.life -= deltaTime / 1000;
        this.currentSize = this.size * (1 - this.life / this.maxLife);
        
        // 更新爆炸粒子
        this.particles.forEach((particle, index) => {
            particle.update(deltaTime);
            if (particle.life <= 0) {
                this.particles.splice(index, 1);
            }
        });
    }
    
    render(ctx) {
        const alpha = this.life / this.maxLife;
        
        // 爆炸圓圈
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.currentSize, 0, Math.PI * 2);
        ctx.fill();
        
        // 爆炸邊框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.globalAlpha = 1;
        
        // 繪製爆炸粒子
        this.particles.forEach(particle => particle.render(ctx));
    }
}

// 全局遊戲實例
let game;

// 啟動遊戲
window.addEventListener('load', () => {
    game = new Game();
    // 第一波會通過正常的波次管理邏輯自動開始（15秒後）
});