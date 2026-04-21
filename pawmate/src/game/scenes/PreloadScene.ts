import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    // Loading bar background
    this.loadingBar = this.add.graphics();
    this.loadingBar.fillStyle(0x222244);
    this.loadingBar.fillRoundedRect(cx - 150, cy - 20, 300, 40, 10);

    // Progress fill
    this.progressBar = this.add.graphics();

    this.add.text(cx, cy - 50, 'Pawmate', {
      fontFamily: 'Rubik, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0xff6b6b);
      this.progressBar.fillRoundedRect(cx - 146, cy - 16, 292 * value, 32, 8);
    });

    this.load.on('complete', () => {
      this.progressBar.destroy();
      this.loadingBar.destroy();
    });

    // No real assets to load for Phase 1 — sprites are procedural
  }

  create() {
    this.scene.start('HomeScene');
  }
}
