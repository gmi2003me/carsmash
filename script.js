const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const healthBar = document.getElementById('health-bar');
const healthScoreDisplay = document.getElementById('health-score');
const gameOverDisplay = document.getElementById('gameOver');
const scoreDisplay = document.getElementById('score-display'); // Get score display element
const nitroIndicator = document.getElementById('nitro-indicator'); // Get nitro indicator
const introBox = document.querySelector('.intro'); // Get reference to intro box

// Game Settings
const PLAYER_START_HEALTH = 100;
const PLAYER_SPEED = 3;
const PLAYER_TURN_RATE = 0.05; // Radians per frame
const CAR_WIDTH = 20;
const CAR_HEIGHT = 40;
const ENEMY_START_SPEED = 1.5;
const ENEMY_SPAWN_RATE = 5000; // milliseconds (5 seconds)
const ENEMY_SPEED_INCREASE_INTERVAL = 10000; // Increase speed every 10 seconds
const ENEMY_SPEED_INCREMENT = 0.2;
const DAMAGE_ON_COLLISION = 10;
const WRENCH_SIZE = 20;
const WRENCH_SPAWN_CHANCE = 0.005; // Chance per frame
const WRENCH_DURATION = 5000; // milliseconds (5 seconds)
const WRENCH_HEAL_AMOUNT = 10;

// AI Settings
const AI_STRATEGIES = {
    DIRECT_PURSUE: 0,
    PREDICTIVE_INTERCEPT: 1,
    FLANK_LEFT: 2,
    FLANK_RIGHT: 3,
};
const PREDICTION_FACTOR = 15; // How many frames ahead to predict player movement
const FLANK_DISTANCE = 80; // How far to the side to target for flanking

// Audio Context and Nodes
let audioCtx = null;
let engineSoundNode = null;
let isEngineSoundPlaying = false;
let reverseSoundIntervalId = null;
let isReverseSoundPlaying = false;

// Soundtrack State
let soundtrackIntervalId = null;
let soundtrackGainNode = null;
let nextNoteTime = 0.0;
let currentNoteIndex = 0;
const musicVolume = 0.07; // Keep background music volume low

// Define the simple melody (frequencies & durations)
const NOTE_C4 = 261.63;
const NOTE_D4 = 293.66;
const NOTE_E4 = 329.63;
const NOTE_F4 = 349.23;
const NOTE_G4 = 392.00;
const NOTE_A4 = 440.00;
const REST = null; // Use null for rests

// New, longer melody with varied rhythm
const soundtrackNotes = [
    // Measure 1
    NOTE_E4, NOTE_E4, REST,    NOTE_E4, 
    // Measure 2
    REST,    NOTE_C4, NOTE_E4, REST, 
    // Measure 3
    NOTE_G4, REST,    REST,    REST, 
    // Measure 4 
    NOTE_C4, REST,    REST,    REST,
    // Measure 5
    NOTE_G4, REST,    REST,    NOTE_F4, 
    // Measure 6
    REST,    NOTE_E4, REST,    NOTE_D4,
    // Measure 7
    REST,    NOTE_C4, REST,    NOTE_E4, 
    // Measure 8
    REST,    NOTE_D4, REST,    NOTE_C4, 
];
// Durations relative to a quarter note (e.g., 1=quarter, 0.5=eighth)
const soundtrackDurations = [
    // Measure 1
    0.5, 0.5, 0.5, 0.5, 
    // Measure 2
    0.5, 0.5, 0.5, 0.5, 
    // Measure 3
    1.0, 0.5, 0.5, 0.5, 
    // Measure 4
    1.0, 0.5, 0.5, 0.5,
    // Measure 5
    0.5, 0.5, 0.5, 0.5, 
    // Measure 6
    0.5, 0.5, 0.5, 0.5,
    // Measure 7
    0.5, 0.5, 0.5, 0.5, 
    // Measure 8
    0.5, 0.5, 0.5, 1.0, // Last note longer
];

const tempo = 140; // Adjusted tempo slightly
const quarterNoteDuration = 60 / tempo; // Base duration in seconds
// REMOVED: old noteDuration, noteGap - calculated dynamically now

// Game State
let playerHealth = PLAYER_START_HEALTH;
let playerCar; // Declare ONCE here globally
let enemyCars = [];
let wrenches = [];
let keysPressed = {};
let lastEnemySpawnTime = 0;
let lastSpeedIncreaseTime = 0;
let currentEnemySpeed = ENEMY_START_SPEED;
let gameRunning = true;
let playerInvincible = false;
const PLAYER_INVINCIBILITY_DURATION = 1000; // milliseconds (1 second)
let playerLastHitTime = 0;
let score = 0;
let lastFrameTime = 0;
let gameStarted = false; // New state variable
let isNitroActive = false;
let nitroEndTime = 0;
let nitroCooldownEndTime = 0;
let warpParticles = []; // For warp animation

// Walk Mode State
let isWalking = false;
let walker = null; // Will hold walker position {x, y, frame}
const WALKER_SPEED_RATIO = 0.5;
let walkerAnimTimer = 0;
const WALKER_ANIM_SPEED = 150; // ms per frame

// Gate State
let gate = null; // { x, y, width, height, edge, endTime, startTime, openProgress }
const GATE_SPAWN_CHANCE = 0.001; 
const GATE_DURATION = 10000; 
const GATE_WIDTH = 50; 
const GATE_ANIM_DURATION = 500; // How long open/close animation takes (ms)

// Game Win State
let gameWon = false;

// Debug State
let showHitboxes = false;

// Background Color Cycling
const BG_COLOR_INTERVAL = 10000; // 10 seconds
const BG_COLORS = [
    '#FFFFFF', // White (Start)
    '#B0E0E6', // Powder Blue
    '#FFDAB9', // Peach Puff
    '#98FB98', // Pale Green
    '#FFE4E1', // Misty Rose
    '#E0FFFF'  // Light Cyan
];
let currentBgColorIndex = 0;
let lastBgColorChangeTime = 0;

// Nitro Settings
const NITRO_DURATION = 3000; // 3 seconds
const NITRO_COOLDOWN = 10000; // 10 seconds
const NITRO_SPEED_MULTIPLIER = 2; // 100% increase (double speed)

// --- Game Objects (Classes) --- 
class Car {
    constructor(x, y, width, height, color, speed = 0, angle = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.speed = speed;
        this.angle = angle; // Angle in radians
        this.strategy = null; // For enemy AI
    }

