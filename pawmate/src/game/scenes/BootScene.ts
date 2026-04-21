import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load minimal assets needed for the loading screen
    // Generate a simple loading bar programmatically
  }

  create() {
    this.scene.start('PreloadScene');
  }
}
