import Phaser from 'phaser';
import { useUIStore } from '@/store/uiStore.ts';
import { usePetStore } from '@/store/petStore.ts';
import { WALK_MINIGAME_DURATION_SEC } from '@/data/constants.ts';
import { t } from '@/lib/i18n.ts';
import { getAnimalDef } from '@/data/animals.ts';

interface Obstacle {
  gfx: Phaser.GameObjects.Graphics;
  x: number;
  speed: number;
}

export class WalkScene extends Phaser.Scene {
  private petGfx!: Phaser.GameObjects.Graphics;
  private petX = 0;
  private petY = 0;
  private isDragging = false;
  private obstacles: Obstacle[] = [];
  private goalLine!: Phaser.GameObjects.Graphics;
  private timeLeft = WALK_MINIGAME_DURATION_SEC;
  private timerText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressFill!: Phaser.GameObjects.Graphics;
  private petProgress = 0;  // 0-1 how far along the path
  private gameOver = false;
  private countdownTimer?: Phaser.Time.TimerEvent;
  private obstacleTimer?: Phaser.Time.TimerEvent;
  private petColor = 0xc8860a;
  private pathY = 0;
  private readonly PATH_HEIGHT = 120;
  private distanceMoved = 0;

  constructor() {
    super({ key: 'WalkScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    this.pathY = height * 0.55;
    this.petProgress = 0;
    this.distanceMoved = 0;
    this.gameOver = false;
    this.obstacles = [];

    const pet = usePetStore.getState().pet;
    if (pet) {
      const def = getAnimalDef(pet.species);
      this.petColor = def.color;
    }

    this.drawBackground(width, height);
    this.drawPath(width, height);
    this.spawnPet(width, height);
    this.buildHUD(width, height);
    this.startGame();

    // Input
    this.input.on('pointermove', this.handleDrag, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerup', () => { this.isDragging = false; });
  }

  private drawBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillStyle(0x87CEEB);
    bg.fillRect(0, 0, width, height * 0.6);
    bg.fillStyle(0x4a7c59);
    bg.fillRect(0, height * 0.6, width, height * 0.4);

    // Sun
    bg.fillStyle(0xFFD700);
    bg.fillCircle(width - 50, 50, 30);

    // Clouds
    bg.fillStyle(0xffffff, 0.8);
    bg.fillEllipse(80, 60, 80, 35);
    bg.fillEllipse(110, 50, 60, 30);
    bg.fillEllipse(55, 55, 50, 28);

    bg.fillEllipse(width * 0.5, 80, 70, 30);
    bg.fillEllipse(width * 0.5 + 25, 72, 55, 28);
  }

  private drawPath(width: number, height: number) {
    const path = this.add.graphics();
    path.fillStyle(0x8B7355);
    path.fillRect(0, this.pathY - this.PATH_HEIGHT / 2, width, this.PATH_HEIGHT);
    // Path lines
    path.lineStyle(2, 0x6b5a3e, 0.5);
    path.lineBetween(0, this.pathY, width, this.pathY);

    // Goal line
    this.goalLine = this.add.graphics();
    this.goalLine.lineStyle(4, 0xFFD700);
    this.goalLine.lineBetween(width - 30, this.pathY - 60, width - 30, this.pathY + 60);
    // Flag
    this.goalLine.fillStyle(0xFF0000);
    this.goalLine.fillTriangle(width - 30, this.pathY - 60, width - 10, this.pathY - 48, width - 30, this.pathY - 36);
  }

  private spawnPet(width: number, height: number) {
    this.petX = 40;
    this.petY = this.pathY;

    this.petGfx = this.add.graphics();
    this.drawMiniPet();

    // Progress bar background
    this.progressBar = this.add.graphics();
    this.progressBar.fillStyle(0x333333, 0.7);
    this.progressBar.fillRoundedRect(20, 20, width - 40, 14, 7);

    this.progressFill = this.add.graphics();
  }

  private drawMiniPet() {
    this.petGfx.clear();
    this.petGfx.fillStyle(this.petColor);
    this.petGfx.fillCircle(this.petX, this.petY - 12, 16);
    this.petGfx.fillEllipse(this.petX, this.petY + 2, 28, 20);
    // Eyes
    this.petGfx.fillStyle(0x1a1a1a);
    this.petGfx.fillCircle(this.petX - 5, this.petY - 15, 3);
    this.petGfx.fillCircle(this.petX + 5, this.petY - 15, 3);
  }

  private buildHUD(width: number, height: number) {
    // Timer
    this.timerText = this.add.text(width / 2, 44, `${this.timeLeft}`, {
      fontFamily: 'Rubik, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Distance
    this.distanceText = this.add.text(width / 2, height - 50, `${t.walk.distance}: 0 ${t.walk.meters}`, {
      fontFamily: 'Rubik, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Instruction
    this.add.text(width / 2, height - 20, t.walk.dragPet, {
      fontFamily: 'Rubik, sans-serif',
      fontSize: '13px',
      color: '#ffffaa',
    }).setOrigin(0.5);
  }

  private startGame() {
    this.countdownTimer = this.time.addEvent({
      delay: 1000,
      callback: this.tick,
      callbackScope: this,
      loop: true,
    });

    // Spawn obstacles
    this.obstacleTimer = this.time.addEvent({
      delay: 2500,
      callback: this.spawnObstacle,
      callbackScope: this,
      loop: true,
    });
  }

  private tick() {
    if (this.gameOver) return;
    this.timeLeft--;
    this.timerText.setText(`${this.timeLeft}`);
    if (this.timeLeft <= 0) {
      this.endGame(false);
    }
  }

  private spawnObstacle() {
    if (this.gameOver) return;
    const { width } = this.cameras.main;
    const y = this.pathY + Phaser.Math.Between(-40, 40);
    const gfx = this.add.graphics();
    gfx.fillStyle(0x8B0000);
    gfx.fillCircle(0, 0, 14);
    gfx.fillStyle(0xFF4444);
    gfx.fillCircle(-4, -4, 6);
    gfx.x = width + 20;
    gfx.y = y;

    this.obstacles.push({ gfx, x: width + 20, speed: 180 + Phaser.Math.Between(0, 80) });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.petX;
    const dy = pointer.y - this.petY;
    if (Math.sqrt(dx * dx + dy * dy) < 40) {
      this.isDragging = true;
    }
  }

  private handleDrag(pointer: Phaser.Input.Pointer) {
    if (!this.isDragging || this.gameOver) return;
    const { width } = this.cameras.main;
    const prevX = this.petX;
    this.petX = Phaser.Math.Clamp(pointer.x, 20, width - 40);
    this.petY = Phaser.Math.Clamp(pointer.y, this.pathY - 55, this.pathY + 55);

    if (pointer.x > prevX) {
      this.distanceMoved += pointer.x - prevX;
      this.petProgress = Phaser.Math.Clamp(this.petX / (width - 60), 0, 1);
    }

    this.distanceText.setText(`${t.walk.distance}: ${Math.floor(this.distanceMoved / 10)} ${t.walk.meters}`);
  }

  private checkCollisions() {
    for (const obs of this.obstacles) {
      const dx = obs.x - this.petX;
      const dy = obs.gfx.y - this.petY;
      if (Math.sqrt(dx * dx + dy * dy) < 28) {
        this.endGame(false);
        return;
      }
    }

    // Check if reached goal
    const { width } = this.cameras.main;
    if (this.petX >= width - 50) {
      this.endGame(true);
    }
  }

  private endGame(success: boolean) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.countdownTimer?.destroy();
    this.obstacleTimer?.destroy();
    this.input.off('pointermove', this.handleDrag, this);

    const { width, height } = this.cameras.main;
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, width, height);

    const msg = success ? t.walk.success : t.walk.fail;
    const color = success ? '#FFD700' : '#FF6B6B';

    this.add.text(width / 2, height / 2 - 20, msg, {
      fontFamily: 'Rubik, sans-serif',
      fontSize: '36px',
      color,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Notify React layer — use already-imported store
    this.time.delayedCall(1500, () => {
      this.scene.start('HomeScene');
      useUIStore.getState().setScene('home');
    });
  }

  update(_time: number, delta: number) {
    if (this.gameOver) return;

    const { width } = this.cameras.main;

    // Move obstacles left
    for (const obs of this.obstacles) {
      obs.x -= (obs.speed * delta) / 1000;
      obs.gfx.x = obs.x;
    }

    // Remove off-screen obstacles
    this.obstacles = this.obstacles.filter(obs => {
      if (obs.x < -30) {
        obs.gfx.destroy();
        return false;
      }
      return true;
    });

    // Update pet graphic
    this.drawMiniPet();

    // Update progress bar
    this.progressFill.clear();
    this.progressFill.fillStyle(0xff6b6b);
    this.progressFill.fillRoundedRect(20, 20, (width - 40) * this.petProgress, 14, 7);

    this.checkCollisions();
  }
}