    draw(isNitro = false) {
        // Add blinking effect if invincible (check against playerCar)
        if (this === playerCar && playerInvincible && Math.floor(Date.now() / 100) % 2 === 0) {
             return;
        }

        ctx.save(); 
        ctx.translate(this.x, this.y); 
        ctx.rotate(this.angle); 

        // --- Draw 8-bit Style Car ---
        // Define block size relative to car dimensions for scalability
        const blockW = this.width / 4; 
        const blockH = this.height / 5;

        // Use lime green if nitro is active
        const bodyColor = isNitro ? '#00FF00' : this.color;
        ctx.fillStyle = bodyColor; 

        // Main body (adjust coordinates relative to center 0,0)
        ctx.fillRect(-blockW * 2, -blockH * 1.5, blockW * 4, blockH * 3); // Wider main body

        // Top section (cab/roof)
        ctx.fillRect(-blockW * 1, -blockH * 2.5, blockW * 2, blockH * 2); 

        // Draw driver head if this is the player car and NOT walking
        if (this === playerCar && !isWalking) {
            ctx.fillStyle = '#FFDBAC'; // Skin tone (same as walker)
            const headSize = blockW * 0.8; 
            // Adjust Y position to be more centered in the cab area
            const headY = -blockH * 1.5 - (headSize / 2); // Center vertically in cab
            ctx.fillRect(-headSize / 2, headY, headSize, headSize); 
        }

        // Draw wheels using the car's main color and slightly larger
        ctx.fillStyle = bodyColor; 
        const wheelW = blockW * 0.7; // Make wheels wider
        const wheelH = blockH * 1.2; // Make wheels taller
        const wheelOffsetX = blockW * 2.0; // Adjust horizontal position further out
        const wheelOffsetY = blockH * 1.5; // Adjust vertical position lower

        // Back wheels
        ctx.fillRect(-wheelOffsetX, wheelOffsetY - wheelH / 2, wheelW, wheelH); // Back wheel left
        ctx.fillRect( wheelOffsetX - wheelW, wheelOffsetY - wheelH / 2, wheelW, wheelH); // Back wheel right
        // Front wheels 
        ctx.fillRect(-wheelOffsetX, -wheelOffsetY - wheelH/2, wheelW, wheelH); // Front wheel left
        ctx.fillRect( wheelOffsetX - wheelW, -wheelOffsetY - wheelH/2, wheelW, wheelH); // Front wheel right
        
        ctx.restore();
        
        // Draw warp particles separately, not rotated with car (check against playerCar)
        if (this === playerCar && isNitro) {
            drawWarpEffect(this.x, this.y, this.angle);
        }
    }

    move(direction, speed) {
        const effectiveSpeed = (speed !== undefined) ? speed : this.speed;
        const moveSpeed = effectiveSpeed * direction;
        this.x += Math.sin(this.angle) * moveSpeed;
        this.y -= Math.cos(this.angle) * moveSpeed;

        // Keep car within bounds
        this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(canvas.height - this.height / 2, this.y));
    }

    turn(direction) { // direction: 1 for right, -1 for left
        this.angle += PLAYER_TURN_RATE * direction;
    }

    // Basic AABB collision detection
    getBounds() {
        // For simplicity using axis-aligned bounding box for now
        // TODO: Consider rotated rectangle collision for better accuracy
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }
}

class Wrench {
    constructor(x, y, size, spawnTime) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.spawnTime = spawnTime;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-Math.PI / 4); // Rotate -45 degrees like the emoji

        const blockS = this.size / 6; // Keep 6 blocks
        
        ctx.fillStyle = '#888888'; // Medium Gray

        // Handle (thicker)
        ctx.fillRect(-blockS * 1, -blockS * 3, blockS * 2, blockS * 5);

        // Head - Closed ring style
        const headOuter = blockS * 2.0;
        const headInner = blockS * 1.0;
        const headTopY = -blockS * 3 - headOuter; // Position above handle
        
        // Outer ring
        ctx.fillRect(-headOuter, headTopY, headOuter * 2, headOuter * 2);
        // Inner hole (draw background color or clearRect)
        // Clearing is safer if background color changes
        ctx.clearRect(-headInner, headTopY + (headOuter - headInner) , headInner * 2, headInner * 2);
        
        // Connect handle to ring head (overlap slightly)
        ctx.fillRect(-blockS * 1, -blockS * 3, blockS * 2, blockS); 

        ctx.restore();
    }

     getBounds() {
        return {
            x: this.x - this.size / 2,
            y: this.y - this.size / 2,
            width: this.size,
            height: this.size
        };
    }
}

// --- Input Handling --- 
document.addEventListener('keydown', (event) => {
    if (!audioCtx) {
        initAudio(); // Initialize audio on first interaction
    }

    if (!gameStarted) {
        gameStarted = true;
        if (introBox) introBox.style.display = 'none'; // Hide intro box
        
        const startTime = Date.now();
        // Convert ms time to seconds for Web Audio API
        const audioStartTime = audioCtx ? audioCtx.currentTime : 0; 
        lastFrameTime = startTime; 
        lastEnemySpawnTime = startTime; 
        lastSpeedIncreaseTime = startTime;
        lastBgColorChangeTime = startTime; 
        
        startSoundtrack(audioStartTime + 0.1); // Start soundtrack slightly after game start

        requestAnimationFrame(gameLoop);
        console.log("Game started!");
        return; 
    }

    if (gameRunning) { 
        const key = event.key.toLowerCase();
        keysPressed[key] = true;
        // Nitro Activation
        if (key === 'n') {
            tryActivateNitro();
        }
        // Walk Mode Toggle
        if (key === 'w') {
            toggleWalkMode();
        }
        // Hitbox Toggle
        if (key === 'h') {
            showHitboxes = !showHitboxes;
            console.log("Show Hitboxes:", showHitboxes);
        }
    }
});

document.addEventListener('keyup', (event) => {
    if (gameStarted && gameRunning) { 
         keysPressed[event.key.toLowerCase()] = false;
    }
});

// --- Game Loop --- 
function gameLoop(timestamp) {
    if (!gameStarted) return; 
    
    // Check if game should stop FIRST
    if (!gameRunning) {
        showGameOver(); // Show the game over screen
        // Ensure soundtrack stops if game over screen is shown
        stopSoundtrack();
        return; // Stop the loop
    }

    // If we reach here, the game is running
    const currentTime = Date.now();
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // Check for Background Color Change
    if (currentTime - lastBgColorChangeTime > BG_COLOR_INTERVAL) {
        currentBgColorIndex = (currentBgColorIndex + 1) % BG_COLORS.length;
        // Don't immediately change canvas.style here, drawArena will handle it
        lastBgColorChangeTime = currentTime;
        console.log("Background color index changed to:", currentBgColorIndex);
    }

    score += deltaTime / 10;

    if (playerInvincible && currentTime - playerLastHitTime > PLAYER_INVINCIBILITY_DURATION) {
        playerInvincible = false;
        console.log("Player invincibility ended");
    }

    // Check for Nitro End
    if (isNitroActive && currentTime >= nitroEndTime) {
        isNitroActive = false;
        warpParticles = []; // Clear warp particles
        console.log("Nitro ended");
    }

    updateControlledObject();
    updateEnemies();
    updateWrenches(currentTime);
    spawnEnemies(currentTime);
    spawnWrench(currentTime);
    spawnGate(currentTime);
    updateGate(currentTime);
    increaseEnemySpeed(currentTime);
    checkCollisions(); // Check collisions *before* checking health
    if (isNitroActive && !isWalking) {
        updateWarpParticles();
    }

    // Check health AFTER collisions
    if (playerHealth <= 0 && gameRunning && !isWalking) {
        console.log("Game Over condition met (Car health) - Setting gameRunning to false");
        gameRunning = false; // Set the flag to stop on the NEXT frame
        // Stop sounds immediately
        if (isEngineSoundPlaying) stopEngineSound(); 
        if (isReverseSoundPlaying) stopReverseSoundLoop();
        stopSoundtrack(); // Stop soundtrack immediately
        // No immediate return or showGameOver call here
    }

    // Drawing (only happens if gameRunning was true at the start of this frame)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawArena();
    renderWarpParticles();
    drawPlayerCar();
    if(isWalking) drawWalker();
    drawEnemies();
    drawWrenches();
    updateHealthBar();
    updateScoreDisplay();
    updateNitroIndicator(currentTime);

    // Request next frame
    requestAnimationFrame(gameLoop);
}

// --- Update Functions --- 
function updateControlledObject() {
    const currentTime = Date.now(); // Define currentTime here
    if (isWalking) {
        console.log("Updating Walker..."); // Log entry
        if (!walker) return;
        // Update Walker
        const walkerSpeed = PLAYER_SPEED * WALKER_SPEED_RATIO;
        let dx = 0;
        let dy = 0;
        let isMoving = false;

        // Use existing keys for walker movement (no turning)
        if (keysPressed['arrowup'] || keysPressed[' ']) { dy -= walkerSpeed; isMoving = true; }
        if (keysPressed['arrowdown'] || keysPressed['meta']) { dy += walkerSpeed; isMoving = true; }
        if (keysPressed['arrowleft']) { dx -= walkerSpeed; isMoving = true; }
        if (keysPressed['arrowright']) { dx += walkerSpeed; isMoving = true; }

        walker.x += dx;
        walker.y += dy;

        // Walker Bounds Check
        walker.x = Math.max(walker.size / 2, Math.min(canvas.width - walker.size / 2, walker.x));
        walker.y = Math.max(walker.size / 2, Math.min(canvas.height - walker.size / 2, walker.y));

        // Walker Animation
        if (isMoving) {
            if (currentTime - walkerAnimTimer > WALKER_ANIM_SPEED) {
                walker.frame = (walker.frame + 1) % 2; // Cycle frame 0 and 1
                walkerAnimTimer = currentTime;
            }
        } else {
            walker.frame = 0; // Idle frame
        }
        // Stop car sounds if walking
        if (isEngineSoundPlaying) stopEngineSound();
        if (isReverseSoundPlaying) stopReverseSoundLoop();

    } else {
        // console.log("Updating Car..."); // Optional log
        if (!playerCar) return;
        const currentSpeed = isNitroActive ? PLAYER_SPEED * NITRO_SPEED_MULTIPLIER : PLAYER_SPEED;
        const wasMovingForward = isEngineSoundPlaying;
        const wasMovingBackward = isReverseSoundPlaying;
        let isMovingForward = false;
        let isMovingBackward = false;

        if (keysPressed['arrowup'] || keysPressed[' ']) { 
            playerCar.move(1, currentSpeed);
            isMovingForward = true;
        }
        if (keysPressed['arrowdown'] || keysPressed['meta']) { 
            playerCar.move(-1, currentSpeed);
            isMovingBackward = true;
        }
        if (keysPressed['arrowleft']) { 
            playerCar.turn(-1);
        }
        if (keysPressed['arrowright']) { 
            playerCar.turn(1);
        }

        // Handle Movement Sounds (only when controlling car)
        if (isMovingForward && !wasMovingForward) {
            if (wasMovingBackward) stopReverseSoundLoop();
            startEngineSound();
        }
        if (!isMovingForward && wasMovingForward) {
            stopEngineSound();
        }
        if (isMovingBackward && !wasMovingBackward) {
            if (wasMovingForward) stopEngineSound();
            startReverseSoundLoop();
        }
        if (!isMovingBackward && wasMovingBackward) {
            stopReverseSoundLoop();
        }
    }
}

function updateEnemies() {
    enemyCars.forEach((enemy, index) => {
        let targetX, targetY;
        if (isWalking && walker) {
            // console.log(`Enemy ${index} targeting Walker`); // Optional log
            targetX = walker.x;
            targetY = walker.y;
        } else if (playerCar) {
            targetX = playerCar.x;
            targetY = playerCar.y;
        } else {
            return; // No target
        }

        // --- AI Strategy Target Calculation (based on targetX/Y) ---
        // ... (AI logic remains the same, just uses targetX/Y calculated above)
        let adjustedTargetX = targetX;
        let adjustedTargetY = targetY;

        switch (enemy.strategy) {
            case AI_STRATEGIES.PREDICTIVE_INTERCEPT:
                // Prediction needs context (player or walker?)
                // Simple: Predict based on playerCar even if walker is target
                // Better: Pass target object or predict walker movement (complex)
                if (playerCar) { 
                    adjustedTargetX = playerCar.x + Math.sin(playerCar.angle) * playerCar.speed * PREDICTION_FACTOR;
                    adjustedTargetY = playerCar.y - Math.cos(playerCar.angle) * playerCar.speed * PREDICTION_FACTOR;
                    adjustedTargetX = Math.max(0, Math.min(canvas.width, adjustedTargetX));
                    adjustedTargetY = Math.max(0, Math.min(canvas.height, adjustedTargetY));
                } else {
                    adjustedTargetX = targetX;
                    adjustedTargetY = targetY;
                }
                break;
            case AI_STRATEGIES.FLANK_LEFT:
                 if (playerCar) { 
                    adjustedTargetX = playerCar.x + Math.cos(playerCar.angle) * FLANK_DISTANCE; 
                    adjustedTargetY = playerCar.y + Math.sin(playerCar.angle) * FLANK_DISTANCE;
                 } else {
                    adjustedTargetX = targetX + FLANK_DISTANCE; // Simple horizontal flank if no car ref
                    adjustedTargetY = targetY;
                 }
                break;
            case AI_STRATEGIES.FLANK_RIGHT:
                  if (playerCar) { 
                    adjustedTargetX = playerCar.x - Math.cos(playerCar.angle) * FLANK_DISTANCE;
                    adjustedTargetY = playerCar.y - Math.sin(playerCar.angle) * FLANK_DISTANCE;
                  } else {
                    adjustedTargetX = targetX - FLANK_DISTANCE;
                    adjustedTargetY = targetY;
                  }
                break;
            case AI_STRATEGIES.DIRECT_PURSUE:
            default:
                adjustedTargetX = targetX;
                adjustedTargetY = targetY;
                break;
        }

        // --- Movement Towards Adjusted Target ---
        const dx = adjustedTargetX - enemy.x;
        const dy = adjustedTargetY - enemy.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        const minDist = (enemy.strategy === AI_STRATEGIES.DIRECT_PURSUE) ? 5 : 15;

        if (distanceToTarget > minDist) { 
            // ... (turning logic remains the same)
            const targetAngle = Math.atan2(dx, -dy);
            let angleDiff = targetAngle - enemy.angle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            const turnDirection = angleDiff > 0 ? 1 : -1;
            const enemyTurnRate = PLAYER_TURN_RATE * 1.2; 
            enemy.angle += Math.min(Math.abs(angleDiff), enemyTurnRate) * turnDirection; 

            enemy.move(1); 
        }
    });

    // Enemy-Enemy Collision Resolution
    for (let i = 0; i < enemyCars.length; i++) {
        for (let j = i + 1; j < enemyCars.length; j++) {
            const enemyA = enemyCars[i];
            const enemyB = enemyCars[j];
            const boundsA = enemyA.getBounds(); // Use AABB for simplicity
            const boundsB = enemyB.getBounds();

            if (isColliding(boundsA, boundsB)) {
                // Simple push apart based on center points
                const dx = enemyB.x - enemyA.x;
                const dy = enemyB.y - enemyA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const overlap = (enemyA.width / 2 + enemyB.width / 2) - distance; // Approximate overlap assuming similar sizes

                if (overlap > 0) {
                    // Calculate push vector (normalized difference vector)
                    const pushX = distance === 0 ? 1 : dx / distance; // Handle case where centers are identical
                    const pushY = distance === 0 ? 0 : dy / distance;

                    // Push each car back by half the overlap
                    const pushAmount = overlap / 2 + 0.5; // Add small buffer

                    enemyA.x -= pushX * pushAmount;
                    enemyA.y -= pushY * pushAmount;
                    enemyB.x += pushX * pushAmount;
                    enemyB.y += pushY * pushAmount;

                    // Ensure they stay within bounds after pushing
                    enemyA.x = Math.max(enemyA.width / 2, Math.min(canvas.width - enemyA.width / 2, enemyA.x));
                    enemyA.y = Math.max(enemyA.height / 2, Math.min(canvas.height - enemyA.height / 2, enemyA.y));
                    enemyB.x = Math.max(enemyB.width / 2, Math.min(canvas.width - enemyB.width / 2, enemyB.x));
                    enemyB.y = Math.max(enemyB.height / 2, Math.min(canvas.height - enemyB.height / 2, enemyB.y));
                }
            }
        }
    }
}

function updateWrenches(currentTime) {
     // Remove wrenches that have expired
    wrenches = wrenches.filter(wrench => currentTime - wrench.spawnTime <= WRENCH_DURATION);
}

// --- Drawing Functions --- 
function drawArena() {
    const bgColor = BG_COLORS[currentBgColorIndex];
    ctx.fillStyle = bgColor; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const borderSize = 3; 
    ctx.lineWidth = borderSize;
    ctx.strokeStyle = 'black'; 

    // Draw Border Sections (so gate can interrupt)
    // Top
    ctx.beginPath();
    ctx.moveTo(0, borderSize / 2);
    ctx.lineTo(canvas.width, borderSize / 2);
    ctx.stroke();
    // Bottom
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - borderSize / 2);
    ctx.lineTo(canvas.width, canvas.height - borderSize / 2);
    ctx.stroke();
    // Left
    ctx.beginPath();
    ctx.moveTo(borderSize / 2, 0);
    ctx.lineTo(borderSize / 2, canvas.height);
    ctx.stroke();
    // Right
    ctx.beginPath();
    ctx.moveTo(canvas.width - borderSize / 2, 0);
    ctx.lineTo(canvas.width - borderSize / 2, canvas.height);
    ctx.stroke();

    // Draw Animated Gate Doors
    if (gate) {
        ctx.save();
        ctx.fillStyle = '#654321'; // Brown for door
        const doorLength = GATE_WIDTH / 2;
        const doorThickness = borderSize * 1.5;
        const maxAngle = Math.PI / 2.2; // How far doors swing open
        const currentAngle = maxAngle * gate.openProgress;

        if (gate.edge === 0 || gate.edge === 2) { // Top or Bottom edge
            const doorY = (gate.edge === 0) ? 0 : canvas.height - doorThickness;
            const pivotX1 = gate.x;
            const pivotX2 = gate.x + doorLength * 2;
            
            // Door 1 (Left)
            ctx.translate(pivotX1, doorY + doorThickness / 2);
            ctx.rotate(-currentAngle);
            ctx.fillRect(0, -doorThickness / 2, doorLength, doorThickness);
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

            // Door 2 (Right)
            ctx.translate(pivotX2, doorY + doorThickness / 2);
            ctx.rotate(currentAngle);
            ctx.fillRect(-doorLength, -doorThickness / 2, doorLength, doorThickness);
        
        } else { // Left or Right edge
            const doorX = (gate.edge === 3) ? 0 : canvas.width - doorThickness;
            const pivotY1 = gate.y;
            const pivotY2 = gate.y + doorLength * 2;

            // Door 1 (Top)
            ctx.translate(doorX + doorThickness/2, pivotY1);
            ctx.rotate(currentAngle); // Rotate opposite for side view
            ctx.fillRect(-doorThickness/2, 0, doorThickness, doorLength);
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

            // Door 2 (Bottom)
            ctx.translate(doorX + doorThickness/2, pivotY2);
            ctx.rotate(-currentAngle);
            ctx.fillRect(-doorThickness/2, -doorLength, doorThickness, doorLength);
        }
        ctx.restore();

        // Erase the original border section behind the gate (if needed)
        // This might not be strictly necessary if doors cover it
        ctx.fillStyle = bgColor;
        ctx.fillRect(gate.x, gate.y, gate.width, gate.height);
    }
}

function drawPlayerCar() {
    if (!playerCar) return;
    playerCar.draw(isNitroActive);
    // Draw hitbox if enabled
    if (showHitboxes) {
        drawHitbox(playerCar.getBounds());
    }
}

function drawEnemies() {
    enemyCars.forEach(enemy => {
        enemy.draw();
        // Draw hitbox if enabled
        if (showHitboxes) {
            drawHitbox(enemy.getBounds());
        }
    });
}

function drawWrenches() {
    wrenches.forEach(wrench => {
        wrench.draw();
        // Draw hitbox if enabled
        if (showHitboxes) {
            drawHitbox(wrench.getBounds(), 'rgba(0, 0, 255, 0.4)'); // Blue for wrench
        }
    });
}

function drawWalker() {
    if (!walker) return;
    ctx.save();
    ctx.translate(walker.x, walker.y);
    
    const size = walker.size;
    const blockS = size / 4; // Smaller blocks for person

    // Body
    ctx.fillStyle = '#0000FF'; // Blue shirt
    ctx.fillRect(-blockS * 1, -blockS * 2, blockS * 2, blockS * 3);
    // Head
    ctx.fillStyle = '#FFDBAC'; // Skin tone
    ctx.fillRect(-blockS * 0.75, -blockS * 3, blockS * 1.5, blockS);
    
    // Legs (Animation)
    ctx.fillStyle = '#444444'; // Dark gray pants
    if (walker.frame === 0) {
        // Frame 1: Left leg forward
        ctx.fillRect(-blockS, blockS * 1, blockS * 0.8, blockS * 1.5);
        ctx.fillRect(blockS * 0.2, blockS * 1, blockS * 0.8, blockS * 1.0); // Right leg back slightly
    } else {
        // Frame 2: Right leg forward
        ctx.fillRect(blockS * 0.2, blockS * 1, blockS * 0.8, blockS * 1.5);
        ctx.fillRect(-blockS, blockS * 1, blockS * 0.8, blockS * 1.0); // Left leg back slightly
    }

    ctx.restore();
    // Draw hitbox if enabled (use default red color)
    if (showHitboxes) {
        drawHitbox(getWalkerBounds()); 
    }
}

// --- Spawning Functions --- 
function spawnEnemies(currentTime) {
    if (currentTime - lastEnemySpawnTime > ENEMY_SPAWN_RATE) {
        // Spawn enemies away from the center initially
        const edge = Math.floor(Math.random() * 4);
        let spawnX, spawnY;
        switch (edge) {
            case 0: // Top
                spawnX = Math.random() * canvas.width;
                spawnY = -CAR_HEIGHT;
                break;
            case 1: // Right
                spawnX = canvas.width + CAR_WIDTH;
                spawnY = Math.random() * canvas.height;
                break;
            case 2: // Bottom
                spawnX = Math.random() * canvas.width;
                spawnY = canvas.height + CAR_HEIGHT;
                break;
            case 3: // Left
                spawnX = -CAR_WIDTH;
                spawnY = Math.random() * canvas.height;
                break;
        }
        const newEnemy = new Car(spawnX, spawnY, CAR_WIDTH, CAR_HEIGHT, 'red', currentEnemySpeed);
        
        // Assign a random AI strategy
        const strategyKeys = Object.keys(AI_STRATEGIES);
        const randomStrategyKey = strategyKeys[Math.floor(Math.random() * strategyKeys.length)];
        newEnemy.strategy = AI_STRATEGIES[randomStrategyKey];
        console.log(`Spawning enemy at (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)}) with strategy: ${randomStrategyKey}`);
        
        enemyCars.push(newEnemy);
        lastEnemySpawnTime = currentTime;
    }
}

function spawnWrench(currentTime) {
    // Only one wrench at a time for simplicity
    if (wrenches.length === 0 && Math.random() < WRENCH_SPAWN_CHANCE) {
        const padding = 50; // Don't spawn too close to edge
        const wrenchX = padding + Math.random() * (canvas.width - 2 * padding);
        const wrenchY = padding + Math.random() * (canvas.height - 2 * padding);
        const newWrench = new Wrench(wrenchX, wrenchY, WRENCH_SIZE, currentTime);
        wrenches.push(newWrench);
        console.log("Spawning wrench at", wrenchX, wrenchY);
    }
}

function spawnGate(currentTime) {
    if (gate === null && Math.random() < GATE_SPAWN_CHANCE) {
        const edge = Math.floor(Math.random() * 4); 
        let x, y, width, height;
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const gateVisualWidth = GATE_WIDTH; 
        const borderSize = 3; // Match canvas border

        switch (edge) {
            case 0: // Top edge
                width = gateVisualWidth;
                height = borderSize * 2; // Cover border
                x = Math.random() * (canvasW - width);
                y = -borderSize / 2; // Center on border
                break;
            case 1: // Right edge
                width = borderSize * 2;
                height = gateVisualWidth;
                x = canvasW - borderSize * 1.5;
                y = Math.random() * (canvasH - height);
                break;
            case 2: // Bottom edge
                width = gateVisualWidth;
                height = borderSize * 2;
                x = Math.random() * (canvasW - width);
                y = canvasH - borderSize * 1.5;
                break;
            case 3: // Left edge
                width = borderSize * 2;
                height = gateVisualWidth;
                x = -borderSize / 2;
                y = Math.random() * (canvasH - height);
                break;
        }

        gate = {
            x: x, y: y, width: width, height: height, edge: edge,
            startTime: currentTime,
            endTime: currentTime + GATE_DURATION,
            openProgress: 0 // Starts closed
        };
        console.log("Gate spawned:", gate);
        playGateOpenSound(); 
    }
}

function updateGate(currentTime) {
    if (!gate) return;

    const timeSinceSpawn = currentTime - gate.startTime;
    const timeUntilEnd = gate.endTime - currentTime;

    // Calculate progress (0 to 1 for open, 1 to 0 for close)
    if (timeSinceSpawn < GATE_ANIM_DURATION) {
        // Opening animation
        gate.openProgress = timeSinceSpawn / GATE_ANIM_DURATION;
    } else if (timeUntilEnd < GATE_ANIM_DURATION) {
        // Closing animation
        gate.openProgress = timeUntilEnd / GATE_ANIM_DURATION;
    } else {
        // Fully open
        gate.openProgress = 1;
    }
    
    gate.openProgress = Math.max(0, Math.min(1, gate.openProgress)); // Clamp 0-1

    // Remove gate completely after closing animation finishes
    if (currentTime >= gate.endTime) {
        console.log("Gate closed and removed.");
        gate = null;
    }
}

// --- Other Helper Functions --- 
function updateHealthBar() {
    const healthPercentage = Math.max(0, playerHealth) / PLAYER_START_HEALTH;
    healthBar.style.width = `${healthPercentage * 100}%`;
    healthScoreDisplay.textContent = `Health: ${Math.max(0, playerHealth)}`;
    if (playerHealth > 60) healthBar.style.backgroundColor = 'green';
    else if (playerHealth > 30) healthBar.style.backgroundColor = 'orange';
    else healthBar.style.backgroundColor = 'red';
}

function increaseEnemySpeed(currentTime) {
    if (currentTime - lastSpeedIncreaseTime > ENEMY_SPEED_INCREASE_INTERVAL) {
        currentEnemySpeed += ENEMY_SPEED_INCREMENT;
        console.log(`Enemy speed increased to: ${currentEnemySpeed.toFixed(2)}`);
        enemyCars.forEach(enemy => enemy.speed = currentEnemySpeed);
        lastSpeedIncreaseTime = currentTime;
    }
}

// --- Helper Functions --- 
function isColliding(rect1, rect2) {
    // AABB collision detection
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function checkCollisions() {
    if (isWalking && walker) {
        console.log("Checking Walker collisions..."); // Log entry
        // --- Walker Mode Collisions ---
        const walkerBounds = getWalkerBounds();
        if (!walkerBounds) return; // Should not happen if isWalking is true, but safe check

        // 1. Walker vs Car (to get back in)
        if (playerCar) { 
            const carBounds = playerCar.getBounds();
            if (isColliding(walkerBounds, carBounds)) {
                toggleWalkMode(); 
                return; 
            }
        }

        // 2. Walker vs Enemy
        for (let i = enemyCars.length - 1; i >= 0; i--) {
            const enemy = enemyCars[i];
            const enemyBounds = enemy.getBounds();
            if (isColliding(walkerBounds, enemyBounds)) {
                console.log("Walker hit by enemy!");
                playSadSound();
                gameRunning = false; // End game immediately
                return; // Stop further checks
            }
        }

        // 3. Walker vs Wrench 
        for (let i = wrenches.length - 1; i >= 0; i--) {
            const wrench = wrenches[i];
            const wrenchBounds = wrench.getBounds();
            if (isColliding(walkerBounds, wrenchBounds)) {
                console.log("Walker collected wrench!");
                playerHealth = Math.min(PLAYER_START_HEALTH, playerHealth + WRENCH_HEAL_AMOUNT);
                playWrenchSound(); 
                wrenches.splice(i, 1); 
                updateHealthBar(); 
            }
        }

        // 4. Walker vs Gate (Win Condition)
        if (gate) {
            const gateBounds = gate; // Gate object already has x, y, width, height
            if (isColliding(walkerBounds, gateBounds)) {
                console.log("Walker reached the gate!");
                gameWon = true;
                gameRunning = false; // Stop the game
                playWinSound(); // Play celebratory sound
                return; // Stop further checks
            }
        }

    } else if (playerCar) {
        // console.log("Checking Car collisions..."); // Optional log
        // --- Car Mode Collisions ---
        const playerBounds = playerCar.getBounds();

        // 1. Player Car vs Enemy (No damage if invincible)
        if (!playerInvincible) { 
            for (let i = enemyCars.length - 1; i >= 0; i--) {
                const enemy = enemyCars[i];
                const enemyBounds = enemy.getBounds();
                if (isColliding(playerBounds, enemyBounds)) {
                    console.log("Collision with enemy!");
                    playerHealth -= DAMAGE_ON_COLLISION;
                    playerInvincible = true;
                    playerLastHitTime = Date.now();
                    playHitSound(); 
                    updateHealthBar(); 
                    // Game over check is in main loop
                    break; 
                }
            }
        }

        // 2. Player Car vs Wrench
        for (let i = wrenches.length - 1; i >= 0; i--) {
            const wrench = wrenches[i];
            const wrenchBounds = wrench.getBounds();
            if (isColliding(playerBounds, wrenchBounds)) {
                console.log("Collected wrench!");
                playerHealth = Math.min(PLAYER_START_HEALTH, playerHealth + WRENCH_HEAL_AMOUNT);
                playWrenchSound(); 
                wrenches.splice(i, 1); 
                updateHealthBar(); 
            }
        }
    }
}

function updateScoreDisplay() {
    scoreDisplay.textContent = `Score: ${Math.floor(score)}`;
}

function showGameOver() {
    if (gameWon) {
        gameOverDisplay.textContent = "YOU WON!";
        gameOverDisplay.style.color = '#00FF00'; // Green win text
        gameOverDisplay.style.textShadow = '2px 2px #FFFFFF'; // White shadow
    } else {
        gameOverDisplay.textContent = `Game Over! Final Score: ${Math.floor(score)}`;
        gameOverDisplay.style.color = '#FF0000'; // Red game over text
        gameOverDisplay.style.textShadow = '2px 2px #0000FF'; // Blue shadow
    }
    gameOverDisplay.style.display = 'block';
    
    // Play appropriate sound only if game wasn't already won
    if (!gameWon) {
        playGameOverSound(); 
    } // Win sound is played immediately in checkCollisions
}

// --- Audio Functions ---
function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            console.log("AudioContext initialized.");
        } catch (e) {
            console.error("Web Audio API is not supported in this browser", e);
        }
    }
}

// Simple tone player
function playTone(frequency, duration, type = 'sine', volume = 0.1) {
    if (!audioCtx) return; // Don't play if context failed
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration / 1000);
}

function startEngineSound() {
    if (!audioCtx || engineSoundNode) return; 
    engineSoundNode = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    engineSoundNode.type = 'triangle'; // Changed to triangle for a slightly softer tone
    engineSoundNode.frequency.setValueAtTime(80, audioCtx.currentTime); // Slightly higher pitch
    gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime); // Adjusted volume

    engineSoundNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    engineSoundNode.loop = true;
    engineSoundNode.start();
    isEngineSoundPlaying = true;
    console.log("Engine sound started");
}

function stopEngineSound() {
    if (engineSoundNode) {
        engineSoundNode.stop();
        engineSoundNode.disconnect();
        engineSoundNode = null;
        isEngineSoundPlaying = false;
        console.log("Engine sound stopped");
    }
}

function playReverseBeep() {
    // Short, higher-pitched beep
    playTone(1500, 100, 'square', 0.08);
}

function startReverseSoundLoop() {
    if (!audioCtx || reverseSoundIntervalId) return; // Don't start if context failed or already running
    playReverseBeep(); // Play immediately
    reverseSoundIntervalId = setInterval(playReverseBeep, 400); // Repeat every 400ms
    isReverseSoundPlaying = true;
    console.log("Reverse sound started");
}

function stopReverseSoundLoop() {
    if (reverseSoundIntervalId) {
        clearInterval(reverseSoundIntervalId);
        reverseSoundIntervalId = null;
        isReverseSoundPlaying = false;
        console.log("Reverse sound stopped");
    }
}

function playHitSound() {
    playTone(110, 200, 'square', 0.15); // Low square wave tone for hit
}

function playWrenchSound() {
    playTone(880, 150, 'triangle', 0.1); // Higher triangle wave tone for wrench
}

function playGameOverSound() {
     playTone(220, 500, 'sawtooth', 0.1);
     // Delay the second part of the game over sound
     setTimeout(() => playTone(165, 700, 'sawtooth', 0.1), 300);
}

function playWinSound() {
    stopAllSounds();
    // Simple ascending arpeggio
    playTone(NOTE_C4, 100, 'sine', 0.15);
    setTimeout(() => playTone(NOTE_E4, 100, 'sine', 0.15), 100);
    setTimeout(() => playTone(NOTE_G4, 100, 'sine', 0.15), 200);
    setTimeout(() => playTone(NOTE_C4 * 2, 200, 'sine', 0.15), 300); // Higher C
}

// --- Nitro Warp Effect Functions ---
function drawWarpEffect(carX, carY, carAngle) {
    // Create new particles emanating from behind the car
    const numParticles = 3; // Particles per frame
    for (let i = 0; i < numParticles; i++) {
        // Start behind the center
        const startOffset = -CAR_HEIGHT / 2 - 5;
        const startX = carX + Math.sin(carAngle) * startOffset;
        const startY = carY - Math.cos(carAngle) * startOffset;

        // Randomize angle slightly around the opposite of car angle
        const spread = Math.PI / 8; // Angle spread
        const angle = -carAngle + (Math.random() - 0.5) * spread;
        
        const speed = 5 + Math.random() * 5; // Particle speed
        const life = 15 + Math.random() * 10; // Particle lifetime (frames)
        
        warpParticles.push({
            x: startX,
            y: startY,
            vx: Math.sin(angle) * speed,
            vy: -Math.cos(angle) * speed,
            life: life,
            maxLife: life,
            color: Math.random() > 0.5 ? '#FFFF00' : '#FFFFFF' // Yellow or White
        });
    }
}

function updateWarpParticles() {
    for (let i = warpParticles.length - 1; i >= 0; i--) {
        const p = warpParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) {
            warpParticles.splice(i, 1);
        }
    }
}

function renderWarpParticles() {
    warpParticles.forEach(p => {
        // Fade out effect
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        // Simple square particle
        const size = 3;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    });
    ctx.globalAlpha = 1.0; // Reset global alpha
}

function updateNitroIndicator(currentTime) {
    if (!nitroIndicator) return;

    if (isNitroActive) {
        nitroIndicator.textContent = 'Nitro!';
        nitroIndicator.classList.remove('ready');
    } else if (currentTime >= nitroCooldownEndTime) {
        nitroIndicator.textContent = 'Nitro Ready';
        nitroIndicator.classList.add('ready');
    } else {
        const remainingCooldown = Math.ceil((nitroCooldownEndTime - currentTime) / 1000);
        nitroIndicator.textContent = `Nitro: ${remainingCooldown}s`;
        nitroIndicator.classList.remove('ready');
    }
}

function tryActivateNitro() {
    const currentTime = Date.now();
    if (!isNitroActive && currentTime >= nitroCooldownEndTime) {
        isNitroActive = true;
        nitroEndTime = currentTime + NITRO_DURATION;
        // Cooldown starts immediately upon activation
        nitroCooldownEndTime = currentTime + NITRO_COOLDOWN; 
        warpParticles = []; // Clear any old particles
        // Add nitro sound later if needed
        updateNitroIndicator(currentTime); 
        console.log("Nitro activated!");
    } else {
        // ... (log message if already active or on cooldown)
    }
}

function scheduleNote(noteIndex, time) {
    if (!soundtrackGainNode) return; 

    const freq = soundtrackNotes[noteIndex];
    const durationMultiplier = soundtrackDurations[noteIndex];
    // Calculate actual duration based on tempo and relative duration
    const actualDuration = quarterNoteDuration * durationMultiplier;
    // Make the sound slightly shorter than the duration to create separation
    const playDuration = actualDuration * 0.9;

    // Don't play anything for rests
    if (freq === REST) {
        return; 
    }

    const osc = audioCtx.createOscillator();
    osc.connect(soundtrackGainNode);
    osc.type = 'square'; 
    osc.frequency.setValueAtTime(freq, time);

    osc.start(time);
    osc.stop(time + playDuration); 

    osc.onended = () => { 
        try { osc.disconnect(); } catch(e) {} 
    };
}

function scheduler() {
    if (!gameRunning || !gameStarted) { 
        stopSoundtrack(); 
        return;
    }

    const scheduleAheadTime = 0.2; 

    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
        const durationMultiplier = soundtrackDurations[currentNoteIndex];
        const timeToAdvance = quarterNoteDuration * durationMultiplier;

        scheduleNote(currentNoteIndex, nextNoteTime);
        
        nextNoteTime += timeToAdvance;
        currentNoteIndex = (currentNoteIndex + 1) % soundtrackNotes.length;
    }
}

function startSoundtrack(startTime = 0) {
    if (!audioCtx || soundtrackIntervalId !== null) return; // No context or already running

    console.log("Starting soundtrack...");
    // Create gain node for volume control
    soundtrackGainNode = audioCtx.createGain();
    soundtrackGainNode.gain.setValueAtTime(musicVolume, audioCtx.currentTime);
    soundtrackGainNode.connect(audioCtx.destination);

    currentNoteIndex = 0;
    nextNoteTime = startTime > 0 ? startTime : audioCtx.currentTime + 0.1; // Use provided start time or default
    
    // Start the scheduling check interval
    const lookahead = 50.0; // Check every 50ms
    scheduler(); // Schedule initial notes immediately
    soundtrackIntervalId = setInterval(scheduler, lookahead); 
}

function stopSoundtrack() {
    console.log("Attempting to stop soundtrack..."); // Log entry
    if (soundtrackIntervalId !== null) {
        clearInterval(soundtrackIntervalId);
        soundtrackIntervalId = null;
        console.log("Soundtrack scheduler stopped.");
    }
    if (soundtrackGainNode) {
        console.log("Disconnecting soundtrack gain node (no fade)..."); // Log change
        // SIMPLIFIED: Stop immediately, no fade/timeout
        try { soundtrackGainNode.disconnect(); } catch(e) {}
        soundtrackGainNode = null;
        // // Original Fade Logic (commented out for debugging)
        // console.log("Fading out soundtrack volume...");
        // soundtrackGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        // soundtrackGainNode.gain.setValueAtTime(soundtrackGainNode.gain.value, audioCtx.currentTime); 
        // soundtrackGainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
        // setTimeout(() => {
        //     if (soundtrackGainNode) { 
        //          try { soundtrackGainNode.disconnect(); } catch(e) {}
        //          soundtrackGainNode = null;
        //          console.log("Soundtrack gain node disconnected.");
        //     }
        // }, 400); 
    } 
    nextNoteTime = 0;
}

// --- Walk Mode Toggle ---
function toggleWalkMode() {
    // Add guard clause for playerCar
    if (!playerCar) {
        console.error("toggleWalkMode called but playerCar is null!");
        return;
    }
    if (!gameRunning) return;
    
    isWalking = !isWalking;
    if (isWalking) {
        console.log("Entering Walk Mode - Toggling state...");
        const offsetDist = CAR_HEIGHT * 0.6;
        // Ensure playerCar exists before accessing properties
        const startX = playerCar.x + Math.sin(playerCar.angle) * offsetDist;
        const startY = playerCar.y - Math.cos(playerCar.angle) * offsetDist;
        walker = { x: startX, y: startY, size: CAR_WIDTH * 0.7, frame: 0 };
        console.log("Walker created at:", walker.x, walker.y);
        keysPressed = {}; 
        stopAllSounds(); 
        console.log("Sounds stopped for Walk Mode.");
    } else {
        console.log("Exiting Walk Mode - Toggling state...");
        walker = null;
        keysPressed = {}; 
        console.log("Walker set to null.");
    }
}

// --- Audio Functions ---
function stopAllSounds(){
     if (isEngineSoundPlaying) stopEngineSound(); 
     if (isReverseSoundPlaying) stopReverseSoundLoop();
     stopSoundtrack();
     // TODO: Add stopNitroSound if/when implemented
}

function playSadSound() {
    stopAllSounds(); 
    playTone(440, 150, 'triangle', 0.1); 
    setTimeout(() => playTone(330, 150, 'triangle', 0.1), 100);
    setTimeout(() => playTone(220, 250, 'triangle', 0.1), 200);
}

function playGateOpenSound() {
    // Short, slightly metallic sound?
    playTone(600, 50, 'square', 0.1);
    setTimeout(() => playTone(800, 100, 'square', 0.08), 60);
}

// --- Initialization --- 
function initGame() {
    console.log("Initializing game...");
    gameStarted = false;
    gameRunning = true;
    
    // Assign to the globally declared playerCar
    playerCar = new Car(canvas.width / 2, canvas.height / 2, CAR_WIDTH, CAR_HEIGHT, 'blue', PLAYER_SPEED, 0);
    
    isWalking = false;
    walker = null;

    playerHealth = PLAYER_START_HEALTH;
    // ... (rest of resets)
    enemyCars = [];
    wrenches = [];
    keysPressed = {};
    lastEnemySpawnTime = 0;
    lastSpeedIncreaseTime = 0;
    currentEnemySpeed = ENEMY_START_SPEED;
    playerInvincible = false; 
    score = 0; 
    lastFrameTime = 0; 
    gameOverDisplay.style.display = 'none';
    if (introBox) introBox.style.display = 'block';
    currentBgColorIndex = 0; 
    lastBgColorChangeTime = 0; 
    isNitroActive = false;
    nitroEndTime = 0;
    nitroCooldownEndTime = 0; 
    warpParticles = []; 
    updateHealthBar(); 
    updateScoreDisplay();
    updateNitroIndicator(Date.now()); 
    initAudio();
    stopAllSounds();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawArena();
    gameWon = false; // Reset win state
    gate = null; // Reset gate state
}

// --- Start Game ---
initGame(); 

// --- Helper Functions ---
function getWalkerBounds() {
    if (!walker) return null;
    // Calculate bounds based on walker drawing logic
    const size = walker.size;
    const blockS = size / 4;
    const totalHeight = blockS * 4.5; // Head (1) + Body (3) + Legs (~1.5, use 1.5 for bounds)
    const totalWidth = blockS * 2; // Body width is widest point

    return {
        x: walker.x - totalWidth / 2,
        y: walker.y - blockS * 3, // Top of head
        width: totalWidth,
        height: totalHeight
    };
}

// Function to draw a hitbox
function drawHitbox(bounds, color = 'rgba(255, 0, 0, 0.4)') {
    if (!bounds) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
} 